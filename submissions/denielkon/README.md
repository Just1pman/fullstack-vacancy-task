# Users

## Запуск

Нужен Node.js 22+.

```bash
npm install && npm start
```

Открыть приложение по ссылке: http://localhost:3000

## Технологии

TypeScript без runtime-зависимостей: `typescript` и `@types/node` нужны только для сборки.

- Backend: Node.js и встроенный модуль `node:http`.
- Frontend: HTML, CSS, нативные ES-модули, DOM API, `fetch` и `AbortController`.

## Что улучшил бы

- Тесты API на `node:test` и тесты actions с подменой `fetch`.
- Пагинацию списка.
- Ограничение частоты запросов и логирование.
- Подтверждение удаления в кастомном модальном окне.
- Доступность: подпись поля поиска и ARIA-атрибуты для скринридеров, live-регионы для статуса списка и ошибок.
