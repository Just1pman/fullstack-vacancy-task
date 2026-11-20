import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createUser, deleteUser, GENERIC_MESSAGE, getUsers } from "./api.js";

const user = { name: "New User", email: "new@example.com" };
const savedUser = { id: 1, ...user };

test("getUsers without a name omits the query string", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json([savedUser]));
  const controller = new AbortController();

  const result = await getUsers("", controller.signal);

  const [path, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(path, "/api/users");
  assert.equal(init?.signal, controller.signal);
  assert.deepEqual(result, [savedUser]);
});

test("getUsers encodes the name", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json([savedUser]));

  const result = await getUsers("a&b");

  assert.equal(fetchMock.mock.calls[0].arguments[0], "/api/users?name=a%26b");
  assert.deepEqual(result, [savedUser]);
});

test("createUser sends JSON with the content type header", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(savedUser));

  const result = await createUser(user);

  const [path, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(path, "/api/users");
  assert.equal(init?.method, "POST");
  assert.deepEqual(init?.headers, { "Content-Type": "application/json" });
  assert.equal(init?.body, JSON.stringify(user));
  assert.deepEqual(result, savedUser);
});

test("API validation errors preserve status and fields", async (t) => {
  const fields = { name: "Укажите имя" };
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: { code: "VALIDATION_ERROR", message: "Проверьте введённые данные", fields },
  }, { status: 400 }));

  await assert.rejects(createUser(user), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.message, "Проверьте введённые данные");
    assert.deepEqual(error.fields, fields);
    return true;
  });
});

test("network failures become ApiError", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(getUsers(""), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.code, "NETWORK_ERROR");
    return true;
  });
});

test("HTML error responses use the generic message", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Секретная ошибка</html>", {
    status: 500,
    headers: { "Content-Type": "text/html" },
  }));

  await assert.rejects(getUsers(""), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 500);
    assert.equal(error.code, "HTTP_ERROR");
    assert.equal(error.message, GENERIC_MESSAGE);
    return true;
  });
});

test("deleteUser resolves undefined for 204", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));

  const result = await deleteUser(1);

  const [path, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(path, "/api/users/1");
  assert.equal(init?.method, "DELETE");
  assert.equal(result, undefined);
});

test("abort errors pass through unchanged", async (t) => {
  const abortError = new DOMException("Aborted", "AbortError");
  t.mock.method(globalThis, "fetch", async () => {
    throw abortError;
  });

  await assert.rejects(getUsers(""), (error) => error === abortError);
});
