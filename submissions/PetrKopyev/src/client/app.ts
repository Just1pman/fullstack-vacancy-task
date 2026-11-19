import {
  ApiError,
  GENERIC_MESSAGE,
  createUser,
  deleteUser,
  getUsers,
  type User,
} from "./api.js";

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
const listError = getElement<HTMLParagraphElement>("list-error");
const count = getElement<HTMLSpanElement>("count");
const statusBox = getElement<HTMLDivElement>("status");
const statusMessage = getElement<HTMLParagraphElement>("status-message");
const retryButton = getElement<HTMLButtonElement>("retry-button");
const userList = getElement<HTMLUListElement>("users");
const dialog = getElement<HTMLDialogElement>("confirm-dialog");
const dialogText = getElement<HTMLParagraphElement>("dialog-text");
const trashIcon = getElement<HTMLTemplateElement>("trash-icon");
const closeIcon = getElement<HTMLTemplateElement>("close-icon");
const toasts = getElement<HTMLDivElement>("toasts");

let usersController: AbortController | null = null;
let searchTimer = 0;
const deletingIds = new Set<number>();
let pendingUser: User | null = null;
let pressedOnBackdrop = false;

function showToast(message: string, kind: "success" | "danger" = "success") {
  const toast = document.createElement("div");
  const text = document.createElement("span");
  const closeButton = document.createElement("button");
  let timer = 0;
  let dismissed = false;

  toast.className = "toast";
  if (kind === "danger") toast.classList.add("toast-danger");
  text.textContent = message;
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", "Закрыть уведомление");
  closeButton.append(closeIcon.content.cloneNode(true));
  toast.replaceChildren(text, closeButton);
  toasts.append(toast);

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(timer);
    toast.classList.add("toast-leaving");
    window.setTimeout(() => toast.remove(), 200);
  }

  closeButton.addEventListener("click", dismiss);
  timer = window.setTimeout(dismiss, 5000);
}

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
  listError.hidden = true;
}

function showListError(text: string) {
  listError.textContent = text;
  listError.hidden = false;
}

function setDeleteDisabled(id: number, disabled: boolean) {
  const button = userList.querySelector<HTMLButtonElement>(`button[data-id="${id}"]`);
  if (button) button.disabled = disabled;
}

const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  return (
    words.length > 1
      ? [...words[0]][0] + [...words[1]][0]
      : [...words[0]].slice(0, 2).join("")
  ).toUpperCase();
};

const hueOf = (name: string) => {
  let hash = 0;
  for (const char of name) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 2377);
  return ((hash ^ (hash >>> 15)) >>> 0) % 360;
};

function renderUsers(users: User[]) {
  count.textContent = String(users.length);
  count.hidden = false;

  const items = users.map((user) => {
    const item = document.createElement("li");
    const avatar = document.createElement("span");
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const email = document.createElement("span");
    const button = document.createElement("button");

    avatar.className = "avatar";
    avatar.textContent = initials(user.name);
    avatar.setAttribute("aria-hidden", "true");
    avatar.style.setProperty("--hue", String(hueOf(user.name)));
    details.className = "user-details";
    name.className = "user-name";
    name.textContent = user.name;
    email.className = "user-email";
    email.textContent = user.email;
    button.type = "button";
    button.className = "icon-button";
    button.title = "Удалить";
    button.append(trashIcon.content.cloneNode(true));
    button.dataset.id = String(user.id);
    button.disabled = deletingIds.has(user.id);
    button.setAttribute("aria-label", `Удалить ${user.name}`);
    button.addEventListener("click", () => {
      confirmDelete(user);
    });

    details.replaceChildren(name, email);
    item.replaceChildren(avatar, details, button);
    return item;
  });

  userList.replaceChildren(...items);
  showStatus(users.length === 0 ? "empty" : "none");
}

async function loadUsers() {
  clearListError();
  if (usersController) usersController.abort();
  const controller = new AbortController();
  usersController = controller;
  userList.setAttribute("aria-busy", "true");
  if (userList.childElementCount === 0) showStatus("loading");

  try {
    const users = await getUsers(searchInput.value.trim(), controller.signal);
    if (controller !== usersController) return;
    renderUsers(users);
  } catch (error) {
    if (controller !== usersController) return;
    if (error instanceof DOMException && error.name === "AbortError") return;
    userList.replaceChildren();
    count.hidden = true;
    showStatus("error", errorMessage(error));
  } finally {
    if (controller === usersController) userList.removeAttribute("aria-busy");
  }
}

function clearFormErrors() {
  nameError.textContent = "";
  emailError.textContent = "";
  nameInput.removeAttribute("aria-invalid");
  emailInput.removeAttribute("aria-invalid");
  formError.textContent = "";
  formError.hidden = true;
}

async function handleSubmit() {
  clearFormErrors();
  formFields.disabled = true;
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
      formError.hidden = false;
      focusTarget = addButton;
    }
  } finally {
    formFields.disabled = false;
  }

  const active = document.activeElement;
  if (active === document.body || form.contains(active)) focusTarget.focus();
}

async function handleDelete(user: User) {
  const id = user.id;
  if (deletingIds.has(id)) return;
  deletingIds.add(id);
  setDeleteDisabled(id, true);
  clearListError();

  try {
    await deleteUser(id);
    showToast(`Пользователь ${user.name} удалён`, "danger");
    const activeElement = document.activeElement;
    if (
      activeElement === document.body ||
      activeElement?.matches(`button[data-id="${id}"]`)
    ) {
      searchInput.focus();
    }
    void loadUsers();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      void loadUsers();
      showListError("Пользователь уже удалён");
    } else {
      showListError(errorMessage(error));
      setDeleteDisabled(id, false);
    }
  } finally {
    deletingIds.delete(id);
  }
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
  pendingUser = null;
  if (document.activeElement === document.body) searchInput.focus();
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

retryButton.addEventListener("click", () => {
  void loadUsers();
});

void loadUsers();
