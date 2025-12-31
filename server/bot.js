import fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // optional: chat id where admin notifications are sent
// Mini app URL (default to user's provided app link if not set)
const APP_URL = process.env.APP_URL || 'https://pssbingo.vercel.app';
// Remote project URL to forward deposit events (set to your server)
const REMOTE_SERVER_URL = process.env.REMOTE_SERVER_URL || 'https://pssbingo.vercel.app';
const PORT = process.env.PORT || 3001;
const DATA_FILE = './server/data/deposits.json';

if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in env. Exiting.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function loadDeposits() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

async function saveDeposits(list) {
  await fs.mkdir('./server/data', { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function isLikelyTransferText(text) {
  if (!text) return false;
  return /transfer|upi|txid|transaction|reference|receipt|account|IFSC|bank|amount/i.test(text);
}

bot.start((ctx) => {
  return ctx.reply('Welcome to SyncBingo deposit bot. Forward your transfer/receipt message to me to register a deposit.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Launch Mini App', web_app: { url: APP_URL } }]]
    }
  });
});

// Command to explicitly send the web app/open button
bot.command('open', (ctx) => {
  return ctx.reply('Open SyncBingo in Telegram:', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open SyncBingo', web_app: { url: APP_URL } }]]
    }
  });
});

bot.on('message', async (ctx) => {
  try {
    const msg = ctx.message;
    const text = msg.text || '';
    const forwarded = !!(msg.forward_from || msg.forward_from_chat || msg.forward_sender_name);

    if (forwarded || isLikelyTransferText(text)) {
      const deposits = await loadDeposits();
      const id = Date.now();
      const record = {
        id,
        from: ctx.from ? { id: ctx.from.id, name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() } : null,
        chatId: ctx.chat && ctx.chat.id ? ctx.chat.id : null,
        text: text || '[non-text message] file/receipt forwarded',
        date: new Date().toISOString(),
        approved: false
      };
      deposits.push(record);
      await saveDeposits(deposits);

      await ctx.reply('✅ Deposit details received and marked as pending. Admin will verify soon.');

      if (ADMIN_CHAT_ID) {
        try {
          await bot.telegram.sendMessage(ADMIN_CHAT_ID, `New deposit received (id: ${id}) from ${record.from ? record.from.name : 'unknown'}` + `\n\n${record.text}`);
        } catch (e) {
          console.warn('Failed to notify admin chat', e.message || e);
        }
      }
      return;
    }

    // Fallback: generic help
    await ctx.reply('Please forward a transfer receipt or send the transfer details text.');
  } catch (e) {
    console.error('Error handling message', e);
  }
});

// Launch bot
bot.launch().then(() => console.log('Telegram bot started'));

// Express admin API
const app = express();
app.use(cors());
app.use(express.json());

// Basic auth middleware for admin routes
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'password';

function requireAdminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Unauthorized');
  }
  const creds = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [user, pass] = creds.split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(403).send('Forbidden');
}

