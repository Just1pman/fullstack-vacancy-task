import type { ErrorStatus } from "./config.js";
import { isRecord } from "../contracts/user.js";
import { validateUserFields } from "../contracts/user-validation.js";
import type { FieldErrors, UserInput } from "../contracts/user.js";
export class HttpError extends Error {
  constructor(
    readonly status: ErrorStatus,
    message: string,
    readonly fields?: FieldErrors
  ) {
    super(message);
  }
}

export function validateUser(body: unknown): UserInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Ожидается JSON-объект с полями name и email.");
  }

  const input = body;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const fields = validateUserFields({ name, email });
  if (Object.keys(fields).length) {
    throw new HttpError(400, "Проверьте данные пользователя.", fields);
  }
  return { name, email };
}
