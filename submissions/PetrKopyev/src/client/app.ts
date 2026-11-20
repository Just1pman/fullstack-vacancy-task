import {
  ApiError,
  GENERIC_MESSAGE,
  createUser,
  deleteUser,
  getUsers,
  type User,
} from "./api.js";
import { createLoader, type LoaderState } from "./loader.js";
import { createToaster } from "./toast.js";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Не найден элемент #${id}`);
  return element as T;
}

const form = getElement<HTMLFormElement>("user-form");
const formFields = getElement<HTMLFieldSetElement>("form-fields");
const nameInput = getElement<HTMLInputElement>("name");
const emailInput = getElement<HTMLInputElement>("email");
const nameError = getElement<HTMLParagraphElement>("name-error");
const emailError = getElement<HTMLParagraphElement>("email-error");
const formError = getElement<HTMLParagraphElement>("form-error");
const addButton = getElement<HTMLButtonElement>("add-button");
const searchInput = getElement<HTMLInputElement>("search");
const clearButton = getElement<HTMLButtonElement>("search-clear");
const searchStatus = getElement<HTMLParagraphElement>("search-status");
const listError = getElement<HTMLParagraphElement>("list-error");
const statusBox = getElement<HTMLDivElement>("status");
const statusMessage = getElement<HTMLParagraphElement>("status-message");
const retryButton = getElement<HTMLButtonElement>("retry-button");
const userList = getElement<HTMLUListElement>("users");
const dialog = getElement<HTMLDialogElement>("confirm-dialog");
const dialogText = getElement<HTMLParagraphElement>("dialog-text");
const trashIcon = getElement<HTMLTemplateElement>("trash-icon");
const closeIcon = getElement<HTMLTemplateElement>("close-icon");
const toasts = getElement<HTMLDivElement>("toasts");

const showToast = createToaster(toasts, closeIcon, () => searchInput.focus());
let searchTimer = 0;
const deletingIds = new Set<number>();
let pendingUser: User | null = null;
let pressedOnBackdrop = false;

function showStatus(kind: "loading" | "empty" | "error" | "none", message = "") {
  statusBox.hidden = kind === "none";
  statusBox.dataset.kind = kind;
  retryButton.hidden = kind !== "error";

  if (kind === "loading") statusMessage.textContent = "Загрузка…";
  if (kind === "empty") statusMessage.textContent = "Пользователи не найдены";
  if (kind === "error") statusMessage.textContent = message;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return GENERIC_MESSAGE;
}

function clearListError() {
  listError.textContent = "";
}

function showListError(text: string) {
  listError.textContent = text;
}

function setDeleteDisabled(id: number, disabled: boolean, name: string) {
  const button = userList.querySelector<HTMLButtonElement>(`button[data-id="${id}"]`);
  if (!button) return;
  button.disabled = disabled;
  button.title = disabled ? "Удаляем…" : "Удалить";
  button.setAttribute("aria-label", disabled ? `Удаляем ${name}…` : `Удалить ${name}`);
}

function renderUsers(users: User[]) {
  const active = document.activeElement;
  const focusedId =
    active instanceof HTMLButtonElement && userList.contains(active) ? active.dataset.id : undefined;

  const items = users.map((user) => {
    const item = document.createElement("li");
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const email = document.createElement("span");
    const button = document.createElement("button");
    const isDeleting = deletingIds.has(user.id);

    details.className = "user-details";
    name.className = "user-name";
    name.textContent = user.name;
    email.className = "user-email";
    email.textContent = user.email;
    button.type = "button";
    button.className = "icon-button";
    button.title = isDeleting ? "Удаляем…" : "Удалить";
    button.append(trashIcon.content.cloneNode(true));
    button.dataset.id = String(user.id);
    button.disabled = isDeleting;
    button.setAttribute("aria-label", isDeleting ? `Удаляем ${user.name}…` : `Удалить ${user.name}`);
    button.addEventListener("click", () => {
      confirmDelete(user);
    });

    details.replaceChildren(name, email);
    item.replaceChildren(details, button);
    return item;
  });

  userList.replaceChildren(...items);
  if (focusedId) {
    userList.querySelector<HTMLButtonElement>(`button[data-id="${focusedId}"]`)?.focus();
  }
  showStatus(users.length === 0 ? "empty" : "none");
}

function renderLoaderState(state: LoaderState) {
  if (state.kind === "loading") {
    userList.setAttribute("aria-busy", "true");
    searchStatus.textContent = "";
    clearListError();
    if (userList.childElementCount === 0) showStatus("loading");
    return;
  }

  userList.removeAttribute("aria-busy");
  if (state.kind === "ready") {
    renderUsers(state.users);
    searchStatus.textContent =
      state.name && state.users.length > 0 ? `Найдено пользователей: ${state.users.length}` : "";
    return;
  }

  userList.replaceChildren();
  searchStatus.textContent = "";
  showStatus("error", errorMessage(state.error));
}

const loader = createLoader(getUsers, renderLoaderState);

