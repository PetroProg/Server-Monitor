# State: Server-Monitor
Последнее обновление: 2026-11-21

## Текущий статус
- Создано с нуля автономное mobile-first PWA-приложение мониторинга сервера `petroprog` и Docker-контейнеров на FastAPI + Beszel Hub (`:8085`, HTTPS через Tailscale Serve `:8445`).
- Реализованы 3 независимые страницы (`/server`, `/agents`, `/settings`), 4 темы оформления (`Obsidian Amber`, `Nordic Paper`, `Emerald Ops`, `Velvet Coral`), язык `RU/EN`, интервалы обновления и оффлайн Service Worker.
- Работает строго в режиме read-only (без монтирования `docker.sock` и без перезапуска контейнеров из UI).

## Открытые задачи и риски
- Сменить пароль суперпользователя Beszel (ранее был захардкожен в истории коммитов `news-ai`) и обновить `BESZEL_PASSWORD` в `.env`.
- Создать удалённый репозиторий `PetroProg/Server-Monitor` на GitHub при необходимости и выполнить `git push -u origin main`.
