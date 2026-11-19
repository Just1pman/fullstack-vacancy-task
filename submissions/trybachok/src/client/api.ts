import type { NewUser, User } from '../shared/users.ts';

const usersPath = '/api/users';
const serverError = 'Сервер не смог выполнить запрос. Попробуйте ещё раз.';

export class UsersApiError extends Error {
  readonly fields: Partial<Record<keyof NewUser, string>>;

  constructor(message: string, fields: Partial<Record<keyof NewUser, string>> = {}) {
    super(message);
    this.fields = fields;
  }
}

function parseError(payload: unknown): UsersApiError {
  if (!payload || typeof payload !== 'object') return new UsersApiError(serverError);

  const error = payload as { message?: unknown; fields?: { name?: unknown; email?: unknown } };
  const message = typeof error.message === 'string' && error.message.trim() ? error.message : serverError;
  const fields: Partial<Record<keyof NewUser, string>> = {};
  if (typeof error.fields?.name === 'string') fields.name = error.fields.name;
  if (typeof error.fields?.email === 'string') fields.email = error.fields.email;
  return new UsersApiError(message, fields);
}

function usersListUrl(name: string): string {
  const query = name.trim();
  if (!query) return usersPath;

  const params = new URLSearchParams({ name: query });
  return `${usersPath}?${params}`;
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;

  const { id, name, email } = value as Partial<User>;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    && typeof name === 'string' && typeof email === 'string';
}

export function createUsersApi(send: typeof fetch = fetch) {
  async function request(url: string, options?: RequestInit, acceptedStatus?: number): Promise<Response> {
    let response: Response;
    try {
      response = await send(url, options);
    } catch {
      throw new UsersApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.');
    }

    if (!response.ok && response.status !== acceptedStatus) {
      if (response.status >= 500) throw new UsersApiError(serverError);

      const payload: unknown = await response.json().catch(() => null);
      throw parseError(payload);
    }

    return response;
  }

  return {
    async list(name = '', signal?: AbortSignal): Promise<User[]> {
      const response = await request(usersListUrl(name), { signal });
      const users: unknown = await response.json().catch(() => null);
      if (!Array.isArray(users) || !users.every(isUser)) {
        throw new Error('Сервер вернул некорректный список. Попробуйте загрузить его ещё раз.');
      }
      return users;
    },

    async create(user: NewUser): Promise<void> {
      await request(usersPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
    },

    async remove(id: number): Promise<boolean> {
      const response = await request(`${usersPath}/${id}`, { method: 'DELETE' }, 404);
      return response.status !== 404;
    },
  };
}
