export interface User {
  id: number;
  name: string;
  email: string;
}

export interface NewUser {
  name: string;
  email: string;
}

export type FieldErrors = Partial<Record<"name" | "email", string>>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const GENERIC_MESSAGE = "Не удалось выполнить запрос. Попробуйте позже.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "NETWORK_ERROR", "Не удалось связаться с сервером");
  }

  if (!response.ok) {
    const body = await response.json().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      return null;
    });
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "HTTP_ERROR",
      error?.message ?? GENERIC_MESSAGE,
      error?.fields,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getUsers(name: string, signal?: AbortSignal): Promise<User[]> {
  const query = name ? `?name=${encodeURIComponent(name)}` : "";
  return request<User[]>(`/api/users${query}`, { signal });
}

export function createUser(user: NewUser): Promise<User> {
  return request<User>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
}

export function deleteUser(id: number): Promise<void> {
  return request<void>(`/api/users/${id}`, { method: "DELETE" });
}
