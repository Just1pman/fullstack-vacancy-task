import type { User } from '../users.ts';

export type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; name: string; users: User[] }
  | { kind: 'error'; message: string };

export function createListLoader(
  fetchUsers: (name: string, signal: AbortSignal) => Promise<User[]>,
  update: (state: ListState) => void,
) {
  let currentRequest: AbortController | undefined;

  return async function load(name: string) {
    currentRequest?.abort();
    const request = new AbortController();
    currentRequest = request;
    update({ kind: 'loading' });

    let users: User[];
    try {
      users = await fetchUsers(name, request.signal);
    } catch (error) {
      if (request.signal.aborted) return;

      const message = error instanceof Error ? error.message : 'Попробуйте загрузить список ещё раз.';
      update({ kind: 'error', message });
      return;
    }

    if (!request.signal.aborted) update({ kind: 'ready', name, users });
  };
}
