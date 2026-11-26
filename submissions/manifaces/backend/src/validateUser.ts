import type { CreateUserInput, UserFieldErrors } from "./user.types.js";

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;
const LOCAL_PART_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/i;
const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export class ValidationError extends Error {
  constructor(message: string, readonly errors?: UserFieldErrors) {
    super(message);
  }
}

export const validateUser = (data: unknown): CreateUserInput => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ValidationError("Ожидается объект с именем и email пользователя");
  }

  const rawName = "name" in data ? data.name : undefined;
  const rawEmail = "email" in data ? data.email : undefined;

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  const errors: UserFieldErrors = {};

  if (typeof rawName !== "string") {
    errors.name = "Имя должно быть строкой";
  } else if (!name) {
    errors.name = "Укажите имя пользователя";
  } else if (!NAME_PATTERN.test(name)) {
    errors.name = "Некорректное имя пользователя";
  }

  if (typeof rawEmail !== "string") {
    errors.email = "Email должен быть строкой";
  } else if (!email) {
    errors.email = "Укажите email";
  } else {
    const [localPart, domain, extraPart] = email.split("@");

    if (
      email.length > 254 ||
      localPart.length > 64 ||
      !domain ||
      extraPart !== undefined ||
      !LOCAL_PART_PATTERN.test(localPart) ||
      !DOMAIN_PATTERN.test(domain)
    ) {
      errors.email = "Некорректный email";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Проверьте введённые данные", errors);
  }

  return { name, email: email.toLowerCase() };
};
