# Planirov

Адаптивный планировщик задач и Telegram Mini App. Работает как обычное
веб-приложение, сохраняет данные офлайн и после защищённого входа через
Telegram синхронизирует их с Cloudflare D1.

## Публикация с телефона

Проект содержит два готовых GitHub Actions workflow:

| Режим | Когда выбирать | Что нужно сделать |
|---|---|---|
| **GitHub Pages** | быстрый бесплатный запуск, данные на одном устройстве | включить Pages и запустить workflow `1 — Опубликовать GitHub Pages` |
| **Cloudflare** | Telegram, D1, синхронизация, Premium и напоминания | добавить Cloudflare secrets и запустить workflow `2 — Опубликовать полную версию Cloudflare` |

Начните с файла [START_HERE_MOBILE.md](START_HERE_MOBILE.md). Полная инструкция
с названиями кнопок: [docs/PUBLISH_FROM_PHONE.md](docs/PUBLISH_FROM_PHONE.md).

## Что готово

- задачи, проекты, подзадачи, теги, приоритеты и оценка времени;
- умные списки: входящие, сегодня, 7 дней, просроченные, выполненные;
- список, Kanban с drag-and-drop и доступными кнопками, календарь, аналитика;
- быстрый ввод: `Отчёт /завтра @Работа #фокус /срочно`;
- повторяющиеся задачи и серверные Telegram-напоминания;
- поиск, фильтры, массовое изменение статуса и архивирование;
- отмена удаления, безопасный импорт с предпросмотром и автоматическим backup;
- IndexedDB, Service Worker, офлайн-режим и слияние изменений по `updatedAt`;
- светлая, тёмная, системная и дополнительные темы, две плотности интерфейса;
- responsive layout для телефонов, планшетов и широких экранов;
- клавиатурные команды: `N` — новая задача, `/` — поиск;
- Telegram Haptic Feedback и открытие Telegram Stars invoice;
- серверная проверка подписи `initData`, HttpOnly-сессии и webhook secret;
- CSP и остальные защитные HTTP-заголовки;
- проверка входных данных через Zod, лимит размера импорта и sync payload;
- D1 batch-запись вместо последовательных сетевых запросов;
- миграция данных из старого `tp_v3_dataset_*` localStorage;
- unit-тесты, lint, typecheck, production build и GitHub Actions.

## Стек

- React 19, TypeScript 5, Vinext/Next App Router;
- Vite и Cloudflare Workers;
- Cloudflare D1 + Drizzle ORM;
- Zod, Lucide Icons, IndexedDB;
- Vitest, ESLint, GitHub Actions.

## Быстрый старт

Требуется Node.js `>=22.13`.

```bash
git clone <URL-ВАШЕГО-РЕПОЗИТОРИЯ>
cd planirov-production
npm ci
npm run dev
```

Откройте адрес, который покажет Vite. Без Telegram приложение работает в
локальном гостевом режиме и сразу создаёт демонстрационные данные.

Полезные команды:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build:pages
npm run test:pages
npm run db:generate
npm run build
```

`npm run build` не только собирает production Worker, но и проверяет структуру
артефакта. `npm run build:pages` создаёт автономный сайт в `dist-pages`.

## Переменные окружения

Скопируйте `.env.example` в локальный секретный env-файл вашей платформы и
заполните значения:

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота из BotFather, только на сервере |
| `TELEGRAM_ADMIN_IDS` | Telegram ID администраторов через запятую |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет заголовка Telegram webhook |
| `TELEGRAM_PREMIUM_INVOICE_URL` | Invoice link для Telegram Stars |
| `CRON_SECRET` | Bearer-секрет endpoint напоминаний |

Ни один секрет не должен иметь префикс `NEXT_PUBLIC_` и попадать в Git.

## База данных

Схема находится в `db/schema.ts`, готовая миграция — в `drizzle/`.
Приложению нужен D1 binding с именем `DB`.

Для Cloudflare:

```bash
npx wrangler d1 create planirov
cp wrangler.example.jsonc wrangler.jsonc
# вставьте account_id и database_id
npx wrangler d1 migrations apply planirov --remote
```

Локальная среда использует D1 binding, объявленный в `vite.config.ts`.

## Telegram Mini App

1. Создайте бота в BotFather и задайте Web App URL.
2. Добавьте `TELEGRAM_BOT_TOKEN` в секреты production-среды.
3. Сгенерируйте случайный `TELEGRAM_WEBHOOK_SECRET`.
4. Назначьте webhook на:
   `https://<ваш-домен>/api/subscription/webhook`.
5. Для напоминаний вызывайте `POST /api/cron/reminders` по расписанию с
   заголовком `Authorization: Bearer <CRON_SECRET>`.
6. Создайте Telegram Stars invoice и сохраните ссылку в
   `TELEGRAM_PREMIUM_INVOICE_URL`.

Приложение не доверяет `initDataUnsafe`: подпись `initData`, возраст данных и
пользователь проверяются на сервере.

## Публикация через GitHub

Репозиторий уже содержит CI и два сценария публикации:

- `.github/workflows/deploy-pages.yml` автоматически публикует автономную
  PWA-версию на GitHub Pages после push в `main`;
- `.github/workflows/deploy-worker.yml` вручную публикует полную версию на
  Cloudflare Workers, применяет D1-миграции и безопасно передаёт secrets;
- `.github/workflows/ci.yml` проверяет обе сборки на каждый push и pull request.

Для первого push:

```bash
git init
git add .
git commit -m "feat: production-ready Planirov"
git branch -M main
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

При работе с телефона терминал не нужен после загрузки файлов в репозиторий:
все проверки и публикация запускаются во вкладке `Actions`.

Подробные инструкции: [для телефона](docs/PUBLISH_FROM_PHONE.md) и
[для локальной разработки/Cloudflare](docs/DEPLOYMENT.md).

## Безопасность и данные

- пользовательские строки рендерятся React без `innerHTML`;
- импорт и API payload проходят строгую Zod-валидацию;
- сессия хранится в `HttpOnly; SameSite=Lax` cookie;
- Premium нельзя активировать клиентским токеном;
- soft-delete синхронизируется как tombstone и не возвращает удалённые задачи;
- API-ответы не кэшируются, Worker добавляет CSP, `nosniff`, Referrer Policy и
  Permissions Policy;
- перед импортом текущая копия автоматически скачивается;
- локальные данные находятся в IndexedDB браузера.

Отчёт о закрытых проблемах: [docs/AUDIT.md](docs/AUDIT.md). Правила сообщения об
уязвимости: [SECURITY.md](SECURITY.md).

## Структура

```text
app/                 UI и серверные API routes
app/components/      интерфейс планировщика
db/                  Drizzle-схема
drizzle/             SQL-миграции
lib/                 типы, auth, storage, sync и бизнес-логика
public/              PWA manifest, Service Worker, favicon
static-app/          статическая точка входа GitHub Pages
tests/               unit и rendered Worker tests
vendor/              совместимый адаптер безопасной dev-зависимости
worker/              Cloudflare Worker и security headers
docs/                аудит и инструкция публикации
```

`vendor/brace-expansion-compat` — небольшой CommonJS-адаптер: старые ESLint
plugins ожидают вызываемый API, а исправленная `brace-expansion@5.0.8`
экспортирует `expand`. Адаптер поддерживает оба формата и устраняет advisory без
изменения runtime-кода приложения.

## Лицензия

MIT — см. [LICENSE](LICENSE).
