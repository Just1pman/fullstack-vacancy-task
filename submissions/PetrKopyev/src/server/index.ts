import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Некорректный PORT: ${process.env.PORT}`);
  process.exit(1);
}

const server = createApp();
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

server.listen(port, () => {
  const { port } = server.address() as AddressInfo;
  console.log(`Server: http://localhost:${port}`);
});
