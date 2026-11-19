import assert from "node:assert/strict";
import { request } from "node:http";
import net from "node:net";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createApp } from "./app.js";
import type { User } from "./store.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

describe("API", () => {
  let server: ReturnType<typeof createApp>;
  let baseUrl: string;

  beforeEach(async () => {
    server = createApp();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const postJson = (body: unknown) =>
    fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const readError = async (response: Response) => (await response.json()) as ErrorBody;

  const rawRequest = (message: string | Buffer) =>
    new Promise<string>((resolve, reject) => {
      const socket = net.connect(Number(new URL(baseUrl).port), "127.0.0.1", () => {
        socket.write(message);
      });
      const chunks: Buffer[] = [];
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      socket.on("error", reject);
    });

  it("returns ten seeded users", async () => {
    const response = await fetch(`${baseUrl}/api/users`);
    const users = (await response.json()) as User[];

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(users.length, 10);
    assert.deepEqual(users[0], {
      id: 1,
      name: "Alex Johnson",
      email: "alex.johnson@example.com",
    });
  });

  it("searches names case-insensitively and returns empty results", async () => {
    const foundResponse = await fetch(`${baseUrl}/api/users?name=%20aLeX%20`);
    assert.equal(foundResponse.status, 200);
    const found = (await foundResponse.json()) as User[];
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "Alex Johnson");

    const emptyResponse = await fetch(`${baseUrl}/api/users?name=nobody`);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), []);
  });

  it("finds seeded users regardless of search case", async () => {
    for (const [query, name] of [["MARIA", "Maria Petrova"], ["smith", "John Smith"]]) {
      const response = await fetch(`${baseUrl}/api/users?name=${query}`);
      const users = (await response.json()) as User[];
      assert.equal(response.status, 200);
      assert.deepEqual(users.map((user) => user.name), [name]);
    }
  });

  it("creates a user and returns it from GET", async () => {
    const response = await postJson({ name: "  New User  ", email: " NEW@EXAMPLE.COM " });
    const user = (await response.json()) as User;

    assert.equal(response.status, 201);
    assert.deepEqual(user, { id: 11, name: "New User", email: "new@example.com" });

    const listResponse = await fetch(`${baseUrl}/api/users?name=New%20User`);
    assert.deepEqual(await listResponse.json(), [user]);
  });

  it("returns field validation errors", async () => {
    const response = await postJson({ name: " ", email: "invalid" });
    const body = await readError(response);

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.message, "Проверьте введённые данные");
    assert.deepEqual(body.error.fields, {
      name: "Укажите имя",
      email: "Некорректный email",
    });
  });

  it("rejects an array body without field errors", async () => {
    const response = await postJson([]);
    const body = await readError(response);

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.message, "Тело запроса должно быть JSON-объектом");
    assert.equal(body.error.fields, undefined);
  });

  it("rejects an empty body as invalid JSON", async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    const body = await readError(response);

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_JSON");
  });

  it("rejects invalid UTF-8 as invalid JSON", async () => {
    const body = Buffer.concat([
      Buffer.from('{"name":"'),
      Buffer.from([0xff]),
      Buffer.from('","email":"new@example.com"}'),
    ]);
    const response = await rawRequest(
      Buffer.concat([
        Buffer.from(
          `POST /api/users HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`,
        ),
        body,
      ]),
    );

    assert.match(response, /^HTTP\/1\.1 400 /);
    assert.match(response, /"code":"INVALID_JSON"/);
  });

  it("rejects a malformed request target", async () => {
    const response = await rawRequest("GET //[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");

    assert.match(response, /^HTTP\/1\.1 400 /);
    assert.match(response, /"code":"BAD_REQUEST"/);
  });

  it("rejects duplicate emails regardless of case", async () => {
    const response = await postJson({ name: "Other Alex", email: " ALEX.JOHNSON@EXAMPLE.COM " });
    const body = await readError(response);

    assert.equal(response.status, 409);
    assert.equal(body.error.code, "EMAIL_TAKEN");
    assert.equal(body.error.message, "Пользователь с таким email уже есть");
    assert.deepEqual(body.error.fields, { email: "Пользователь с таким email уже есть" });
  });

  it("rejects unsupported media types", async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    const body = await readError(response);

    assert.equal(response.status, 415);
    assert.equal(body.error.code, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 413 for a payload around 20 KB", async () => {
    const response = await postJson({
      name: "a".repeat(20 * 1024),
      email: "large@example.com",
    });
    const body = await readError(response);

    assert.equal(response.status, 413);
    assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
  });

  it("returns 413 for a chunked payload over 10 KB", { timeout: 5000 }, async () => {
    const status = await new Promise<number>((resolve) => {
      const req = request(
        `${baseUrl}/api/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Transfer-Encoding": "chunked",
          },
        },
        (res) => {
          res.resume();
          req.destroy();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", () => {});

      for (let size = 0; size <= 10 * 1024; size += 1024) {
        req.write("a".repeat(1024));
      }
    });

    assert.equal(status, 413);
  });

  it("rejects malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: "{broken",
    });
    const body = await readError(response);

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_JSON");
  });

  it("deletes a user and then returns 404", async () => {
    const deleted = await fetch(`${baseUrl}/api/users/1`, { method: "DELETE" });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), "");

    const listResponse = await fetch(`${baseUrl}/api/users`);
    const users = (await listResponse.json()) as User[];
    assert.equal(users.some((user) => user.id === 1), false);

    const missing = await fetch(`${baseUrl}/api/users/1`, { method: "DELETE" });
    assert.equal(missing.status, 404);
    assert.equal((await readError(missing)).error.code, "NOT_FOUND");
  });

  it("continues ids after deleting the last seeded user", async () => {
    const deleted = await fetch(`${baseUrl}/api/users/10`, { method: "DELETE" });
    assert.equal(deleted.status, 204);

    const first = await postJson({ name: "Eleventh User", email: "eleventh@example.com" });
    const second = await postJson({ name: "Twelfth User", email: "twelfth@example.com" });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(((await first.json()) as User).id, 11);
    assert.equal(((await second.json()) as User).id, 12);
  });

  it("rejects an invalid id", async () => {
    const response = await fetch(`${baseUrl}/api/users/abc`, { method: "DELETE" });
    assert.equal(response.status, 400);
    assert.equal((await readError(response)).error.code, "INVALID_ID");
  });

  it("supports HEAD for the users list with the GET Content-Length", async () => {
    const getResponse = await fetch(`${baseUrl}/api/users`);
    const response = await fetch(`${baseUrl}/api/users`, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.ok(Number(getResponse.headers.get("content-length")) > 0);
    assert.equal(response.headers.get("content-length"), getResponse.headers.get("content-length"));
  });

  it("returns 405 and Allow for unsupported methods", async () => {
    const response = await fetch(`${baseUrl}/api/users`, { method: "PUT" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD, POST");
    assert.equal((await readError(response)).error.code, "METHOD_NOT_ALLOWED");
  });

  it("returns 405 and Allow for DELETE on the users list", async () => {
    const response = await fetch(`${baseUrl}/api/users`, { method: "DELETE" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD, POST");
  });

  it("returns 405 and Allow for POST on the entry point", async () => {
    const response = await fetch(`${baseUrl}/`, { method: "POST" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  });

  it("returns 405 and Allow DELETE for GET on a user", async () => {
    const response = await fetch(`${baseUrl}/api/users/1`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "DELETE");
  });

  it("sets nosniff on API responses", async () => {
    const response = await fetch(`${baseUrl}/api/users`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  it("returns JSON for unknown API paths", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal((await readError(response)).error.code, "NOT_FOUND");
  });

  it("returns JSON 404 for the API root without a slash", async () => {
    const response = await fetch(`${baseUrl}/api`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal((await readError(response)).error.code, "NOT_FOUND");
  });

  it("serves the HTML entry point", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  });

  it("serves static assets with their content types", async () => {
    const files = {
      "/index.html": "text/html",
      "/style.css": "text/css",
      "/app.js": "text/javascript",
      "/api.js": "text/javascript",
    };
    for (const [path, contentType] of Object.entries(files)) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type")?.split(";", 1)[0], contentType);
    }
  });

  it("serves HEAD with Content-Length and without a body", async () => {
    const response = await fetch(`${baseUrl}/`, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.ok(Number(response.headers.get("content-length")) > 0);
    assert.equal(await response.text(), "");
  });

  it("does not serve files through traversal", async () => {
    const response = await fetch(baseUrl + "/..%2fserver%2fapp.js");
    assert.equal(response.status, 404);
  });

  it("does not serve paths with null bytes", async () => {
    const response = await fetch(baseUrl + "/%00.js");
    assert.equal(response.status, 404);
  });

  it("does not serve files below a file path", async () => {
    const response = await fetch(`${baseUrl}/style.css/app.js`);
    assert.equal(response.status, 404);
  });
});
