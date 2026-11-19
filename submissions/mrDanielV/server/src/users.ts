/**
 * In-memory хранилище пользователей.
 *
 * Данные живут только в памяти процесса — этого достаточно для задания
 * (перезапуск сервера сбрасывает состояние).
 */

export interface User {
  id: number;
  name: string;
  email: string;
}

export const users: User[] = [
  { id: 1, name: 'Alex Johnson', email: 'alex.johnson@example.com' },
  { id: 2, name: 'Maria Petrova', email: 'maria.petrova@example.com' },
  { id: 3, name: 'John Smith', email: 'john.smith@example.com' },
  { id: 4, name: 'Anna Volkova', email: 'anna.volkova@example.com' },
  { id: 5, name: 'Michael Brown', email: 'michael.brown@example.com' },
  { id: 6, name: 'Elena Orlova', email: 'elena.orlova@example.com' },
  { id: 7, name: 'David Wilson', email: 'david.wilson@example.com' },
  { id: 8, name: 'Olga Morozova', email: 'olga.morozova@example.com' },
  { id: 9, name: 'Daniel Miller', email: 'daniel.miller@example.com' },
  { id: 10, name: 'Sofia Lebedeva', email: 'sofia.lebedeva@example.com' },
];

/**
 * Счётчик id для новых пользователей.
 *
 * Считается как max(id) + 1, а не прошит константой 11: при любом изменении
 * стартового набора новые id остаются уникальными без ручной правки числа.
 * Если массив пуст — старт с 1.
 */
export let nextId: number =
  users.reduce((max, user) => Math.max(max, user.id), 0) + 1;

/**
 * Возвращает следующий свободный id и сдвигает счётчик.
 * Инкремент держим в одном месте, чтобы не размазывать логику по обработчикам.
 */
export function getNextId(): number {
  return nextId++;
}
