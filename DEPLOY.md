# Deploying FinSlate to finslate.aeos365.com (cPanel)

## Prerequisites
- Node.js ≥ 20 enabled in cPanel
- MySQL database created in cPanel → MySQL Databases
- Google OAuth credentials with redirect URI set to `https://finslate.aeos365.com/api/auth/google/callback`

---

## Step 1 — Upload the code

Upload the entire project to the subdomain's document root, e.g.  
`/home/<cpanel_user>/finslate.aeos365.com/`

Recommended methods:
- **Git**: `git clone` your repo on the server (via cPanel Terminal)
- **File Manager / FTP**: Upload the zip and extract

---

## Step 2 — Create the `.env` file

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
nano .env          # or edit via cPanel File Manager
```

Key values to set:
| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://finslate.aeos365.com/api/auth/google/callback` |
| `DB_USER` | cPanel MySQL user (format: `cpaneluser_dbuser`) |
| `DB_PASSWORD` | MySQL user password |
| `DB_NAME` | cPanel MySQL DB name (format: `cpaneluser_finslate`) |
| `SESSION_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLIENT_ORIGIN` | `https://finslate.aeos365.com` |
| `NODE_ENV` | `production` |
| `VITE_API_BASE_URL` | *(leave empty)* |

---

## Step 3 — Install dependencies & build the client

Run these in the project root (via cPanel Terminal or SSH):

```bash
npm install          # installs all server deps (now in root package.json)
npm run build:prod   # installs client deps + builds React app → client/dist
```

> **Note**: Server dependencies live in the root `package.json` so a single
> `npm install` at the project root is enough — no separate `cd server && npm install` needed.

---

## Step 4 — Configure the Node.js App in cPanel

1. cPanel → **Software → Node.js App** → **Create Application**
2. Set:
   - **Node.js version**: 20.x (or latest available)
   - **Application mode**: Production
   - **Application root**: `/home/<cpanel_user>/finslate.aeos365.com`
   - **Application URL**: `finslate.aeos365.com`
   - **Application startup file**: `server/index.js`
3. Click **Create** — cPanel auto-generates the `.htaccess` proxy rules
4. Add environment variables from `.env` in the cPanel UI **(optional — prefer `.env` file)**
5. Click **Run NPM Install** if you haven't already done it via terminal

---

## Step 5 — Start the app

Click **Start** in cPanel → Node.js App.

The server will:
1. Auto-run DB migrations (create tables if missing)
2. Serve the built React app from `client/dist`
3. Handle all `/api/*` routes

---

## Step 6 — Verify

- Visit `https://finslate.aeos365.com` — should load the app
- Visit `https://finslate.aeos365.com/api/health` — should return `{"ok":true,...}`
- Click **Sign in with Google** — should redirect and authenticate

---

## Redeployment (updates)

```bash
git pull                 # pull latest code
npm run build:prod       # rebuild client
# Restart app in cPanel → Node.js App → Restart
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| 503 / 502 on all pages | App not started — check cPanel Node.js App status |
| OAuth redirect mismatch | Ensure Google Console has `https://finslate.aeos365.com/api/auth/google/callback` |
| DB connection error | Check `DB_USER`/`DB_PASSWORD`/`DB_NAME` format (`cpaneluser_` prefix) |
| Session not persisting | Ensure `SESSION_SECRET` is set and `NODE_ENV=production` |
| White screen / JS errors | Client not built — re-run `npm run build:prod` |
