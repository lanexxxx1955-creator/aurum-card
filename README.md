# AURUM CARD — видео-визитка для Telegram

Telegram Mini App: роскошная видео-визитка в стиле «чёрный + золото».
Пользователь проходит wizard из 4 шагов (язык → анкета → фото → видео-кружок с телесуфлёром)
и получает визитку, которой можно поделиться в Telegram в один клик.

## Стек

- React + TypeScript + Vite + Tailwind CSS
- Telegram WebApp API (`telegram-web-app.js`) с graceful fallback для браузера
- Видео-кружок: MediaRecorder API, хранение в IndexedDB
- Ссылка на визитку кодирует профиль (без бэкенда)

## Языки интерфейса

Русский, English + полный перевод на языки СНГ: беларуская, казахша, oʻzbekcha,
azərbaycan, հայերեն, кыргызча, тоҷикӣ, türkmençe, română.

## Монетизация

- **Free:** 1 визитка, видео 20 с, водяной знак.
- **PRO — 299 ₽/мес (Telegram Payments):** до 3 визиток, видео 60 с, без водяного знака,
  облачная доставка видео, аналитика просмотров, платиновые темы.
- **Реферальная механика:** 1 месяц PRO за 3 приглашённых друзей.

## Локальный запуск

```bash
npm install
npm run dev
```

## Деплой (GitHub Pages)

Пуш в `main` запускает workflow `.github/workflows/deploy.yml`.
Однократно включить: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Продакшн-архитектура (следующие шаги)

1. **Бот** (@BotFather): `/newapp` → привязать URL Pages к Mini App.
2. **Видео в Telegram:** Mini App отправляет видео боту (sendVideoNote / upload через Bot API),
   бот сохраняет `file_id` в БД; ссылка визитки несёт `startapp=<card_id>`,
   получатель видит фото+видео из Telegram CDN.
3. **Оплата:** Bot API `createInvoiceLink` (Telegram Payments, RUB, 299 ₽/мес),
   Mini App вызывает `openInvoice`.
