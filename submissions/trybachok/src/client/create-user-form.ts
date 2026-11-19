import { UsersApiError } from './api.ts';
import { findElement } from './dom.ts';
import { validateUserFields } from '../shared/user-fields.ts';
import type { NewUser } from '../shared/users.ts';

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

export function bindCreateUserForm(
  create: (user: NewUser) => Promise<void>,
  onStatus: (message: string) => void,
  onCreated: () => void,
) {
  const form = findElement<HTMLFormElement>('user-form');
  const fields = findElement<HTMLFieldSetElement>('user-fields');
  const nameInput = findElement<HTMLInputElement>('name');
  const emailInput = findElement<HTMLInputElement>('email');
  const formError = findElement('form-error');
  const createButton = findElement<HTMLButtonElement>('create');

  async function createUser() {
    if (fields.disabled) return;
    const input = { name: nameInput.value, email: emailInput.value };
    formError.textContent = '';
    const errors = validateUserFields(input.name, input.email);
    setValidationHint(nameInput, errors.name);
    setValidationHint(emailInput, errors.email);
    if (!form.reportValidity()) return;

    onStatus('Добавляем пользователя…');
    fields.disabled = true;
    createButton.textContent = 'Добавляем…';

    let hasServerFieldErrors = false;
    try {
      await create(input);
      form.reset();
      onCreated();
    } catch (error) {
      onStatus('');
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

  form.noValidate = true;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void createUser();
  });
  nameInput.addEventListener('input', () => setFieldValidity(nameInput));
  emailInput.addEventListener('input', () => setFieldValidity(emailInput));
  fields.disabled = false;
}
