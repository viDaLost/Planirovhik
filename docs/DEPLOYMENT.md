# Публикация Planirov

Проект поддерживает две независимые production-сборки:

| Цель | Команда | Артефакт | Workflow |
|---|---|---|---|
| GitHub Pages PWA | `npm run build:pages` | `dist-pages/` | `1 — Опубликовать GitHub Pages` |
| Cloudflare Worker + D1 | `npm run build` | `dist/` | `2 — Опубликовать полную версию Cloudflare` |

Пошаговая публикация без компьютера описана в
[PUBLISH_FROM_PHONE.md](PUBLISH_FROM_PHONE.md).

## 1. GitHub

Создайте пустой репозиторий и отправьте проект:

```bash
git init
git add .
git commit -m "feat: production-ready Planirov"
git branch -M main
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

В настройках рекомендуется:

- защитить `main`;
- требовать успешный check `quality`;
- включить Dependabot alerts, secret scanning и push protection;
- принимать изменения через pull request.

## 2. GitHub Pages

В репозитории откройте `Settings` → `Pages` и выберите
`Source` → `GitHub Actions`. Workflow `.github/workflows/deploy-pages.yml`
запускается автоматически после push в `main` или вручную через `Actions`.

Для локальной проверки:

```bash
PAGES_BASE_PATH=/имя-репозитория/ npm run build:pages
npm run test:pages
npm run preview:pages
```

Сборка автоматически учитывает URL проекта вида
`https://owner.github.io/repository/`, регистрирует Service Worker в правильном
scope и использует относительные пути PWA manifest.

Pages-режим — автономный: IndexedDB хранится на текущем устройстве, серверные
API, D1, Telegram auth, Premium и напоминания недоступны.

## 3. Cloudflare D1

Создайте базу `planirov` в Cloudflare Dashboard или через Wrangler:

```bash
npx wrangler login
npx wrangler d1 create planirov
```

Для ручной локальной публикации:

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

Вставьте `account_id` и `database_id`, затем:

```bash
npx wrangler d1 migrations apply planirov --remote
```

Binding обязан называться `DB`. Не изменяйте уже применённые SQL-миграции:
для изменений схемы добавляйте новый файл миграции.

## 4. GitHub Secrets для Cloudflare

Откройте `Settings` → `Secrets and variables` → `Actions`.

Обязательные repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
```

Секреты приложения:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_IDS
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_PREMIUM_INVOICE_URL
CRON_SECRET
```

Необязательные repository variables:

```text
CLOUDFLARE_WORKER_NAME=planirov
CLOUDFLARE_D1_DATABASE_NAME=planirov
```

Workflow `.github/workflows/deploy-worker.yml` запускается только вручную. Он
собирает и проверяет проект, генерирует игнорируемый `wrangler.jsonc`, применяет
D1-миграции и публикует Worker. Реальные значения secrets в лог не выводятся.

## 5. Ручная production-сборка

```bash
npm ci
npm run test:unit
npm run lint
npm run typecheck
npm run build
node --import ./scripts/register-cloudflare-loader.mjs \
  --test tests/rendered-html.test.mjs
```

Для создания конфигурации из переменных окружения:

```bash
node scripts/create-cloudflare-config.mjs
npx wrangler deploy --config wrangler.jsonc
```

## 6. Telegram

В BotFather:

1. задайте production URL как Web App;
2. добавьте menu button;
3. при необходимости разрешите нужный домен.

Webhook:

```bash
curl --request POST \
  "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  --header "content-type: application/json" \
  --data '{
    "url": "https://<DOMAIN>/api/subscription/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "pre_checkout_query"]
  }'
```

Не сохраняйте реальный bot token в commit, shell history общего устройства или
скриншотах.

## 7. Напоминания

Настройте Cloudflare Cron Trigger или внешний scheduler на периодический
`POST https://<DOMAIN>/api/cron/reminders` с заголовком:

```text
Authorization: Bearer <CRON_SECRET>
```

Endpoint обрабатывает до 100 напоминаний за запуск и повторяет неуспешную
доставку позже.

## 8. Проверка после публикации

- открыть приложение как обычный сайт и, для полной версии, внутри Telegram;
- создать, изменить, выполнить и удалить задачу;
- проверить Kanban, календарь и нижнее мобильное меню;
- включить offline mode и убедиться, что изменения сохраняются;
- выгрузить JSON backup и импортировать его обратно;
- для полной версии войти на втором устройстве и проверить sync;
- проверить оплату в Telegram test environment;
- вызвать reminder endpoint с тестовой задачей;
- проверить response headers, 404/500 и логи Worker.

## Rollback

GitHub Pages можно вернуть через повторный запуск workflow на предыдущем
commit. Worker откатывается через Cloudflare Deployments или повторную
публикацию предыдущего commit. Перед изменением схемы сделайте D1 backup.
