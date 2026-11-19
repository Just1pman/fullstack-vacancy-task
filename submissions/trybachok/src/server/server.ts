import { createApp } from './app.ts';
import { loadUsersFile } from './users-file.ts';

const host = process.env.HOST?.trim();
const portValue = process.env.PORT?.trim() ?? '';
const publicDir = process.env.PUBLIC_DIR?.trim();
const usersFile = process.env.USERS_FILE?.trim();

if (!host || !publicDir || !usersFile) {
  console.error('Укажите HOST, PUBLIC_DIR и USERS_FILE в настройках окружения.');
  process.exit(1);
}

const port = Number(portValue);
if (!/^\d{1,5}$/.test(portValue) || port < 1 || port > 65535) {
  console.error('PORT должен быть целым числом от 1 до 65535.');
  process.exit(1);
}

const initialUsers = await loadUsersFile(usersFile).catch((error: unknown) => {
  console.error('Не удалось загрузить начальных пользователей.', error instanceof Error ? error.message : error);
  process.exit(1);
});

createApp(publicDir, initialUsers).listen(port, host, () => {
  const urlHost = host.includes(':') ? `[${host}]` : host;
  console.log(`Откройте в браузере: http://${urlHost}:${port}`);
});
