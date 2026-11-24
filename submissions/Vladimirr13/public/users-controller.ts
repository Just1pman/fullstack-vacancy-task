import type {
  UsersApi,
  UsersView,
  Notifications,
  UsersActions,
} from "./types.js";

const SEARCH_DEBOUNCE_MS = 250;
import { validateUserFields } from "../contracts/user-validation.js";
import { ApiError } from "./api.js";
import type { User, UserInput } from "../contracts/user.js";

interface ControllerOptions {
  api: UsersApi;
  view: UsersView;
  notifications: Notifications;
  timers?: Pick<typeof globalThis, "setTimeout" | "clearTimeout">;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Неизвестная ошибка.";

export function createUsersController({
  api,
  view,
  notifications,
  timers = globalThis,
}: ControllerOptions): UsersActions {
  let users: User[] = [];
  let search = "";
  let submitting = false;
  let controller: AbortController | undefined;
  let requestVersion = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const deleting = new Set<number>();

  const render = () => view.renderUsers(users, deleting);

  async function loadUsers() {
    timers.clearTimeout(searchTimer);
    controller?.abort();
    controller = new AbortController();
    const version = ++requestVersion;
    view.setListLoading();
    try {
      const result = await api.list(search, controller.signal);
      if (version !== requestVersion) return;
      users = result;
      render();
      view.setListResult(users.length, search);
    } catch (error) {
      if (
        (error instanceof Error && error.name === "AbortError") ||
        version !== requestVersion
      )
        return;
      users = [];
      render();
      view.setListError(errorMessage(error));
    } finally {
      if (version === requestVersion) view.setListBusy(false);
    }
  }

  function setSearch(value: string) {
    search = value.trim();
    timers.clearTimeout(searchTimer);
    controller?.abort();
    requestVersion++;
    view.setSearchPending();
    searchTimer = timers.setTimeout(loadUsers, SEARCH_DEBOUNCE_MS);
  }

  async function deleteUser(id: number) {
    const user = users.find((user) => user.id === id);
    if (!user || deleting.has(id)) return;
    deleting.add(id);
    view.setActionError("");
    notifications.hide();
    view.setDeleting(id, true);
    try {
      await api.remove(id);
      users = users.filter((user) => user.id !== id);
      render();
      notifications.show(`Пользователь ${user.name} удалён.`);
      await loadUsers();
    } catch (error) {
      view.setActionError(
        `Не удалось удалить пользователя. ${errorMessage(error)}`
      );
    } finally {
      deleting.delete(id);
      view.setDeleting(id, false);
    }
  }

  async function createUser(input: UserInput) {
    if (submitting) return;
    view.clearFormErrors();
    notifications.hide();
    const fields = validateUserFields(input);
    if (Object.keys(fields).length) {
      view.setFormError("Проверьте выделенные поля.", fields);
      view.focusFirstInvalid();
      return;
    }
    submitting = true;
    view.setSubmitting(true);
    let created = false;
    try {
      const user = await api.add(input);
      created = true;
      view.resetForm();
      notifications.show(
        `Пользователь ${user.name} добавлен.${
          search ? " Список отображается с учётом поиска." : ""
        }`
      );
      await loadUsers();
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.fields?.name || error.fields?.email)
      ) {
        view.setFormError(errorMessage(error), error.fields);
      } else {
        notifications.show(errorMessage(error), "error");
      }
    } finally {
      submitting = false;
      view.setSubmitting(false);
      if (created) view.focusName();
      else view.focusFirstInvalid();
    }
  }

  return { loadUsers, setSearch, deleteUser, createUser };
}
