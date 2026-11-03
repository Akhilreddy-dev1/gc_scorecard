# Gamified Group Chat

FastAPI and React app for a group chat where messages and media activity award configurable points.

## Run locally

1. Copy `.env.example` to `.env`. Leave database values blank for SQLite, or set the separate Supabase/Postgres values. Database passwords are URL-encoded by the app.
2. Install backend dependencies: `python -m pip install -r requirements.txt`.
3. Start the API from the repository root: `uvicorn app.main:app --reload`.
4. In another terminal, run `cd frontend && npm install && npm run dev`.

The Vite development server proxies API and WebSocket requests to `http://localhost:8000`. Open the URL printed by Vite, enter your name, then choose **Create room** and provide a room name, or choose **Join room** and enter a teammate's room code. A room code is a UUID and can be shared from the room header.

## Deploy the backend to Render

Use a Python Web Service with:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

The service must bind to `0.0.0.0` and Render's `$PORT`. The repository includes `render.yaml` for this configuration.

For separate frontend and backend deployments, set `VITE_API_URL` and `VITE_WS_URL` in the frontend build environment (see `frontend/.env.example`). Set `FRONTEND_ORIGINS` on the API to a comma-separated list of allowed frontend origins. The production frontend defaults to the Render service URL declared in `render.yaml`; confirm that this service is deployed and healthy before using the live site.

## Backend

Database tables and default scoring rules are initialized on startup. The API provides:

- `GET /health` for a health check
- `POST /api/session` to create or join a room and establish a user
- `GET /api/groups/{group_id}/scores` to load the persisted leaderboard
- `GET /api/scoring-rules` to load the current rules
- `WS /ws/groups/{group_id}` for real-time chat and score updates

Default points are 3 for text messages, 1 for reactions, 4 for media uploads, and 5 for reel shares. Image/video uploads are shared in memory as data URLs, with a 2 MB client-side size limit; score totals persist in the configured database.
