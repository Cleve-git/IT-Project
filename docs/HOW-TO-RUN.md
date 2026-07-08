# How to Run Conda AI (yourself)

A step-by-step guide to run the project locally. Commands are for **Windows (Git Bash / PowerShell)**; macOS/Linux notes are inline.

---

## 0. Prerequisites (install once)

| Tool | Version | Check |
|------|---------|-------|
| **Python** | 3.10+ | `python --version` |
| **Node.js** | 18+ (20/22 fine) | `node --version` |
| **Git** | any | `git --version` |
| A **PostgreSQL** database | — | We use **Supabase** (cloud) |
| A **Groq** API key | free tier | https://console.groq.com |

You do **not** need to install PostgreSQL locally — the app connects to the Supabase database.

---

## 1. Get the code on the right branch

```bash
cd C:/PROJECTS/IT-Project        # your repo folder
git checkout THE-GOAT            # our working branch
git pull                         # get the latest
```

---

## 2. Backend (FastAPI) — Terminal 1

```bash
cd C:/PROJECTS/IT-Project/backend

# create the virtual env once
python -m venv .venv

# install dependencies (once, or when requirements.txt changes)
./.venv/Scripts/python.exe -m pip install -r requirements.txt

# run the API
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

> macOS/Linux: activate with `source .venv/bin/activate`, then `uvicorn app.main:app --port 8000`.

Backend is up when you see **"Application startup complete"**. Test it: open http://127.0.0.1:8000 — you should see a JSON health response, and http://127.0.0.1:8000/docs for the API docs.

### 2a. The `.env` file (already set up — here's what it needs)

`backend/.env` holds the secrets. It should contain:

```env
# Supabase — use the SESSION POOLER host, not the direct db.<ref>.supabase.co host
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
DATABASE_SYNC_URL=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres

# LLM
GROQ_API_KEY=<your-groq-key>
SQL_GENERATION_MODEL=openai/gpt-oss-120b
EXPLANATION_MODEL=openai/gpt-oss-120b

# Supabase auth (any values work for the sandbox login)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...

ENVIRONMENT=development
```

> **Important:** the Supabase **direct host** (`db.<ref>.supabase.co`) is IPv6-only and won't connect on most networks. Always use the **Session pooler** URL (Supabase dashboard → **Connect** → *Session pooler*).

---

## 3. Frontend (Next.js) — Terminal 2 (new window)

```bash
cd C:/PROJECTS/IT-Project/frontend

# install dependencies (once, or when package.json changes)
npm install

# run the dev server
npm run dev
```

Frontend is up at **http://localhost:3000**. It talks to the backend on port 8000 by default.

---

## 4. Use the app

1. Open **http://localhost:3000** → landing page.
2. Click **Get Started / Sign In**.
3. On the login page, click **Admin Sandbox** (fills `admin@cda.com`) → **Sign In**.
   - "User Sandbox" logs in as a non-admin (no Admin Panel).
4. Ask questions: *"What is our total revenue?"*, *"Top customers by revenue"*, then follow-ups like *"only the ones in Bandung"*.
5. **Admin Panel** (top-right, admin only) → Execution Logs, filters, PDF/CSV export, benchmarking.

---

## 5. Stopping / restarting

- **Stop** a server: press `Ctrl + C` in its terminal.
- **Restart** after code changes: the frontend hot-reloads automatically; the **backend must be restarted** (`Ctrl+C` then run the uvicorn command again).
- If a port is stuck (Windows):
  ```powershell
  # PowerShell — kill whatever holds port 8000 / 3000
  Get-CimInstance Win32_Process -Filter "name='python.exe'" | Where-Object { $_.CommandLine -like '*uvicorn*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "name='node.exe'"   | Where-Object { $_.CommandLine -like '*next*' }    | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  ```

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Backend won't start: *ModuleNotFoundError* | Re-run `pip install -r requirements.txt` inside the venv. |
| *could not translate host name db.<ref>.supabase.co* | Use the **Session pooler** URL in `.env` (see 2a), not the direct host. |
| Queries return nothing / LLM errors with **429** | Groq daily/rate limit hit. Switch `SQL_GENERATION_MODEL` in `.env` to another OpenRouter/Groq model that still has quota (e.g. `openai/gpt-oss-120b`, `llama-3.1-8b-instant`), then restart the backend. |
| Revenue shows **0** / wrong values | The DB enum values must match (`status='paid'`, `tier='Gold'`, etc.). This is already handled on THE-GOAT. |
| Frontend shows old UI / wrong theme | **Hard refresh**: `Ctrl + Shift + R`. If still stale, delete `frontend/.next` and `npm run dev` again. |
| "Backend connection failed" on login | The backend (port 8000) isn't running — start Terminal 1. |
| Chat history / tables error after switching branches | THE-GOAT and `main` have different table schemas — don't run both against the same Supabase DB. Use one branch at a time (or separate databases). |

---

## Quick reference (TL;DR)

```bash
# Terminal 1 — backend
cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev

# open http://localhost:3000  →  Admin Sandbox  →  Sign In
```
