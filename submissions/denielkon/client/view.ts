import type { User } from '../shared/user.js';
import type { State } from './store.js';

const errorBanner = document.getElementById('error') as HTMLParagraphElement;
const searchField = document.getElementById('search-field') as HTMLDivElement;
const listStatus = document.getElementById('list-status') as HTMLParagraphElement;
const userList = document.getElementById('user-list') as HTMLUListElement;
const userItemTemplate = document.getElementById('user-item') as HTMLTemplateElement;
const nameInput = document.getElementById('user-name') as HTMLInputElement;
const nameError = document.getElementById('name-error') as HTMLParagraphElement;
const emailInput = document.getElementById('user-email') as HTMLInputElement;
const emailError = document.getElementById('email-error') as HTMLParagraphElement;
const submitButton = document.getElementById('submit-user') as HTMLButtonElement;

export function render(state: State): void {
  const error = state.actionError ?? state.loadError;
  errorBanner.textContent = error ?? '';
  errorBanner.hidden = error === null;

  renderList(state);
  renderForm(state);
}

function renderList(state: State): void {
  searchField.classList.toggle('is-loading', state.isLoading);

  if (!state.isLoading) {
    listStatus.textContent =
      state.loadError === null && state.users.length === 0 ? 'Пользователи не найдены' : '';
  }
  userList.replaceChildren(
    ...state.users.map((user) => createUserItem(user, state.deletingIds.includes(user.id)))
  );
}

function createUserItem(
  user: User,
  isDeleting: boolean
): HTMLLIElement {
  const item = userItemTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
  item.querySelector('strong')!.textContent = user.name;
  item.querySelector('.user-email')!.textContent = user.email;

  const deleteButton = item.querySelector('button')!;
  deleteButton.dataset.userId = String(user.id);
  deleteButton.disabled = isDeleting;
  return item;
}

function renderForm(state: State): void {
  renderFieldError(nameInput, nameError, state.formErrors.name);
  renderFieldError(emailInput, emailError, state.formErrors.email);
  submitButton.disabled = state.isSubmitting;
}

function renderFieldError(
  input: HTMLInputElement,
  message: HTMLParagraphElement,
  error: string | undefined
): void {
  message.textContent = error ?? '';
  input.classList.toggle('invalid', Boolean(error));
}