function loadUsers(): Promise<void> {
  return loader.load(searchInput.value.trim());
}

function clearFormErrors() {
  nameError.textContent = "";
  emailError.textContent = "";
  nameInput.removeAttribute("aria-invalid");
  emailInput.removeAttribute("aria-invalid");
  formError.textContent = "";
}

async function handleSubmit() {
  clearFormErrors();
  formFields.disabled = true;
  addButton.textContent = "Добавляем…";
  const queryAtSubmit = searchInput.value;
  let focusTarget: HTMLElement = nameInput;

  try {
    const user = await createUser({ name: nameInput.value, email: emailInput.value });
    showToast(`Пользователь ${user.name} добавлен`);
    form.reset();
    if (searchInput.value === queryAtSubmit) searchInput.value = "";
    window.clearTimeout(searchTimer);
    void loadUsers();
  } catch (error) {
    if (error instanceof ApiError && error.fields) {
      if (error.fields.name) {
        nameError.textContent = error.fields.name;
        nameInput.setAttribute("aria-invalid", "true");
      }
      if (error.fields.email) {
        emailError.textContent = error.fields.email;
        emailInput.setAttribute("aria-invalid", "true");
      }
      if (!error.fields.name && error.fields.email) focusTarget = emailInput;
    } else {
      formError.textContent = errorMessage(error);
      focusTarget = addButton;
    }
  } finally {
    formFields.disabled = false;
    addButton.textContent = "Добавить";
  }

  const active = document.activeElement;
  if (active === document.body || form.contains(active)) focusTarget.focus();
}

function neighborIds(
  item: HTMLLIElement | null | undefined,
  direction: "nextElementSibling" | "previousElementSibling",
): number[] {
  const ids: number[] = [];
  let sibling = item?.[direction];
  while (sibling) {
    const id = sibling.querySelector<HTMLButtonElement>("button[data-id]")?.dataset.id;
    if (id !== undefined) ids.push(Number(id));
    sibling = sibling[direction];
  }
  return ids;
}

function restoreDeleteFocus(
  id: number,
  deleteButton: HTMLButtonElement | null,
  removed: boolean,
  nextIds: number[],
  prevIds: number[],
) {
  const active = document.activeElement;
  if (active !== document.body && active !== deleteButton) return;
  if (!removed) {
    userList.querySelector<HTMLButtonElement>(`button[data-id="${id}"]`)?.focus();
    return;
  }

  for (const candidateId of [...nextIds, ...prevIds]) {
    const target = userList.querySelector<HTMLButtonElement>(`button[data-id="${candidateId}"]`);
    if (target) {
      target.focus();
      return;
    }
  }
  searchInput.focus();
}

async function handleDelete(user: User) {
  const id = user.id;
  if (deletingIds.has(id)) return;
  const deleteButton = userList.querySelector<HTMLButtonElement>(`button[data-id="${id}"]`);
  const item = deleteButton?.closest("li");
  const nextIds = neighborIds(item, "nextElementSibling");
  const prevIds = neighborIds(item, "previousElementSibling");
  let removed = false;

  deletingIds.add(id);
  setDeleteDisabled(id, true, user.name);
  clearListError();

  try {
    await deleteUser(id);
    removed = true;
    showToast(`Пользователь ${user.name} удалён`, "danger");
    await loadUsers();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      removed = true;
      await loadUsers();
      showListError("Пользователь уже удалён");
    } else {
      showListError(errorMessage(error));
    }
  } finally {
    deletingIds.delete(id);
    setDeleteDisabled(id, false, user.name);
  }

  restoreDeleteFocus(id, deleteButton, removed, nextIds, prevIds);
}

function confirmDelete(user: User) {
  pendingUser = user;
  const name = document.createElement("strong");
  name.textContent = user.name;
  dialogText.replaceChildren("Пользователь ", name, " будет удалён без возможности восстановления.");
  dialog.returnValue = "";
  dialog.showModal();
}

dialog.addEventListener("close", () => {
  if (dialog.returnValue === "confirm" && pendingUser !== null) void handleDelete(pendingUser);
  else if (document.activeElement === document.body) searchInput.focus();
  pendingUser = null;
});

dialog.addEventListener("mousedown", (event) => {
  pressedOnBackdrop = event.target === dialog;
});

dialog.addEventListener("click", (event) => {
  if (pressedOnBackdrop && event.target === dialog) dialog.close();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleSubmit();
});

searchInput.addEventListener("input", () => {
  searchStatus.textContent = "";
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    void loadUsers();
  }, 300);
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  window.clearTimeout(searchTimer);
  searchInput.focus();
  void loadUsers();
});

retryButton.addEventListener("click", async () => {
  window.clearTimeout(searchTimer);
  const shouldRestoreFocus = document.activeElement === retryButton;
  await loadUsers();
  const active = document.activeElement;
  if (!shouldRestoreFocus || (active !== document.body && active !== retryButton)) return;
  (statusBox.dataset.kind === "error" ? retryButton : searchInput).focus();
});

void loadUsers();
