import type {
  ApiErrorResponse,
  CreateUserInput,
  User,
  UserFieldErrors,
} from "./users.models";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors?: UserFieldErrors) {
    super(message);
  }
}

const checkResponse = async (response: Response): Promise<void> => {
  if (response.ok) return;

  const data: ApiErrorResponse | null = await response.json().catch(() => null);

  throw new ApiError(
    data?.message ?? `Ошибка запроса (HTTP ${response.status})`,
    response.status,
    data?.errors,
  );
};

export const usersService = {
  async getUsers(search: string, signal: AbortSignal): Promise<User[]> {
    const url = search ? `/api/users?${new URLSearchParams({ search })}` : "/api/users";

    const response = await fetch(url, { signal });

    await checkResponse(response);

    return response.json();
  },

  async createUser(data: CreateUserInput): Promise<User> {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    await checkResponse(response);

    return response.json();
  },

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });

    await checkResponse(response);
  },
};
