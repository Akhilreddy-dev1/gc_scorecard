# Gamified Group Chat

FastAPI backend and React frontend for the private group chat and scorecard.

## Local setup

1. Copy `.env.example` to `.env` and set `AUTH_SECRET`, `MEMBER_PASSWORD_HASHES`, and database settings. Never commit `.env`.
2. Generate member password hashes locally with `python -m app.passwords`. It prompts for each member password and prints the JSON value to put in the backend-only `MEMBER_PASSWORD_HASHES` variable. Passwords and hashes must never be put in frontend variables or source code.
3. Install and start the backend from the repository root:

   ```sh
   python -m pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

4. In another terminal, run `cd frontend && npm install && npm run dev`.

The Vite development proxy sends `/api`, `/health`, and `/ws` to `http://localhost:8000`, which is the Uvicorn default. The backend requires a database connection and initializes its tables at startup. `GET /health` checks the database and returns HTTP 503 when it cannot connect.

## Deploy

The frontend is a separate Vercel project rooted at `frontend/`; its `vercel.json` rewrites app routes such as `/scorecard` to the SPA. The backend can run on Vercel Functions or a persistent Python host. Configure these **backend-only** environment variables on the backend deployment:

- `DATABASE_URL`: Supabase PostgreSQL **Session pooler** URI from Supabase → Connect. This must be a PostgreSQL URI, not the Supabase HTTPS project URL.
- `REDIS_URL`: TLS Redis URL (`rediss://...`) for broadcasts shared across backend instances.
- `AUTH_SECRET`: a long random signing key. Generate one locally with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `MEMBER_PASSWORD_HASHES`: JSON object printed by `python -m app.passwords`.
- `FRONTEND_ORIGINS`: comma-separated frontend origins, including `https://frontend-akhil-0cdc.vercel.app` and any custom domain.

In the frontend Vercel project, set these **build** environment variables to the deployed backend's domain (no trailing slash), then redeploy the frontend:

- `VITE_API_URL=https://<backend-domain>`
- `VITE_WS_URL=wss://<backend-domain>`

The frontend no longer silently falls back to the old Render URL. If these values are missing in production, login and chat show a backend configuration error. For Vercel Functions, enable Fluid compute for WebSocket routes; clients reconnect when a connection closes. Redis is needed to broadcast chat across function instances. See [Vercel's WebSocket guidance](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

### Railway backend

Create a Railway project from this GitHub repository and deploy the repository root as the backend service. Railway will install dependencies from `requirements.txt`; the root `Procfile` starts FastAPI on Railway's injected `$PORT`. In the Railway service's **Variables** panel, set:

- `DATABASE_URL` — Supabase PostgreSQL Session Pooler URI.
- `REDIS_URL` — TLS Redis URL beginning with `rediss://`.
- `AUTH_SECRET` — a long random signing secret.
- `MEMBER_PASSWORD_HASHES` — copy the full JSON value from the local `.env` after `MEMBER_PASSWORD_HASHES=`. The local legacy password setting was migrated to salted hashes. Do not commit `.env` or paste these values into GitHub.
- `FRONTEND_ORIGINS=https://frontend-akhil-0cdc.vercel.app`

Generate a Railway public domain for the backend, then set the frontend Vercel build variables `VITE_API_URL=https://<railway-domain>` and `VITE_WS_URL=wss://<railway-domain>`. Redeploy both services after setting their variables. Confirm `https://<railway-domain>/health` responds with `{"status":"ok"}`.

For Render, use a Python Web Service with build command `pip install -r requirements.txt` and the same Uvicorn start command. Add the backend secrets in the Render dashboard.

## API

- `GET /health` — checks database connectivity.
- `POST /api/auth/verify` — verifies an avatar password and returns a signed session.
- `GET /api/groups/{group_id}/scores` — reads the persisted leaderboard.
- `GET /api/scoring-rules` — reads scoring rules.
- `WS /ws/groups/{group_id}` — private chat, media, typing, and score events.
