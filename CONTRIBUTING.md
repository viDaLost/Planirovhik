# Contributing

1. Создайте ветку от актуального `main`.
2. Не добавляйте секреты, production exports и локальные базы.
3. Для изменения схемы создайте новую миграцию: `npm run db:generate`.
4. Перед pull request выполните:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

5. Опишите пользовательский эффект, проверенные сценарии и изменение схемы.

Не редактируйте уже применённые SQL-миграции. Для breaking changes добавляйте
миграцию и план совместимости/rollback.
