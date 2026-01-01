Previewing SyncBingo Pro (local)

This workspace already contains your app source files. I added configs so you can run a local dev preview without modifying any existing files.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173 in your browser. Vite serves `index.html` in the project root (which already references your `index.tsx` and assets).

Notes

- I did not change any existing source files; only added project config files to enable local development.
- If you prefer pnpm or yarn, replace `npm install` with your package manager.

Telegram bot (deposit handling)

1. Create a `.env` file in the project root (or set env vars) using `.env.example` as reference.

2. Install dependencies and start the bot server (bot uses `telegraf` and a small Express admin API):

```bash
npm install
npm run start:bot
```

The bot listens for forwarded transfer/receipt messages and stores pending deposit records in `server/data/deposits.json`.

Admin API

- GET `/admin/deposits` returns JSON list of pending deposits.
- POST `/admin/approve/:id` marks a deposit approved and attempts to notify the user via Telegram.

Front-end

An admin button is available in the app UI to open a simple admin overlay that lists deposits and allows approving them.
 
Integration notes for your project

- Set `APP_URL` and `REMOTE_SERVER_URL` in your `.env` (both default to https://pssbingo.vercel.app in `.env.example`).
- Do NOT commit your `TELEGRAM_BOT_TOKEN` into source control. Set it as an environment variable before starting the bot.

Example (PowerShell):

```powershell
$env:TELEGRAM_BOT_TOKEN = "<your-token-here>"
$env:REMOTE_SERVER_URL = "https://pssbingo.vercel.app"
npm run start:bot
```

- The bot's `/webhook/deposit` handler will attempt to forward parsed deposits to `${REMOTE_SERVER_URL}/webhook/deposit` with JSON `{ amount, phone, forwarded_from, deposit_id }`.
- If your server expects a different endpoint or additional authentication, set `REMOTE_SERVER_URL` accordingly and ensure your server accepts forwarded requests from this bot server.

