import type { ApiError, CreateUserInput, User } from '../shared/api.js';

const USERS_URL = '/api/users';
const LOAD_ERROR = 'Не удалось загрузить список. Обновите страницу.';
const CREATE_ERROR = 'Не удалось добавить пользователя. Повторите попытку.';
const DELETE_ERROR = 'Не удалось удалить пользователя. Повторите попытку.';

const getRequiredElement = <TElement extends Element>(
   selector: string,
): TElement => {
   const element = document.querySelector<TElement>(selector);
   if (!element) throw new Error(`Не найден элемент ${selector}.`);
   return element;
};

const searchInput = getRequiredElement<HTMLInputElement>('#search');
const form = getRequiredElement<HTMLFormElement>('#user-form');
const nameInput = getRequiredElement<HTMLInputElement>('#user-name');
const emailInput = getRequiredElement<HTMLInputElement>('#user-email');
const addButton = getRequiredElement<HTMLButtonElement>('#add-user');
const list = getRequiredElement<HTMLUListElement>('#user-list');
const listStatus = getRequiredElement<HTMLParagraphElement>('#list-status');
const formStatus = getRequiredElement<HTMLParagraphElement>('#form-status');
const deleteStatus = getRequiredElement<HTMLParagraphElement>('#delete-status');

let activeListRequest: AbortController | undefined;

const setStatus = (element: HTMLElement, text: string, isError = false): void => {
   element.textContent = text;
   element.classList.toggle('main__status-error', isError);
};

class ApiResponseError extends Error {}

const showError = (
   element: HTMLElement,
   error: unknown,
   fallback: string,
): void => {
   const message = error instanceof ApiResponseError ? error.message : fallback;
   setStatus(element, message, true);
};

const isApiError = (value: unknown): value is ApiError =>
   typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';

const request = async (
   url: string,
   options?: RequestInit,
): Promise<Response> => {
   const response = await fetch(url, options);
   if (response.ok) return response;

   const body: unknown = await response.json().catch(() => null);
   if (isApiError(body)) throw new ApiResponseError(body.error);
   throw new Error(`HTTP ${response.status}`);
};

const loadUsers = async (): Promise<void> => {
   activeListRequest?.abort();
   const controller = new AbortController();
   activeListRequest = controller;

   const name = searchInput.value.trim();
   const query = new URLSearchParams({ name });
   list.setAttribute('aria-busy', 'true');
   setStatus(listStatus, 'Загрузка пользователей…');

   try {
      const response = await request(USERS_URL + '?' + query, {
         signal: controller.signal,
      });
      const users: User[] = await response.json();
      if (controller.signal.aborted) return;

      renderUsers(users);
      const emptyMessage = name ? 'Пользователь не найден' : 'Пользователей пока нет.';
      setStatus(listStatus, users.length === 0 ? emptyMessage : '');
   } catch (error) {
      if (controller.signal.aborted) return;

      list.replaceChildren();
      showError(listStatus, error, LOAD_ERROR);
   } finally {
      if (!controller.signal.aborted) {
         list.setAttribute('aria-busy', 'false');
      }
   }
};

const removeUser = async (user: User, button: HTMLButtonElement) => {
   button.disabled = true;
   setStatus(deleteStatus, '');

   try {
      await request(USERS_URL + '/' + user.id, { method: 'DELETE' });
      await loadUsers();
   } catch (error) {
      showError(deleteStatus, error, DELETE_ERROR);
   } finally {
      button.disabled = false;
   }
};

const renderUsers = (users: User[]): void => {
   const rows = users.map((user) => {
      const row = document.createElement('li');
      row.className = 'main__user-row';

      const details = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'main__user-name';
      name.textContent = user.name;
      const email = document.createElement('span');
      email.textContent = user.email;
      details.append(name, email);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'main__button main__button-delete';
      button.textContent = 'Удалить';
      button.setAttribute('aria-label', 'Удалить ' + user.name);
      button.addEventListener('click', () => {
         void removeUser(user, button);
      });

      row.append(details, button);
      return row;
   });

   list.replaceChildren(...rows);
};

form.addEventListener('submit', async (event) => {
   event.preventDefault();
   if (addButton.disabled) return;

   const input: CreateUserInput = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
   };
   addButton.disabled = true;
   setStatus(formStatus, 'Добавляем пользователя…');

   try {
      const response = await request(USERS_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(input),
      });
      const user: User = await response.json();
      form.reset();
      setStatus(formStatus, 'Пользователь ' + user.name + ' добавлен.');
      await loadUsers();
   } catch (error) {
      showError(formStatus, error, CREATE_ERROR);
   } finally {
      addButton.disabled = false;
   }
});

searchInput.addEventListener('input', () => {
   setStatus(deleteStatus, '');
   void loadUsers();
});
void loadUsers();
