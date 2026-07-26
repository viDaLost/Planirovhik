# Публикация Planirov с телефона

Ниже два готовых варианта. Если вы работаете только с телефона и хотите быстро
получить сайт, начните с варианта A.

| Возможность | A. GitHub Pages | B. Cloudflare |
|---|---:|---:|
| Нужна серверная настройка | Нет | Да |
| Задачи, проекты, Kanban, календарь, аналитика | Да | Да |
| Офлайн и установка на главный экран | Да | Да |
| Хранение данных | В браузере телефона | Браузер + D1 |
| Синхронизация между устройствами | Нет | Да |
| Telegram-вход, Premium, webhook, напоминания | Нет | Да |
| Стоимость старта | Бесплатно для поддерживаемых планов GitHub | Зависит от текущего тарифа Cloudflare |

## Перед началом

1. Распакуйте архив на телефоне.
2. Создайте на GitHub пустой репозиторий с веткой `main`.
3. Загрузите в него **содержимое** папки проекта, а не сам ZIP.
4. Убедитесь, что в репозитории видна папка `.github/workflows`.

GitHub Mobile не всегда показывает все настройки репозитория. Открывайте GitHub
в Chrome/Safari и при необходимости включайте **«Версия для компьютера»**.
Если мобильный загрузчик не позволяет выбрать папку целиком, откройте
GitHub Codespaces в браузере, загрузите ZIP через проводник редактора и
распакуйте его в корень репозитория.

## Вариант A — GitHub Pages

Этот вариант не требует токенов, базы данных и терминала.

### Первый запуск

1. Откройте репозиторий на `github.com`.
2. Нажмите `Settings`.
3. В боковом меню откройте `Pages`.
4. В блоке `Build and deployment` выберите:
   `Source` → **GitHub Actions**.
5. Перейдите во вкладку `Actions`.
6. Откройте workflow **1 — Опубликовать GitHub Pages**.
7. Нажмите `Run workflow` → `Run workflow`.
8. Дождитесь зелёной галочки и откройте задачу `deploy`.
9. Нажмите на опубликованный URL.

Workflow также автоматически запускается после каждого обновления ветки
`main`. Он проверяет код, собирает сайт с правильным путём репозитория и
публикует готовый артефакт.

### Установка как приложение

- iPhone/iPad: Safari → «Поделиться» → «На экран Домой».
- Android: Chrome → меню `⋮` → «Установить приложение» или
  «Добавить на главный экран».

После первого открытия интерфейс и ранее загруженные данные доступны офлайн.

### Важно о данных Pages-версии

GitHub Pages размещает статические файлы, поэтому серверных API там нет.
Planirov автоматически переходит в автономный режим:

- данные остаются в IndexedDB этого браузера;
- Telegram-вход и D1-синхронизация не вызываются;
- Premium-оплата и серверные напоминания скрыты;
- импорт, экспорт, темы, задачи, проекты, Kanban, календарь и аналитика
  продолжают работать.

Удаление данных сайта, очистка браузера или смена телефона могут удалить
локальные задачи. Периодически открывайте настройки Planirov и скачивайте
JSON-резервную копию.

## Вариант B — полная версия через Cloudflare

Используйте этот вариант, если нужны Telegram Mini App, синхронизация между
устройствами, D1, Premium и серверные напоминания.

### 1. Создайте D1

В Cloudflare Dashboard откройте `Storage & databases` → `D1` → `Create` и
создайте базу с именем `planirov`. Скопируйте её Database ID и Account ID.

### 2. Создайте API token

В профиле Cloudflare откройте `API Tokens` и создайте токен для CI с правами на
редактирование Workers Scripts и D1. Скопируйте токен сразу: позднее Cloudflare
не покажет его повторно.

### 3. Добавьте GitHub Secrets

В репозитории откройте:

`Settings` → `Secrets and variables` → `Actions` → `Secrets` →
`New repository secret`.

Обязательные значения:

| Secret | Что вставить |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token из Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | Database ID базы `planirov` |

Для полной Telegram-функциональности также добавьте:

| Secret | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен BotFather |
| `TELEGRAM_ADMIN_IDS` | Telegram ID администраторов через запятую |
| `TELEGRAM_WEBHOOK_SECRET` | случайный секрет webhook |
| `TELEGRAM_PREMIUM_INVOICE_URL` | Telegram Stars invoice link |
| `CRON_SECRET` | случайный Bearer-секрет напоминаний |

Не вставляйте секреты в файлы проекта, issues, commits или сообщения workflow.

Необязательные значения можно добавить во вкладке `Variables`:

| Variable | Значение по умолчанию |
|---|---|
| `CLOUDFLARE_WORKER_NAME` | `planirov` |
| `CLOUDFLARE_D1_DATABASE_NAME` | `planirov` |

### 4. Запустите публикацию

1. Откройте `Actions`.
2. Выберите **2 — Опубликовать полную версию Cloudflare**.
3. Нажмите `Run workflow`.
4. Дождитесь зелёной галочки.
5. Откройте лог шага `Опубликовать Worker`: в конце будет адрес `workers.dev`.

Workflow сам проверяет проект, собирает Worker, создаёт конфигурацию из GitHub
Secrets, применяет D1-миграции и публикует новую версию. Секретные значения в
лог не выводятся.

### 5. Подключите Telegram

В BotFather задайте адрес опубликованного Worker как Web App URL. Webhook
платежей должен вести на:

```text
https://ВАШ-ДОМЕН/api/subscription/webhook
```

Его `secret_token` должен совпадать с `TELEGRAM_WEBHOOK_SECRET`.
Для напоминаний настройте периодический запрос:

```text
POST https://ВАШ-ДОМЕН/api/cron/reminders
Authorization: Bearer ВАШ_CRON_SECRET
```

## Как обновлять приложение

Загрузите изменённые файлы в ветку `main`:

- Pages обновится автоматически;
- для полной версии откройте `Actions` и повторно запустите второй workflow.

Если публикация стала красной, откройте неуспешный workflow и раскройте первый
красный шаг. Чаще всего причина — пропущенный secret, неправильный D1 ID или не
выбранный источник `GitHub Actions` в настройках Pages.

Официальные справки:

- [настройка источника GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site);
- [custom workflows для GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages);
- [Cloudflare Workers через GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/);
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/#migrations).
