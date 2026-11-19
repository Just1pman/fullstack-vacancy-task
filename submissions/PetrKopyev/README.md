# Управление пользователями

Веб-приложение для просмотра, поиска по имени, добавления и удаления пользователей: Node.js без фреймворков + TypeScript.

## Требования

- Node.js 22 или новее.

## Запуск

```bash
npm install
npm start
```

`npm start` собирает сервер и клиент, после чего запускает приложение на http://localhost:3000. Порт можно изменить переменной окружения `PORT`:

```bash
PORT=4000 npm start
```

Тесты собирают проект и запускают серверные тесты через `node:test`:

```bash
npm test
```

## Структура

```text
.
├── .gitignore                     # Исключает зависимости, сборку и локальные переменные окружения.
├── package.json                   # Скрипты сборки, запуска и тестов; dev-зависимости.
├── package-lock.json              # Зафиксированные версии dev-зависимостей.
├── tsconfig.server.json           # Строгая компиляция сервера в dist/server.
├── tsconfig.client.json           # Строгая компиляция браузерных ES-модулей в dist/client.
├── public/
│   ├── index.html                 # Разметка формы, поиска и списка пользователей.
│   └── style.css                  # Стили интерфейса и состояний элементов.
└── src/
    ├── client/
    │   ├── api.ts                 # Запросы к API и обработка ошибок на клиенте.
    │   └── app.ts                 # Отрисовка списка, поиск, форма и удаление.
    └── server/
        ├── index.ts               # Запуск HTTP-сервера и настройка порта.
        ├── app.ts                 # Маршрутизация API и обработка запросов.
        ├── store.ts               # Хранилище пользователей в памяти и исходные данные.
        ├── validation.ts          # Валидация нового пользователя и разбор id.
        ├── http.ts                # Чтение JSON, лимит тела и JSON-ответы.
        ├── static.ts              # Раздаются только index.html, style.css и собранные app.js/api.js.
        ├── validation.test.ts     # Модульные тесты валидации и id.
        └── api.test.ts            # Интеграционные тесты API и статики.
```

## API

Данные хранятся в памяти и сбрасываются при перезапуске сервера. Параметр `name` у `GET /api/users` выполняет поиск по подстроке имени без учёта регистра; пробелы по краям параметра игнорируются.

| Метод | Путь | Успех | Ошибки |
|---|---|---|---|
| GET | `/api/users`, `/api/users?name=...` | `200`, массив пользователей | — |
| POST | `/api/users` | `201`, созданный пользователь | `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `409 EMAIL_TAKEN`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` |
| DELETE | `/api/users/{id}` | `204`, пустое тело | `400 INVALID_ID`, `404 NOT_FOUND` |

Для неподдерживаемых методов возвращается `405 METHOD_NOT_ALLOWED` и заголовок `Allow`. Неизвестные API-пути возвращают `404 NOT_FOUND`, некорректный адрес запроса — `400 BAD_REQUEST`, внутренняя ошибка — `500 INTERNAL`.

Формат ошибки:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Описание ошибки",
    "fields": {
      "email": "Ошибка конкретного поля"
    }
  }
}
```

Поле `fields` присутствует только у `VALIDATION_ERROR` и `EMAIL_TAKEN`. Сообщения на русском: интерфейс показывает их пользователю как есть.

Правила для `POST /api/users`:

- тело — JSON-объект размером не более 10 КБ (10 240 байт), заголовок `Content-Type: application/json`; при превышении лимита сервер отвечает `413`, не дожидаясь конца тела, и закрывает соединение;
- `name` — строка, обрезаются пробелы по краям, управляющие символы запрещены, нужна хотя бы одна буква или цифра, итоговая длина не более 100 символов;
- `email` — строка, обрезаются пробелы по краям и приводится к нижнему регистру, длина не более 254 символов; local part не длиннее 64 символов, без точек по краям и двойных точек, домен состоит из меток не длиннее 63 символов через точку, минимум из двух меток, последняя — буквы не короче двух или Punycode (`xn--…`);
- email должен быть уникален без учёта регистра;
- лишние поля тела игнорируются;
- `id` в пути удаления — положительное целое без ведущих нулей в диапазоне безопасных целых чисел JavaScript.

### Получить всех пользователей

```bash
curl -i http://localhost:3000/api/users
```

После запуска с исходными данными:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[
  {"id":1,"name":"Alex Johnson","email":"alex.johnson@example.com"},
  {"id":2,"name":"Maria Petrova","email":"maria.petrova@example.com"},
  {"id":3,"name":"John Smith","email":"john.smith@example.com"},
  {"id":4,"name":"Anna Volkova","email":"anna.volkova@example.com"},
  {"id":5,"name":"Michael Brown","email":"michael.brown@example.com"},
  {"id":6,"name":"Elena Orlova","email":"elena.orlova@example.com"},
  {"id":7,"name":"David Wilson","email":"david.wilson@example.com"},
  {"id":8,"name":"Olga Morozova","email":"olga.morozova@example.com"},
  {"id":9,"name":"Daniel Miller","email":"daniel.miller@example.com"},
  {"id":10,"name":"Sofia Lebedeva","email":"sofia.lebedeva@example.com"}
]
```

