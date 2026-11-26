import type { UsersStore } from "../../users.store";

export const initUsersSearch = (store: UsersStore): void => {
  const search = document.querySelector<HTMLElement>(".users-search");
  const input = search?.querySelector<HTMLInputElement>(".users-search__input");
  const icon = search?.querySelector(".users-search__icon");
  const clear = search?.querySelector<HTMLButtonElement>(".users-search__clear");

  const updateIcons = (hasFocus = search?.matches(":focus-within") ?? false): void => {
    const showClear = hasFocus && Boolean(input?.value);

    icon?.toggleAttribute("hidden", showClear);
    clear?.toggleAttribute("hidden", !showClear);
  };

  input?.addEventListener("input", () => {
    store.search(input.value);
    updateIcons();
  });

  search?.addEventListener("focusin", () => updateIcons(true));

  search?.addEventListener("focusout", ({ relatedTarget }) => {
    updateIcons(relatedTarget instanceof Node && search.contains(relatedTarget));
  });

  clear?.addEventListener("click", () => {
    if (input) {
      input.value = "";
      input.focus();
    }

    store.search("");
    updateIcons();
  });
};
