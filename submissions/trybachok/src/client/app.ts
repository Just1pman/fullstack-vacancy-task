import { createUsersApi, UsersApiError } from './api.ts';
import { createListLoader, type ListState } from './list.ts';
import type { User } from '../users.ts';
import { validateUserFields } from '../user-fields.ts';

function findElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Элемент #${id} отсутствует на странице.`);
  return element as T;
}

const api = createUsersApi();
const list = findElement<HTMLUListElement>('users');
const listStatus = findElement('list-status');
const listError = findElement('list-error');
const retryButton = findElement<HTMLButtonElement>('retry');
const searchInput = findElement<HTMLInputElement>('search');
const actionStatus = findElement('action-status');
const deleteError = findElement('delete-error');
const form = findElement<HTMLFormElement>('user-form');
const fields = findElement<HTMLFieldSetElement>('user-fields');
const nameInput = findElement<HTMLInputElement>('name');
const emailInput = findElement<HTMLInputElement>('email');
const formError = findElement('form-error');
const createButton = findElement<HTMLButtonElement>('create');
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

function setFieldValidity(input: HTMLInputElement, message = '') {
  input.setCustomValidity(message);
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function setValidationHint(input: HTMLInputElement, message?: string) {
  input.setCustomValidity('');
  const hint = message ?? (input.validity.valid ? '' : 'Проверьте значение поля.');
  setFieldValidity(input, hint);
}

async function createUser() {
  if (fields.disabled) return;
  const input = { name: nameInput.value, email: emailInput.value };
  formError.textContent = '';
  const errors = validateUserFields(input.name, input.email);
  setValidationHint(nameInput, errors.name);
  setValidationHint(emailInput, errors.email);
  if (!form.reportValidity()) return;

  actionStatus.textContent = 'Добавляем пользователя…';
  fields.disabled = true;
  createButton.textContent = 'Добавляем…';

  let hasServerFieldErrors = false;
  try {
    await api.create(input);
    form.reset();
    actionStatus.textContent = 'Пользователь добавлен.';
    void loadUsers();
  } catch (error) {
    actionStatus.textContent = '';
    if (error instanceof UsersApiError && (error.fields.name || error.fields.email)) {
      hasServerFieldErrors = true;
      setFieldValidity(nameInput, error.fields.name);
      setFieldValidity(emailInput, error.fields.email);
    } else {
      const message = error instanceof UsersApiError ? error.message : 'Попробуйте ещё раз.';
      formError.textContent = `Не удалось добавить пользователя. ${message}`;
    }
  } finally {
    fields.disabled = false;
    createButton.textContent = 'Добавить';
    if (hasServerFieldErrors) {
      form.reportValidity();
    } else {
      const active = document.activeElement;
      if (active === document.body || form.contains(active)) nameInput.focus();
    }
  }
}

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
  actionStatus.textContent = 'Удаляем пользователя…';

  try {
    const removed = await api.remove(user.id);
    deleteUserRow(user.id, returnFocus);
    actionStatus.textContent = removed ? 'Пользователь удалён.' : 'Пользователь уже удалён.';
    void loadUsers();
  } catch (error) {
    actionStatus.textContent = '';
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

form.noValidate = true;
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void createUser();
});
nameInput.addEventListener('input', () => setFieldValidity(nameInput));
emailInput.addEventListener('input', () => setFieldValidity(emailInput));
searchInput.addEventListener('input', () => void loadUsers());
retryButton.addEventListener('click', () => void loadUsers());
fields.disabled = false;
void loadUsers();
