import { api } from "./api.js";
import { createUsersController } from "./users-controller.js";
import { createView } from "./view.js";
import { createNotifications } from "./notifications.js";

const view = createView(document);
const notifications = createNotifications(document);
const controller = createUsersController({ api, view, notifications });

view.bind(controller);
controller.loadUsers();
