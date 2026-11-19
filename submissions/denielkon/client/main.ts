import {
  clearFieldError,
  createUser,
  deleteUser,
  loadUsers,
  setSearch
} from './actions.js';
import { subscribe } from './store.js';
import { render } from './view.js';

const searchInput = document.getElementById('search') as HTMLInputElement;
const userForm = document.getElementById('user-form') as HTMLFormElement;
const nameInput = document.getElementById('user-name') as HTMLInputElement;
const userList = document.getElementById('user-list') as HTMLUListElement;

searchInput.addEventListener('input', () => setSearch(searchInput.value));

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(userForm);
  const isCreated = await createUser({
    name: String(formData.get('name')),
    email: String(formData.get('email')),
  });
  if (isCreated) {
    userForm.reset();
    nameInput.focus();
  }
});

userForm.addEventListener('input', (event) => {
  const { name } = event.target as HTMLInputElement;
  if (name === 'name' || name === 'email') {
    clearFieldError(name);
  }
});

userList.addEventListener('click', (event) => {
  const deleteButton = (event.target as Element).closest<HTMLButtonElement>('button[data-user-id]');
  if (deleteButton && !deleteButton.disabled && confirm('Удалить пользователя?')) {
    deleteUser(Number(deleteButton.dataset.userId));
  }
});

subscribe(render);
loadUsers();