app.get('/admin/deposits', async (req, res) => {
  // Protected admin endpoint
  try {
    const list = await loadDeposits();
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/admin/approve/:id', requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const deposits = await loadDeposits();
  const idx = deposits.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  deposits[idx].approved = true;
  deposits[idx].approvedAt = new Date().toISOString();
  await saveDeposits(deposits);

  // notify user if possible
  try {
    const rec = deposits[idx];
    if (rec.from && rec.from.id) {
      await bot.telegram.sendMessage(rec.from.id, `✅ Your deposit (id: ${rec.id}) has been approved by admin.`);
    }
  } catch (e) {
    console.warn('Could not notify user about approval', e.message || e);
  }

  res.json({ ok: true, id });
});

app.get('/launch', (req, res) => {
  res.json({ url: APP_URL });
});

// Webhook endpoints compatible with provided workflow/test scripts
app.post('/webhook/test', async (req, res) => {
  try {
    const data = req.body;
    const headers = req.headers || {};

    // Echo basic validation info for client-side testing scripts
    const validation = {
      received: data,
      headers: headers,
      ok: true
    };

    // Recognize simple Tasker payload (amount, phone)
    if (data && typeof data.amount !== 'undefined' && data.phone) {
      validation.format = 'tasker';
    } else if (headers['x-github-event']) {
      validation.format = 'github';
    } else {
      validation.format = 'unknown';
    }

    return res.json(validation);
  } catch (e) {
    console.error('webhook/test error', e);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/webhook/deposit', async (req, res) => {
  try {
    const data = req.body || {};
    const headers = req.headers || {};

    // Support Tasker format: { amount, phone }
    let amount = null;
    let phone = null;

    if (typeof data.amount !== 'undefined') amount = Number(data.amount) || null;
    if (data.phone) phone = String(data.phone);

    // Support GitHub issue format (issue.title carries details)
    if ((!amount || !phone) && data.issue && data.issue.title) {
      const title = data.issue.title;
      // naive parse: look for digits as amount and phone-like token
      const amtMatch = title.match(/\b(\d+(?:\.\d+)?)\b/);
      if (amtMatch) amount = Number(amtMatch[1]);
      const phoneMatch = title.match(/(09\d{7,8}|\+?\d{7,15})/);
      if (phoneMatch) phone = phoneMatch[1];
    }

    if (!amount || !phone) {
      return res.status(400).json({ error: 'invalid_payload', details: { amount, phone } });
    }

    const deposits = await loadDeposits();
    const id = Date.now();
    const record = {
      id,
      amount,
      phone,
      raw: data,
      date: new Date().toISOString(),
      approved: false,
      source: headers['x-github-event'] ? 'github' : 'tasker'
    };
    deposits.push(record);
    await saveDeposits(deposits);

    // Notify admin chat if configured
    if (ADMIN_CHAT_ID) {
      try {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, `New deposit (id: ${id}) amount: ${amount} phone: ${phone}` + `\n\nSource: ${record.source}`);
      } catch (e) {
        console.warn('Failed to notify admin chat', e.message || e);
      }
    }

    // Forward the deposit to the remote project server if configured
    try {
      const forwardUrl = `${REMOTE_SERVER_URL.replace(/\/$/, '')}/webhook/deposit`;
      await fetch(forwardUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone, forwarded_from: 'telegram-bot', deposit_id: id })
      });
    } catch (e) {
      console.warn('Failed to forward deposit to remote server:', e.message || e);
    }

    return res.json({ ok: true, id });
  } catch (e) {
    console.error('webhook/deposit error', e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Attempt to lookup user by phone on remote server and attach to deposit record
async function tryAttachUserByPhone(phone, recordId) {
  if (!REMOTE_SERVER_URL) return null;
  const lookupUrl = (process.env.REMOTE_USER_LOOKUP_URL || `${REMOTE_SERVER_URL.replace(/\/$/, '')}/api/user-by-phone`);
  try {
    const resp = await fetch(`${lookupUrl}?phone=${encodeURIComponent(phone)}`, { method: 'GET' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.telegram_id || data.user_id)) {
        // attach to our local deposit record
        const deposits = await loadDeposits();
        const idx = deposits.findIndex(d => d.id === recordId);
        if (idx !== -1) {
          deposits[idx].matchedUser = data;
          await saveDeposits(deposits);
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('User lookup failed', e.message || e);
  }
  return null;
}

// Simple admin dashboard (server-rendered)
app.get('/admin', requireAdminAuth, async (req, res) => {
  try {
    const deposits = await loadDeposits();
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Admin Deposits</title><style>body{font-family:sans-serif;background:#071229;color:#fff}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #233}</style></head><body><h1>Deposits</h1><table><thead><tr><th>ID</th><th>Amount</th><th>Phone</th><th>Date</th><th>Approved</th><th>Actions</th></tr></thead><tbody>`;
    for (const d of deposits) {
      html += `<tr><td>${d.id}</td><td>${d.amount}</td><td>${d.phone}</td><td>${d.date}</td><td>${d.approved? 'Yes':'No'}</td><td>`;
      if (!d.approved) html += `<form method="POST" action="/admin/approve/${d.id}" style="display:inline"><button type="submit">Approve</button></form>`;
      html += `</td></tr>`;
    }
    html += `</tbody></table></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (e) {
    return res.status(500).send('Internal');
  }
});


app.listen(PORT, () => console.log(`Admin API listening on http://localhost:${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
