/**
 * Клиентское приложение (без модулей, без импортов — обычный скрипт).
 *
 * Этап 1: загрузка списка пользователей через GET /api/users и его рендер.
 * Поиск, создание и удаление добавятся на следующих этапах — см. TODO.
 *
 * Важно: никаких экспортов — иначе при module=commonjs файл превратится
 * в модуль, и `<script src>` подключит его иначе, чем ожидается.
 */

interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * Безопасно получает элемент по id с проверкой на null.
 * Нужен, чтобы под strict TS не писать non-null assertions по всему файлу:
 * отсутствие элемента — ошибка вёрстки, поэтому бросаем, а не глотаем.
 */
function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element #${id} not found`);
  }
  return el as T;
}

/** Показывает/скрывает блок статуса. null — скрыть. */
function showStatus(text: string | null): void {
  const el = getElement<HTMLDivElement>('status');
  if (text === null) {
    el.classList.add('hidden');
    el.textContent = '';
  } else {
    el.textContent = text;
    el.classList.remove('hidden');
  }
}

/** Показывает/скрывает блок ошибки. null — скрыть. */
function showError(text: string | null): void {
  const el = getElement<HTMLDivElement>('error');
  if (text === null) {
    el.classList.add('hidden');
    el.textContent = '';
  } else {
    el.textContent = text;
    el.classList.remove('hidden');
  }
}

/**
 * Загружает пользователей.
 * При !response.ok пытается взять { error } из тела ответа,
 * иначе бросает Error со статусом. Бросается только Error — единый тип для catch.
 */
async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users');
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Тело не JSON — оставляем сообщение по умолчанию.
    }
    throw new Error(message);
  }
  return (await response.json()) as User[];
}

/**
 * Рендерит строки таблицы. Данные пользователя выводятся через textContent,
 * без innerHTML — защита от XSS.
 */
function renderUsers(users: User[]): void {
  const tbody = getElement<HTMLTableSectionElement>('users-body');
  tbody.textContent = '';

  for (const user of users) {
    const tr = document.createElement('tr');

    const idCell = document.createElement('td');
    idCell.className = 'col-id';
    idCell.textContent = String(user.id);

    const nameCell = document.createElement('td');
    nameCell.textContent = user.name;

    const emailCell = document.createElement('td');
    emailCell.textContent = user.email;

    // Колонка действий: кнопку удаления добавим на этапе «удаление».
    // TODO: добавить кнопку удаления в colActions.
    const colActions = document.createElement('td');
    colActions.className = 'col-actions';

    tr.append(idCell, nameCell, emailCell, colActions);
    tbody.append(tr);
  }
}

/** Загружает список и отрисовывает его, управляя статусом и блоком ошибки. */
async function loadUsers(): Promise<void> {
  showError(null);
  showStatus('Загрузка...');
  try {
    const users = await fetchUsers();
    renderUsers(users);
    showStatus(null);
  } catch (err) {
    showStatus(null);
    showError(err instanceof Error ? err.message : 'Неизвестная ошибка');
  }
}

// Точка входа: грузим список сразу при загрузке страницы.
// TODO: обработчик поиска на #search (GET /api/users?search=...).
// TODO: обработчик сабмита #create-form (POST /api/users) с блоком #form-error.
// TODO: делегированный обработчик удаления (DELETE /api/users/:id).
void loadUsers();