### Найти пользователей по имени

```bash
curl -i 'http://localhost:3000/api/users?name=ann'
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[{"id":4,"name":"Anna Volkova","email":"anna.volkova@example.com"}]
```

### Добавить пользователя

Примеры создания и удаления ниже рассчитаны на последовательное выполнение после запуска с исходными данными: первый новый пользователь получает `id` 11.

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  --data '{"name":"  New User  ","email":" NEW@EXAMPLE.COM "}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":11,"name":"New User","email":"new@example.com"}
```

Ошибка валидации:

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  --data '{"name":"","email":"bad"}'
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":{"code":"VALIDATION_ERROR","message":"Проверьте введённые данные","fields":{"name":"Укажите имя","email":"Некорректный email"}}}
```

Неверный `Content-Type`:

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: text/plain' \
  --data '{}'
```

```http
HTTP/1.1 415 Unsupported Media Type
Content-Type: application/json; charset=utf-8

{"error":{"code":"UNSUPPORTED_MEDIA_TYPE","message":"Content-Type должен быть application/json"}}
```

### Удалить пользователя

```bash
curl -i -X DELETE http://localhost:3000/api/users/11
```

```http
HTTP/1.1 204 No Content
```

Тело ответа пустое. Некорректный `id`:

```bash
curl -i -X DELETE http://localhost:3000/api/users/abc
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":{"code":"INVALID_ID","message":"Некорректный id пользователя"}}
```

### Неподдерживаемый метод

```bash
curl -i -X PUT http://localhost:3000/api/users
```

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, POST
Content-Type: application/json; charset=utf-8

{"error":{"code":"METHOD_NOT_ALLOWED","message":"Метод не поддерживается"}}
```

## Технологии и почему

- **Node.js без фреймворков:** требование ТЗ, HTTP-сервер реализован на встроенном модуле `node:http`.
- **TypeScript через `tsc`:** типизация и компиляция без runtime-зависимостей; dev-зависимости только `typescript` и `@types/node`.
- **Один сервер для API и статики:** клиент и API работают на одном origin, поэтому CORS не нужен; раздаются только index.html, style.css и собранные app.js/api.js.
- **`node:test`:** встроенный тестовый runner не требует дополнительного фреймворка.
- **ES-модули на клиенте:** браузер загружает скомпилированные модули напрямую, сборщик не нужен; DOM создаётся через `createElement`, `textContent` и `replaceChildren`, без `innerHTML`.
- **Нативный `<dialog>`:** подтверждение удаления без сторонних UI-библиотек.
- **Тосты:** уведомления о добавлении и удалении (исчезают через 5 секунд).
- **Аватары:** инициалы и цвет вычисляются из имени пользователя.

## Что улучшил бы

- Постоянное хранилище: SQLite или Postgres.
- Пагинацию списка пользователей.
- Редактирование пользователей через `PATCH`.
- E2E-тесты в браузере на Playwright.
- Возможность отменить удаление (undo).
- Ограничение частоты запросов (rate limit).
- Логирование запросов.
