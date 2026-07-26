# Аудит Planirov: что было исправлено

Этот файл фиксирует основные риски исходного одностраничного прототипа и
результат переработки.

| Область | Было | Исправление |
|---|---|---|
| Premium | Секрет и FNV-токен находились в клиентском коде | Тариф хранится в D1, меняется только после подписанного Telegram webhook |
| Telegram auth | Доверие к `initDataUnsafe`, подмена admin ID | HMAC-SHA256 проверка `initData`, проверка `auth_date`, серверный admin allowlist |
| XSS | Пользовательские данные попадали в HTML-шаблоны | React escaping, отсутствие `innerHTML`, Zod-валидация импорта и API |
| Хранилище | localStorage и нестабильный CloudStorage | IndexedDB, D1 sync, офлайн-очередь, merge по `updatedAt`, tombstones |
| Производительность | Один большой HTML и последовательные операции | Модульная сборка, code splitting, debounced save/sync, D1 batch до 100 запросов |
| Зависимости | Tailwind Play CDN в production | Версионированные npm-зависимости и lockfile |
| Адаптивность | Интерфейс рассчитан главным образом на телефон | Desktop sidebar, mobile drawer, нижняя навигация, responsive Kanban/календарь |
| Доступность | Слабая клавиатурная навигация и модальные окна | Focus trap, Escape, возврат фокуса, skip-link, ARIA, `:focus-visible` |
| Touch UX | Маленькие зоны нажатия | Увеличенные мобильные controls, safe-area insets |
| Движение | Резкие появления и отсутствие motion policy | Переходы, sheet/dialog animations, `prefers-reduced-motion` |
| Импорт | Замена без надёжной проверки и recovery | Лимит 2 МБ, Zod schema, preview, автоматическая резервная копия |
| Удаление | Необратимые действия | Soft-delete, undo toast, фраза подтверждения полного сброса |
| Напоминания | Только клиентская логика | Защищённый cron endpoint и Telegram Bot API |
| PWA | Отсутствовала | Manifest, Service Worker, локальный app shell |
| HTTP security | Не было единой политики | CSP, nosniff, referrer/permissions policy, no-store для API |
| Качество | Отсутствовал CI | ESLint, TypeScript, Vitest, build validation, GitHub Actions |

## Оставшиеся операционные задачи владельца

Это не дефекты кода, а обязательная конфигурация окружения:

1. создать production D1 и применить миграцию;
2. добавить Telegram и cron secrets;
3. настроить Web App URL, webhook и расписание напоминаний;
4. заменить демонстрационную invoice-ссылку реальной;
5. включить GitHub branch protection и Dependabot;
6. после публикации проверить Lighthouse на production URL и настроить
   внешний мониторинг доступности.

## Критерии готовности

- нет секретов Premium или Telegram в браузерном bundle;
- повреждённый импорт не меняет текущие данные;
- приложение полностью работает без сети после первой загрузки;
- синхронизация не выполняет один сетевой round trip на каждую запись;
- основные действия доступны мышью, касанием и клавиатурой;
- production build, типы, lint и unit-тесты проходят в CI.
