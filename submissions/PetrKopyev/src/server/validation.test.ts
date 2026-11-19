import assert from "node:assert/strict";
import { test } from "node:test";
import { parseId, validateNewUser } from "./validation.js";

test("accepts a valid user", () => {
  assert.deepEqual(
    validateNewUser({ name: "Alex Johnson", email: "alex.johnson@example.com" }),
    {
      ok: true,
      value: { name: "Alex Johnson", email: "alex.johnson@example.com" },
    },
  );
});

test("trims name and normalizes email", () => {
  assert.deepEqual(validateNewUser({ name: "  Alex  ", email: "  ALEX@EXAMPLE.COM " }), {
    ok: true,
    value: { name: "Alex", email: "alex@example.com" },
  });
});

test("checks name length boundaries", () => {
  const valid = validateNewUser({ name: "a".repeat(100), email: "alex@example.com" });
  assert.equal(valid.ok, true);

  assert.deepEqual(validateNewUser({ name: "a".repeat(101), email: "alex@example.com" }), {
    ok: false,
    message: "Проверьте введённые данные",
    fields: { name: "Имя не длиннее 100 символов" },
  });
});

test("counts emoji as single characters for name length", () => {
  const valid = validateNewUser({ name: `Alex ${"😀".repeat(51)}`, email: "alex@example.com" });
  assert.equal(valid.ok, true);

  assert.deepEqual(
    validateNewUser({ name: `Alex ${"😀".repeat(101)}`, email: "alex@example.com" }),
    {
      ok: false,
      message: "Проверьте введённые данные",
      fields: { name: "Имя не длиннее 100 символов" },
    },
  );
});

test("rejects control characters in names", () => {
  for (const name of ["Alex\u0000", "Al\nex", "\tAlex\n"]) {
    assert.deepEqual(validateNewUser({ name, email: "alex@example.com" }), {
      ok: false,
      message: "Проверьте введённые данные",
      fields: { name: "Имя содержит недопустимые символы" },
    });
  }
});

test("requires a letter or number in names", () => {
  for (const name of ["", " ", "\u200b", "!!!", "😀"]) {
    assert.deepEqual(validateNewUser({ name, email: "alex@example.com" }), {
      ok: false,
      message: "Проверьте введённые данные",
      fields: { name: "Укажите имя" },
    });
  }
});

test("checks email length boundaries", () => {
  const validEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(62)}.${"d".repeat(62)}`;
  assert.equal(validEmail.length, 254);
  assert.equal(validateNewUser({ name: "Alex", email: validEmail }).ok, true);

  const invalidEmail = `${validEmail}a`;
  assert.equal(invalidEmail.length, 255);
  assert.deepEqual(validateNewUser({ name: "Alex", email: invalidEmail }), {
    ok: false,
    message: "Проверьте введённые данные",
    fields: { email: "Email не длиннее 254 символов" },
  });
});

test("collects errors for missing fields", () => {
  assert.deepEqual(validateNewUser({}), {
    ok: false,
    message: "Проверьте введённые данные",
    fields: { name: "Укажите имя", email: "Укажите email" },
  });
});

test("treats a null name as missing", () => {
  assert.deepEqual(validateNewUser({ name: null, email: "alex@example.com" }), {
    ok: false,
    message: "Проверьте введённые данные",
    fields: { name: "Укажите имя" },
  });
});

test("rejects non-string fields", () => {
  assert.deepEqual(validateNewUser({ name: 42, email: false }), {
    ok: false,
    message: "Проверьте введённые данные",
    fields: { name: "Имя должно быть строкой", email: "Email должен быть строкой" },
  });
});

test("rejects invalid email addresses", () => {
  const bad = [
    "a@b..com",
    ".a@example.com",
    "a.@example.com",
    "a..b@example.com",
    "a@-example.com",
    "a@example-.com",
    "a@example.com.",
    "under@exa_mple.com",
    "port@example.com:80",
    "a@b",
    "a b@c.d",
    "a\u0000@b.com",
    `${"a".repeat(65)}@example.com`,
    `a@${"b".repeat(64)}.com`,
    "a@example.c1",
    "a@example.c",
    "a@b.xn--",
    "a@b.c1",
  ];
  for (const email of bad) {
    assert.deepEqual(validateNewUser({ name: "Alex", email }), {
      ok: false,
      message: "Проверьте введённые данные",
      fields: { email: "Некорректный email" },
    });
  }
});

test("accepts valid email addresses", () => {
  const good = [
    "alex.johnson@example.com",
    "first+tag@sub.example.co",
    "o'brien@example.org",
    "alex@xn--e1afmkfd.xn--p1ai",
  ];
  for (const email of good) {
    assert.equal(validateNewUser({ name: "Alex", email }).ok, true);
  }
});

test("rejects non-object bodies", () => {
  for (const body of [null, [], "user"]) {
    assert.deepEqual(validateNewUser(body), {
      ok: false,
      message: "Тело запроса должно быть JSON-объектом",
    });
  }
});

test("ignores extra fields", () => {
  assert.deepEqual(
    validateNewUser({ name: "Alex", email: "alex@example.com", role: "admin" }),
    { ok: true, value: { name: "Alex", email: "alex@example.com" } },
  );
});

test("parses canonical positive safe integer ids", () => {
  assert.equal(parseId("1"), 1);
  assert.equal(parseId(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);

  for (const raw of ["0", "-1", "1.5", "abc", "007", "1e2", "9007199254740992"]) {
    assert.equal(parseId(raw), null);
  }
});
