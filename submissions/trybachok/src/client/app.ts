import { createUsersApi, UsersApiError } from './api.ts';
import { createListLoader, type ListState } from './list.ts';
import type { User } from '../shared/users.ts';
import { bindCreateUserForm } from './create-user-form.ts';
import { createActionStatus, findElement } from './dom.ts';

const api = createUsersApi();
const list = findElement<HTMLUListElement>('users');
const listStatus = findElement('list-status');
const listError = findElement('list-error');
const retryButton = findElement<HTMLButtonElement>('retry');
const searchInput = findElement<HTMLInputElement>('search');
const showActionStatus = createActionStatus(findElement('action-status'));
const deleteError = findElement('delete-error');
const deletingIds = new Set<number>();
let displayedName = '';

function setDeletePending(button: HTMLButtonElement, pending: boolean) {
  button.disabled = pending;
  button.textContent = pending ? 'Удаляем…' : 'Удалить';
}

function renderUsers(users: readonly User[]) {
  const focused = document.activeElement;
  const focusedId = list.contains(focused) && focused instanceof HTMLElement
    ? focused.closest('li')?.dataset.userId
    : undefined;

  const rows = users.map((user) => {
    const row = document.createElement('li');
    const details = document.createElement('div');
    const name = document.createElement('strong');
    const email = document.createElement('span');
    const button = document.createElement('button');
    row.dataset.userId = String(user.id);
    details.className = 'user-details';
    name.textContent = user.name;
    email.textContent = user.email;
    button.type = 'button';
    button.className = 'delete';
    button.setAttribute('aria-label', `Удалить ${user.name}`);
    setDeletePending(button, deletingIds.has(user.id));
    button.addEventListener('click', () => void deleteUser(user, button));
    details.append(name, email);
    row.append(details, button);
    return row;
  });

  list.replaceChildren(...rows);
  if (focusedId) {
    const row = rows.find((item) => item.dataset.userId === focusedId);
    const button = row?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    (button ?? searchInput).focus();
  }
}

function renderListState(state: ListState) {
  if (document.activeElement === retryButton) searchInput.focus();
  retryButton.hidden = state.kind !== 'error';
  listError.textContent = '';

  if (state.kind === 'loading') {
    if (displayedName !== searchInput.value.trim()) renderUsers([]);
    list.setAttribute('aria-busy', 'true');
    listStatus.textContent = 'Загружаем пользователей…';
    return;
  }

  list.removeAttribute('aria-busy');
  if (state.kind === 'error') {
    listStatus.textContent = '';
    listError.textContent = `Не удалось загрузить список. ${state.message}`;
    return;
  }

  displayedName = state.name;
  renderUsers(state.users);
  if (state.users.length) {
    listStatus.textContent = state.name ? `Результатов поиска: ${state.users.length}` : '';
    return;
  }

  listStatus.textContent = state.name ? 'По этому запросу ничего не найдено.' : 'Пользователей пока нет.';
}

const load = createListLoader(api.list, renderListState);
const loadUsers = () => load(searchInput.value.trim());

function deleteUserRow(id: number, returnFocus: boolean) {
  const row = list.querySelector<HTMLLIElement>(`li[data-user-id="${id}"]`);
  if (!row) return;

  const nextButton = row.nextElementSibling?.querySelector<HTMLButtonElement>('button:not(:disabled)');
  const previousButton = row.previousElementSibling?.querySelector<HTMLButtonElement>('button:not(:disabled)');
  const active = document.activeElement;
  row.remove();
  if (returnFocus && (active === document.body || row.contains(active))) {
    (nextButton ?? previousButton ?? searchInput).focus();
  }
}

async function deleteUser(user: User, button: HTMLButtonElement) {
  if (deletingIds.has(user.id)) return;

  const returnFocus = document.activeElement === button;
  deletingIds.add(user.id);
  setDeletePending(button, true);
  deleteError.textContent = '';
  showActionStatus('Удаляем пользователя…');

  try {
    const removed = await api.remove(user.id);
    deleteUserRow(user.id, returnFocus);
    showActionStatus(removed ? 'Пользователь удалён.' : 'Пользователь уже удалён.', 'success');
    void loadUsers();
  } catch (error) {
    showActionStatus('');
    const message = error instanceof UsersApiError ? error.message : 'Попробуйте ещё раз.';
    deleteError.textContent = `Не удалось удалить пользователя. ${message}`;
  } finally {
    deletingIds.delete(user.id);
    const row = list.querySelector<HTMLLIElement>(`li[data-user-id="${user.id}"]`);
    const currentButton = row?.querySelector('button');
    if (currentButton) {
      setDeletePending(currentButton, false);
      if (returnFocus && document.activeElement === document.body) currentButton.focus();
    }
  }
}

bindCreateUserForm(api.create, showActionStatus, () => {
  showActionStatus('Пользователь добавлен.', 'success');
  void loadUsers();
});
searchInput.addEventListener('input', () => void loadUsers());
retryButton.addEventListener('click', () => void loadUsers());
void loadUsers();
