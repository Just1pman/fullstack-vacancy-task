import { createApp } from './app.ts';

const host = process.env.HOST?.trim();
const portValue = process.env.PORT?.trim() ?? '';
const publicDir = process.env.PUBLIC_DIR?.trim();

if (!host || !publicDir) {
  console.error('Укажите HOST и PUBLIC_DIR в настройках окружения.');
  process.exit(1);
}

const port = Number(portValue);
if (!/^\d{1,5}$/.test(portValue) || port < 1 || port > 65535) {
  console.error('PORT должен быть целым числом от 1 до 65535.');
  process.exit(1);
}

createApp(publicDir).listen(port, host, () => {
  console.log(`Сервер запущен. HOST=${host}, PORT=${port}`);
});
