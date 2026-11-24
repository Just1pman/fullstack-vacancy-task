import type { User, UserInput, FieldErrors } from "../contracts/user.js";
import type { UsersView, UsersActions } from "./types.js";

export function createView(
  document: Document
): UsersView & { bind(controller: UsersActions): void } {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Элемент ${selector} не найден.`);
    return element;
  };
  const form = $<HTMLFormElement>("#create-form");
  const inputs = {
    name: $<HTMLInputElement>("#name"),
    email: $<HTMLInputElement>("#email"),
  };
  const fields = ["name", "email"] as const;
  const list = $("#users");
  const search = $<HTMLInputElement>("#search");

  let formErrors: FieldErrors = {};

  function renderFormErrors() {
    for (const field of fields) {
      if (formErrors[field]) inputs[field].setAttribute("aria-invalid", "true");
      else inputs[field].removeAttribute("aria-invalid");
    }
    const invalid = fields.filter((field) => formErrors[field]);
    const empty = invalid.every((field) => !inputs[field].value.trim());
    const label =
      invalid.length === 2
        ? "имя и email"
        : invalid[0] === "name"
        ? "имя"
        : "email";
    $("#form-error").textContent = invalid.length
      ? `${empty ? "Введите" : "Проверьте"} ${label}.`
      : "";
  }

  function clearFieldError(field: keyof UserInput) {
    delete formErrors[field];
    renderFormErrors();
  }

  function renderUsers(users: readonly User[], deleting: ReadonlySet<number>) {
    const focusedButton = document.activeElement?.closest<HTMLButtonElement>(
      "button[data-user-id]"
    );
    const focusedId =
      focusedButton && list.contains(focusedButton)
        ? focusedButton.dataset.userId
        : null;
    const previousButtons = [
      ...list.querySelectorAll<HTMLButtonElement>("button[data-user-id]"),
    ];
    const previousIndex = focusedButton
      ? previousButtons.indexOf(focusedButton)
      : -1;
    list.replaceChildren();
    for (const user of users) {
      const item = document.createElement("li");
      item.className = "user";
      const info = document.createElement("div");
      info.className = "user-info";
      for (const [key, className] of [
        ["name", "user-name"],
        ["email", "user-email"],
      ] as const) {
        const text = document.createElement("span");
        text.className = className;
        text.textContent = user[key];
        info.append(text);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "delete";
      button.dataset.userId = String(user.id);
      button.textContent = deleting.has(user.id) ? "Удаление…" : "Удалить";
      button.disabled = deleting.has(user.id);
      button.setAttribute("aria-label", `Удалить пользователя ${user.name}`);
      item.append(info, button);
      list.append(item);
    }
    $("#count").textContent = String(users.length);
    if (focusedId) {
      const buttons = [
        ...list.querySelectorAll<HTMLButtonElement>("button[data-user-id]"),
      ];
      const target =
        buttons.find(
          (button) => button.dataset.userId === focusedId && !button.disabled
        ) ??
        buttons
          .slice(Math.max(0, previousIndex))
          .find((button) => !button.disabled) ??
        buttons.findLast((button) => !button.disabled) ??
        search;
      target.focus();
    }
  }

  return {
    renderUsers,
    bind(controller) {
      search.addEventListener("input", () =>
        controller.setSearch(search.value)
      );
      $("#retry").addEventListener("click", controller.loadUsers);
      list.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLButtonElement>(
          "button[data-user-id]"
        );
        if (button && list.contains(button) && !button.disabled) {
          controller.deleteUser(Number(button.dataset.userId));
        }
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        controller.createUser({
          name: inputs.name.value,
          email: inputs.email.value,
        });
      });
      form.addEventListener("input", (event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const field = event.target.name;
        if (field === "name" || field === "email") clearFieldError(field);
      });
    },
    setDeleting(id, pending) {
      const button = list.querySelector<HTMLButtonElement>(
        `button[data-user-id="${id}"]`
      );
      if (!button) return;
      button.disabled = pending;
      button.textContent = pending ? "Удаление…" : "Удалить";
    },
    setListBusy(busy) {
      list.setAttribute("aria-busy", String(busy));
    },
    setListLoading() {
      $("#list-error").hidden = true;
      $("#list-status").textContent = "Загрузка пользователей…";
      list.setAttribute("aria-busy", "true");
    },
    setSearchPending() {
      $("#list-error").hidden = true;
      $("#list-status").textContent = "Поиск…";
      list.setAttribute("aria-busy", "true");
    },
    setListResult(count, query) {
      $("#list-status").textContent = count
        ? ""
        : query
        ? "По вашему запросу никто не найден."
        : "Пользователей пока нет. Добавьте первого.";
    },
    setListError(message) {
      $("#count").textContent = "";
      $("#list-status").textContent = "";
      $(
        "#list-error-message"
      ).textContent = `Не удалось обновить список. ${message}`;
      $("#list-error").hidden = false;
    },
    setActionError(message) {
      $("#action-error").textContent = message;
    },
    clearFormErrors() {
      formErrors = {};
      renderFormErrors();
    },
    setFormError(_message: string, errors?: FieldErrors) {
      formErrors = { ...errors };
      renderFormErrors();
    },
    setSubmitting(pending) {
      $<HTMLButtonElement>("#create-button").disabled = pending;
      $("#create-button").textContent = pending
        ? "Добавление…"
        : "Добавить пользователя";
      inputs.name.disabled = pending;
      inputs.email.disabled = pending;
    },
    resetForm() {
      form.reset();
    },
    focusFirstInvalid() {
      const field = fields.find(
        (key) => inputs[key].getAttribute("aria-invalid") === "true"
      );
      if (field) inputs[field].focus();
    },
    focusName() {
      if (
        document.activeElement === document.body ||
        form.contains(document.activeElement)
      ) {
        inputs.name.focus();
      }
    },
  };
}
