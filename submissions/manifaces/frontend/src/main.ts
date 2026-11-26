import { UsersStore } from "./users.store";
import { initUserForm } from "./views/user-form/user-form";
import { initUsersPanel } from "./views/users-panel/users-panel";
import { initUsersSearch } from "./views/users-search/users-search";

const store = new UsersStore();

initUsersSearch(store);
initUserForm(store);
initUsersPanel(store);

void store.load();
