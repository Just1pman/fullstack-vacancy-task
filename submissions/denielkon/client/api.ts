import type { User, UserInput } from '../shared/user.js';

export type FieldErrors = Partial<Record<keyof UserInput, string>>;

export class ApiError extends Error {
  constructor(message: string, readonly details?: FieldErrors) {
    super(message);
  }
}

export async function fetchUsers(
  search: string,
  signal: AbortSignal
): Promise<User[]> {
  const response = await request(
    `/api/users?${new URLSearchParams({ search })}`,
    { signal }
  );
  return response.json();
}

export async function createUser(
  input: UserInput
): Promise<void> {
  await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteUser(id: number): Promise<void> {
  await request(`/api/users/${id}`, { method: 'DELETE' });
}

async function request(
  path: string,
  init: RequestInit
): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

async function toApiError(
  response: Response
): Promise<ApiError> {
  const fallbackMessage = `Ошибка запроса (${response.status})`;
  try {
    const body = await response.json();
    return new ApiError(body.error ?? fallbackMessage, body.details);
  } catch {
    return new ApiError(fallbackMessage);
  }
}
