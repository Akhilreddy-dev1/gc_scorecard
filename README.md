# Gamified Group Chat

## Private group Vercel configuration

The backend login endpoint verifies avatar passwords server-side. Configure backend-only environment variables in Vercel:

- `MEMBER_PASSWORDS`: JSON object keyed by member id (`akhil`, `varun`, `yaswanth`, `binduja`, `haasini`, `shreeraj`, `swejith`, `hasini`, `harini`, `vaagdevi`, `avinash`, `dheeraj`). Store the assigned passwords as Vercel secrets; do not add them to frontend variables or source files.
- `AUTH_SECRET`: long random signing secret for login sessions.
- `DATABASE_URL`, `REDIS_URL`, and `FRONTEND_ORIGINS` as described below.

The frontend is a separate Vercel project rooted at `frontend/`; `frontend/vercel.json` rewrites direct routes such as `/scorecard` to the SPA.

FastAPI and React app for a group chat where messages and media activity award configurable points.

## Run locally

1. Copy `.env.example` to `.env`. Leave database values blank for SQLite, or set the separate Supabase/Postgres values. Database passwords are URL-encoded by the app.
2. Install backend dependencies: `python -m pip install -r requirements.txt`.
3. Start the API from the repository root: `uvicorn app.main:app --reload`.
4. In another terminal, run `cd frontend && npm install && npm run dev`.

The Vite development server proxies API and WebSocket requests to `http://localhost:8000`. Open the URL printed by Vite, enter your name, then choose **Create room** and provide a room name, or choose **Join room** and enter a teammate's room code. A room code is a UUID and can be shared from the room header.

## Deploy the backend to Vercel

Create a separate Vercel project for the backend from this repository:

1. Import the GitHub repository again in Vercel and set **Root Directory** to the repository root. Keep the existing frontend Vercel project rooted at `frontend/`.
2. Vercel detects the FastAPI app through `pyproject.toml` and deploys it as a Python Function. No Uvicorn start command or port setting is needed.
3. Add these environment variables to the backend Vercel project for Production and Preview:
   - `DATABASE_URL`: the Supabase **Session pooler** PostgreSQL URI from **Supabase → Connect**. This is the database URI, not the `https://<project-ref>.supabase.co` API URL.
   - `REDIS_URL`: a TLS Redis connection URI from a Redis provider such as Upstash, used as the shared channel for room chat across Vercel Function instances.
   - `FRONTEND_ORIGINS`: comma-separated frontend origins, including `https://frontend-akhil-0cdc.vercel.app` and any custom domain.
4. Deploy and confirm `https://<backend-project>.vercel.app/health` returns `{"status":"ok"}`.
5. In the frontend Vercel project, set `VITE_API_URL=https://<backend-project>.vercel.app` and `VITE_WS_URL=wss://<backend-project>.vercel.app` for Production and Preview, then redeploy the frontend.

Redis is required for reliable chat delivery across separate Vercel Function instances. Without it, the fallback broadcasts only to sockets connected to the same instance. The frontend reconnects automatically if Vercel closes a long-running WebSocket connection.

## Deploy the backend to Render

Use a Python Web Service with:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

The service must bind to `0.0.0.0` and Render's `$PORT`; otherwise Render reports that no port was found.
The included `render.yaml` also configures `/health` as the Render health check and leaves database secrets for the Render dashboard.

For separate frontend and backend deployments, set `VITE_API_URL` and `VITE_WS_URL` in the frontend build environment (see `frontend/.env.example`). Set `FRONTEND_ORIGINS` on the API to a comma-separated list of allowed frontend origins.

### Connect Render to Supabase

In the Supabase dashboard, open **Connect** and copy the database URI. For a long-running Render web service on IPv4, use the **Session pooler** URI; its host, username, and port differ from the project API URL. Set the full URI as Render's `DATABASE_URL` value. Do not use `<project-ref>.supabase.co` as the database host. The app requires SSL, uses a short connection timeout, and disables automatic prepared statements for compatibility with Supabase's transaction pooler.

## Backend

Database tables and default scoring rules are initialized on startup. The API provides:

- `GET /health` for a health check
- `POST /api/session` to create or join a room and establish a user
- `GET /api/groups/{group_id}/scores` to load the persisted leaderboard
- `GET /api/scoring-rules` to load the current rules
- `WS /ws/groups/{group_id}` for real-time chat and score updates

Default points are 3 for text messages, 1 for reactions, 4 for media uploads, and 5 for reel shares. Image/video uploads are shared in memory as data URLs, with a 2 MB client-side size limit; score totals persist in the configured database.
