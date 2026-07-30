# AURUM CARD Proxy — Cloudflare Worker

Прокси прячет токен бота из клиентского кода. Mini App вызывает только воркер;
воркер проверяет HMAC-подпись `initData` Telegram (т.е. запрос пришёл из
настоящей сессии Mini App) и только потом обращается к Bot API.

Бесплатный тариф Cloudflare (100 000 запросов/день) для MVP достаточен с запасом.

## Endpoints

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/sendVideo` | multipart `initData` + `video` → загружает видео в чат юзера с ботом, возвращает `file_id` |
| GET | `/api/file?file_id=` | стримит файл из Telegram (токен не светится, Range поддержан) |
| POST | `/api/invoice` | JSON `{initData}` → invoice link Telegram Payments (501, если провайдер не настроен) |
| GET | `/api/health` | `{ok:true}` |

## Деплой (5 команд, ~5 минут)

```bash
cd worker
npm install -g wrangler        # или: npx wrangler ...
npx wrangler login             # откроется браузер Cloudflare
npx wrangler secret put BOT_TOKEN
# вставьте токен бота из @BotFather
npx wrangler secret put PAYMENT_PROVIDER_TOKEN
# вставьте provider token (@BotFather → Payments); можно пропустить — останется демо-режим
npx wrangler deploy
```

Wrangler выведет URL вида `https://aurum-card-proxy.<ваш-сабдомен>.workers.dev`.
Вставьте его в `src/lib/config.ts` → `API_BASE` (вместо `YOUR-SUBDOMAIN`),
пересоберите приложение (`npm run build`) и обновите ветку `gh-pages`.

## Проверка

```bash
curl https://aurum-card-proxy.<ваш-сабдомен>.workers.dev/api/health
# {"ok":true}
```

## Безопасность

- `BOT_TOKEN` хранится как Cloudflare Secret — в коде и репозитории его нет.
- Записывающие эндпоинты требуют валидную подпись `initData`; `chat_id`
  берётся из подписанных данных — подменить чужой id нельзя.
- CORS ограничен доменом Pages (`ALLOWED_ORIGIN` в `wrangler.toml`).
- Лимит размера видео: 20 МБ.
