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

// Массив и счётчик id не экспортируются: единственный доступ к хранилищу —
// через функции getAll/create/removeById, чтобы не менять состояние в обход них.
const users: User[] = [
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
let nextId: number =
  users.reduce((max, user) => Math.max(max, user.id), 0) + 1;

/**
 * Возвращает следующий свободный id и сдвигает счётчик.
 * Инкремент держим в одном месте, чтобы не размазывать логику по обработчикам.
 */
export function getNextId(): number {
  return nextId++;
}

/**
 * Возвращает всех пользователей; при заданном search фильтрует по подстроке
 * в name (регистронезависимо). Пустая строка считается «без фильтра».
 */
export function getAll(search?: string): User[] {
  if (search) {
    const needle = search.toLowerCase();
    return users.filter((user) => user.name.toLowerCase().includes(needle));
  }
  return users;
}

/** Создаёт пользователя с новым id и добавляет его в хранилище. */
export function create(name: string, email: string): User {
  const user: User = { id: getNextId(), name, email };
  users.push(user);
  return user;
}

/** Удаляет пользователя по id. Возвращает true, если запись была удалена. */
export function removeById(id: number): boolean {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    return false;
  }
  users.splice(index, 1);
  return true;
}

/** Ищет пользователя по email без учёта регистра. */
export function findByEmail(email: string): User | undefined {
  const needle = email.toLowerCase();
  return users.find((user) => user.email.toLowerCase() === needle);
}

