import type { CreateUserInput } from "../../users.models";
import { ApiError } from "../../users.service";
import type { UsersStore } from "../../users.store";

export const initUserForm = (store: UsersStore): void => {
  const app = document.querySelector(".app");
  const toggle = document.querySelector<HTMLButtonElement>(".user-form__toggle");
  const toggleIcon = toggle?.querySelector("use");
  const toggleText = toggle?.querySelector("span");

  const form = document.querySelector<HTMLFormElement>(".user-form");
  const fieldset = form?.querySelector<HTMLFieldSetElement>(".user-form__fields");
  const submit = form?.querySelector<HTMLButtonElement>(".user-form__submit");
  const spinner = submit?.querySelector(".spinner");

  const message = form?.querySelector(".user-form__message");
  const messageIcon = message?.querySelector("use");
  const messageText = message?.querySelector('[data-field="message-text"]');

  form?.querySelectorAll(".user-form__control").forEach((control) => {
    const input = control.querySelector<HTMLInputElement>("input");
    const clear = control.querySelector(".user-form__clear");

    clear?.addEventListener("click", () => {
      if (!input || input.matches(":disabled")) return;

      input.value = "";
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  const setFieldError = (field: keyof CreateUserInput, text = ""): void => {
    const input = form?.querySelector(`[name="${field}"]`);
    const error = form?.querySelector(`#user-${field}-error`);

    input?.classList.toggle("input_error", Boolean(text));
    error?.replaceChildren(text);
    error?.toggleAttribute("hidden", !text);
  };

  const showMessage = (text: string, isError = false): void => {
    message?.classList.toggle("message_success", !isError);
    message?.classList.toggle("message_error", isError);

    messageIcon?.setAttribute("href", isError ? "#icon-error" : "#icon-success");

    messageText?.replaceChildren(text);
    message?.toggleAttribute("hidden", false);
  };

  const hideSuccess = (): void => {
    if (message?.classList.contains("message_success")) {
      message.toggleAttribute("hidden", true);
    }
  };

  const setLoading = (isLoading: boolean): void => {
    fieldset?.toggleAttribute("disabled", isLoading);
    toggle?.toggleAttribute("disabled", isLoading);
    submit?.classList.toggle("button_loading", isLoading);
    spinner?.toggleAttribute("hidden", !isLoading);
  };

  toggle?.addEventListener("click", () => {
    const isOpen = Boolean(form?.hidden);

    form?.toggleAttribute("hidden", !isOpen);

    toggle.classList.toggle("button_primary", !isOpen);
    toggle.classList.toggle("button_secondary", isOpen);

    toggleIcon?.setAttribute("href", isOpen ? "#icon-close" : "#icon-plus");

    toggleText?.replaceChildren(isOpen ? "Скрыть форму" : "Добавить");

    if (!isOpen) message?.toggleAttribute("hidden", true);
  });

  form?.querySelector("#user-name")?.addEventListener("input", () => {
    setFieldError("name");
    message?.toggleAttribute("hidden", true);
  });

  form?.querySelector("#user-email")?.addEventListener("input", () => {
    setFieldError("email");
    message?.toggleAttribute("hidden", true);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (fieldset?.disabled) return;

    const data = new FormData(form);

    hideSuccess();

    setLoading(true);

    try {
      await store.create({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
      });

      form.reset();
      setFieldError("name");
      setFieldError("email");
      showMessage("Пользователь успешно добавлен");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        (error.errors?.name || error.errors?.email)
      ) {
        setFieldError("name", error.errors.name);
        setFieldError("email", error.errors.email);
        
        message?.toggleAttribute("hidden", true);
      } else {
        setFieldError("name");
        setFieldError("email");

        showMessage(
          error instanceof ApiError
            ? error.message
            : "Не удалось создать пользователя",
          true,
        );
      }
    } finally {
      setLoading(false);
    }
  });

  app?.addEventListener("input", hideSuccess);

  app?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      hideSuccess();
    }
  });
};
