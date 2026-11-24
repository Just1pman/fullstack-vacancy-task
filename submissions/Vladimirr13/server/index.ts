import { DEFAULT_PORT, HOST, MAX_PORT } from "./config.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
  console.error("PORT должен быть целым числом от 1 до 65535.");
  process.exit(1);
}
const server = createApp();
server.on("error", (error) => {
  console.error(`Не удалось запустить сервер: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, HOST, () => {
  console.log(`Приложение: http://${HOST}:${port}`);
});
