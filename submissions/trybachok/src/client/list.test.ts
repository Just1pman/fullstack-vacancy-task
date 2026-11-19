import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createListLoader, type ListState } from './list.ts';
import type { User } from '../users.ts';

test('загрузчик отменяет прежний запрос и игнорирует его запоздавший ответ', async () => {
  let resolveFirst!: (users: User[]) => void;
  const firstResponse = new Promise<User[]>((resolve) => { resolveFirst = resolve; });
  const maria = { id: 2, name: 'Maria Petrova', email: 'maria@example.com' };
  const signals: AbortSignal[] = [];
  const states: ListState[] = [];
  const load = createListLoader((name, signal) => {
    signals.push(signal);
    return name === 'Alex' ? firstResponse : Promise.resolve([maria]);
  }, (state) => states.push(state));

  const first = load('Alex');
  await load('Maria');
  assert.equal(signals[0].aborted, true);
  resolveFirst([]);
  await first;

  assert.deepEqual(states, [
    { kind: 'loading' },
    { kind: 'loading' },
    { kind: 'ready', name: 'Maria', users: [maria] },
  ]);
});
