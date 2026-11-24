export const DEFAULT_PORT = 3000;
export const HOST = "127.0.0.1";
export const MAX_PORT = 65535;
export const MAX_BODY_BYTES = 16 * 1024;
export const JSON_CONTENT_TYPE = "application/json";
export const USER_ITEM_PATH = /^\/api\/users\/([^/]+)$/u;

export type HttpMethod = "GET" | "HEAD" | "POST" | "DELETE";
export type ErrorStatus = 400 | 404 | 405 | 413 | 415 | 500;
export type JsonStatus = 200 | 201 | ErrorStatus;

interface StaticAsset {
  readonly file: string;
  readonly contentType: string;
}
const JAVASCRIPT = "text/javascript; charset=utf-8";

export const STATIC_ASSETS: ReadonlyMap<string, StaticAsset> = new Map([
  ["/", { file: "index.html", contentType: "text/html; charset=utf-8" }],
  [
    "/styles.css",
    { file: "styles.css", contentType: "text/css; charset=utf-8" },
  ],
  ...["app", "api", "users-controller", "view", "notifications"].map(
    (name) =>
      [`/${name}.js`, { file: `${name}.js`, contentType: JAVASCRIPT }] as const
  ),
  ...["user", "user-validation"].map(
    (name) =>
      [
        `/contracts/${name}.js`,
        { file: `../contracts/${name}.js`, contentType: JAVASCRIPT },
      ] as const
  ),
]);
