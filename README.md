# Gamified Group Chat

FastAPI and React scaffold for a group chat where messages and media activity award configurable points.

## Backend

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to the Supabase PostgreSQL connection string.
2. Install dependencies with `python -m pip install -r requirements.txt`.
3. Start the API with `uvicorn app.main:app --reload`.

The backend creates the SQLAlchemy tables on startup and seeds these rules when they are missing:

| Action | Points |
| --- | ---: |
| `text_message` | 3 |
| `reaction` | 1 |
| `media_upload` | 4 |
| `share_reel` | 5 |

`GET /api/scoring-rules` returns the current rules. Group rooms use `WS /ws/groups/{group_id}` and accept `text`, `reaction`, `media`, and `reel_share` event payloads.

## Frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

Set `VITE_API_URL` and `VITE_WS_URL` when the API is not running on `localhost:8000`.
