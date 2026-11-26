const APP_HOST = "127.0.0.1";
const APP_PORT = Number(process.env.APP_PORT ?? 3000);

if (!Number.isInteger(APP_PORT) || APP_PORT < 1 || APP_PORT > 65535) {
  throw new Error("Порт должен быть целым числом от 1 до 65535");
}

export const appConfig = {
  APP_HOST,
  APP_PORT,
  APP_BASE_URL: `http://${APP_HOST}:${APP_PORT}`,
  MAX_BODY_SIZE: 16 * 1024,
};
