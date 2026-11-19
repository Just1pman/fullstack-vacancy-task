import type { NewUser } from "./store.js";

export type ValidationResult =
  | { ok: true; value: NewUser }
  | { ok: false; message: string; fields?: Record<string, string> };

const isValidEmail = (email: string) => {
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;

  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split(".");
  return (
    local.length <= 64 &&
    !local.startsWith(".") &&
    !local.endsWith(".") &&
    !local.includes("..") &&
    /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+$/.test(local) &&
    labels.length >= 2 &&
    labels.every(
      (label) => label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label),
    ) &&
    /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(labels.at(-1) ?? "")
  );
};

export const validateNewUser = (body: unknown): ValidationResult => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Тело запроса должно быть JSON-объектом" };
  }

  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  let name = "";
  let email = "";

  if (input.name == null) {
    fields.name = "Укажите имя";
  } else if (typeof input.name !== "string") {
    fields.name = "Имя должно быть строкой";
  } else {
    if (/\p{Cc}/u.test(input.name)) {
      fields.name = "Имя содержит недопустимые символы";
    } else {
      name = input.name.trim();
      if (!/[\p{L}\p{N}]/u.test(name)) fields.name = "Укажите имя";
      else if ([...name].length > 100) fields.name = "Имя не длиннее 100 символов";
    }
  }

  if (input.email == null) {
    fields.email = "Укажите email";
  } else if (typeof input.email !== "string") {
    fields.email = "Email должен быть строкой";
  } else {
    email = input.email.trim().toLowerCase();
    if (!email) fields.email = "Укажите email";
    else if (email.length > 254) fields.email = "Email не длиннее 254 символов";
    else if (!isValidEmail(email)) fields.email = "Некорректный email";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, message: "Проверьте введённые данные", fields };
  }
  return { ok: true, value: { name, email } };
};

export const parseId = (raw: string): number | null => {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
};
