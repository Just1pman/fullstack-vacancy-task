import type { User } from "../../users.models";
import { ApiError } from "../../users.service";
import type { UsersStore } from "../../users.store";

export const initUsersPanel = (store: UsersStore): void => {
  const panel = document.querySelector<HTMLElement>(".users-panel");
  const list = panel?.querySelector(".users-panel__list");
  const placeholder = panel?.querySelector(".users-panel__placeholder");
  const icon = panel?.querySelector(".users-panel__icon > svg");
  const iconUse = icon?.querySelector("use");
  const text = panel?.querySelector(".users-panel__text");
  const retry = panel?.querySelector<HTMLButtonElement>(".users-panel__retry");
  const template = panel?.querySelector<HTMLTemplateElement>('[data-template="user"]');

  const deleteErrors = new Map<number, string>();

  let renderedUsers: readonly User[] | undefined;
  let loadingTimer: number | undefined;

  const updateRows = (): void => {
    const { deletingIds, loadStatus } = store.getState();

    list?.querySelectorAll<HTMLButtonElement>('[data-action="delete"]')
      .forEach((button) => {
        const id = Number(button.dataset.userId);
        const isDeleting = deletingIds.has(id);
        const error = deleteErrors.get(id) ?? "";
        const row = button.closest(".users-panel__user");

        button.disabled = isDeleting || loadStatus === "loading";

        button.querySelector("use")?.setAttribute("href", isDeleting ? "#icon-loader" : "#icon-delete");

        button.querySelector("svg")?.classList.toggle("spinner", isDeleting);

        row?.querySelector('[data-field="delete-error-text"]')?.replaceChildren(error);

        row?.querySelector(".users-panel__error")?.toggleAttribute("hidden", !error);
      });
  };

  const renderPanel = (): void => {
    const { users, loadStatus, error } = store.getState();

    const isLoading = loadStatus === "loading";
    const showList = !isLoading && error === null && users.length > 0;
    const showRetry = !isLoading && error !== null;

    list?.toggleAttribute("hidden", !showList);
    placeholder?.toggleAttribute("hidden", showList);
    retry?.toggleAttribute("hidden", !showRetry);
    panel?.classList.toggle("users-panel_error", showRetry);

    if (showRetry) deleteErrors.clear();

    if (!isLoading && error === null && renderedUsers !== users) {
      for (const id of deleteErrors.keys()) {
        if (!users.some((user) => user.id === id)) {
          deleteErrors.delete(id);
        }
      }

      if (template) {
        const rows = users.map((user) => {
          const row = document.importNode(template.content, true);

          row.querySelector('[data-field="name"]')?.replaceChildren(user.name);

          row.querySelector('[data-field="email"]')?.replaceChildren(user.email);

          row.querySelector('[data-action="delete"]')?.setAttribute("data-user-id", String(user.id));

          return row;
        });

        list?.replaceChildren(...rows);
      }

      renderedUsers = users;
    }

    if (!showList) {
      const nextIcon = isLoading
        ? "#icon-loader"
        : showRetry
          ? "#icon-error"
          : "#icon-search-empty";

      iconUse?.setAttribute("href", nextIcon);
      icon?.classList.toggle("spinner", isLoading);

      text?.replaceChildren(
        isLoading
          ? "Загрузка пользователей"
          : showRetry
            ? "Не удалось загрузить пользователей"
            : "Пользователи не найдены",
      );
    }

    updateRows();
  };

  const updatePanel = (): void => {
    const { loadStatus } = store.getState();

    retry?.toggleAttribute("disabled", loadStatus !== null);

    if (loadStatus !== "loading") {
      window.clearTimeout(loadingTimer);
      loadingTimer = undefined;

      renderPanel();

      return;
    }

    if (loadingTimer === undefined) {
      loadingTimer = window.setTimeout(renderPanel, 200);
    }

    updateRows();
  };

  list?.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest<HTMLButtonElement>(
      '[data-action="delete"]',
    );

    if (!button || button.disabled) return;

    const id = Number(button.dataset.userId);

    if (store.getState().deletingIds.has(id)) return;

    deleteErrors.delete(id);

    try {
      await store.delete(id);
    } catch (error) {
      const state = store.getState();

      if (
        state.loadStatus !== null ||
        (state.error === null && state.users.some((user) => user.id === id))
      ) {
        deleteErrors.set(
          id,
          error instanceof ApiError
            ? error.message
            : "Не удалось подтвердить удаление пользователя",
        );
      }

      updateRows();
    }
  });

  retry?.addEventListener("click", () => void store.load());

  store.addEventListener("change", updatePanel);

  store.addEventListener("searchchange", () => {
    deleteErrors.clear();
    updateRows();
  });
};
