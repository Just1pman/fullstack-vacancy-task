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
 * Загружает пользователей, опционально отфильтрованных по строке поиска.
 * При !response.ok пытается взять { error } из тела ответа,
 * иначе бросает Error со статусом. Бросается только Error — единый тип для catch.
 * signal позволяет отменить «устаревший» запрос при быстром вводе.
 */
async function fetchUsers(search?: string, signal?: AbortSignal): Promise<User[]> {
  // encodeURIComponent обязателен: в поиске могут быть пробелы, кириллица, & и т.п.
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`/api/users${query}`, { signal });
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

/**
 * Загружает список (с опциональным поиском) и отрисовывает его,
 * управляя статусом и блоком ошибки.
 *
 * При отмене через AbortController (устаревший запрос) — тихо выходим:
 * статус/ошибку не трогаем и таблицу не перерисовываем, иначе отменённый
 * запрос мог бы сбросить состояние более нового.
 */
async function loadUsers(search?: string, signal?: AbortSignal): Promise<void> {
  showError(null);
  showStatus('Загрузка...');
  try {
    const users = await fetchUsers(search, signal);
    renderUsers(users);
    showStatus(null);
  } catch (err) {
    // AbortError = запрос отменён намеренно (пришёл более новый ввод), не ошибка UI.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    // Ошибку показываем, но таблицу НЕ очищаем — оставляем прошлый результат.
    showStatus(null);
    showError(err instanceof Error ? err.message : 'Неизвестная ошибка');
  }
}

/**
 * Debounce ввода: 300 мс после последнего нажатия. Перед запуском нового
 * запроса отменяем предыдущий в полёте через AbortController, чтобы ответы
 * не пришли в неправильном порядке (race condition).
 */
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeController: AbortController | undefined;

function onSearchInput(): void {
  const input = getElement<HTMLInputElement>('search');

  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    // Отменяем предыдущий незавершённый запрос: его результат уже неактуален.
    if (activeController) {
      activeController.abort();
    }
    const controller = new AbortController();
    activeController = controller;

    const search = input.value.trim();
    void loadUsers(search || undefined, controller.signal);
  }, 300);
}

// Точка входа.
// Стартовая загрузка без фильтра.
void loadUsers();

// Поиск по имени с debounce и отменой устаревших запросов.
getElement<HTMLInputElement>('search').addEventListener('input', onSearchInput);

// TODO: обработчик сабмита #create-form (POST /api/users) с блоком #form-error.
// TODO: делегированный обработчик удаления (DELETE /api/users/:id).

