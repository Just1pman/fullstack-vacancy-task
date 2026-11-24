import {
  USERS_PATH,
  isRecord,
  isUser,
  isFieldErrors,
  type FieldErrors,
  type User,
} from "../contracts/user.js";
import type { UsersApi } from "./types.js";

export class ApiError extends Error {
  constructor(message: string, readonly fields?: FieldErrors) {
    super(message);
  }
}

async function request(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "Не удалось связаться с сервером. Проверьте соединение и повторите попытку."
    );
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const error =
      isRecord(data) && isRecord(data.error) ? data.error : undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : `Ошибка запроса (${response.status}).`;
    throw new ApiError(
      message,
      isFieldErrors(error?.fields) ? error.fields : undefined
    );
  }
  return response;
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    const data: unknown = await response.json();
    return data;
  } catch {
    throw new ApiError("Сервер вернул некорректный JSON.");
  }
}

export const api: UsersApi = {
  async list(search, signal): Promise<User[]> {
    const response = await request(
      `${USERS_PATH}?${new URLSearchParams({ search })}`,
      { signal }
    );
    const data = await readResponse(response);
    if (!Array.isArray(data) || !data.every(isUser)) {
      throw new ApiError("Сервер вернул некорректный список пользователей.");
    }
    return data;
  },
  async add(user): Promise<User> {
    const response = await request(USERS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    const data = await readResponse(response);
    if (!isUser(data))
      throw new ApiError("Сервер вернул некорректные данные пользователя.");
    return data;
  },
  async remove(id): Promise<void> {
    await request(`${USERS_PATH}/${id}`, { method: "DELETE" });
  },
};
