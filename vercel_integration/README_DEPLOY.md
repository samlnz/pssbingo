Vercel Integration — Webhook + Admin

Files in this folder are designed to be copied into your Vercel project (root) under `api/` so they run as serverless functions.

What the integration provides
- `api/webhook/test` — validation endpoint for Tasker/GitHub test scripts.
- `api/webhook/deposit` — accepts deposit payloads (Tasker/GitHub), creates a GitHub issue (label `deposit`) to persist the record, and notifies your Telegram admin chat.
- `api/admin/deposits` — protected (Basic auth) endpoint that lists `deposit` issues from GitHub.

Required environment variables (set in Vercel dashboard)
- `TELEGRAM_BOT_TOKEN` — your bot token
- `ADMIN_CHAT_ID` — numeric chat id to receive Telegram notifications
- `GITHUB_TOKEN` — a personal access token with `repo` scope to create/list issues
- `REPO_OWNER` — GitHub owner/org for the repo used to store issues
- `REPO_NAME` — GitHub repo name used to store issues
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — basic auth credentials for `/api/admin/deposits`

Deployment steps
1. Copy the contents of `vercel_integration/api/` into your Vercel project `api/` directory.
2. Add the required environment variables in Vercel (Project Settings → Environment Variables).
3. Push to your Git provider; Vercel will deploy the functions automatically.

Testing
- Use the provided `test_simple_webhook.py` or `test_webhook.py` (from your reference) to POST to `${YOUR_VERCEL_URL}/api/webhook/test` and `/api/webhook/deposit`.
- Admin: request `${YOUR_VERCEL_URL}/api/admin/deposits` with Basic auth header set to `ADMIN_USERNAME:ADMIN_PASSWORD`.

Notes
- This approach uses GitHub issues as a simple persistent store. If you prefer a database, replace the GitHub calls with DB calls.
- The functions use the Telegram Bot API directly to notify `ADMIN_CHAT_ID` — make sure `TELEGRAM_BOT_TOKEN` has correct permissions.
