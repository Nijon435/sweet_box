# Sweet Box Backend API

This is a minimal FastAPI backend for the Sweet Box app. It provides a `/api/state` endpoint that returns all business data from your PostgreSQL database as JSON for the frontend.

## Setup

1. Install Python 3.8+
2. Install dependencies:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your database credentials:
   ```powershell
   cp .env.example .env
   # or manually create .env and fill in DB_HOST, DB_PORT, etc.
   ```

## Running the API

```powershell
uvicorn main:app --reload --port 8000
```

- The API will be available at http://localhost:8000/api/state
- The frontend will fetch from this endpoint.

## Testing

- Open http://localhost:8000/api/state in your browser or use:
  ```powershell
  curl http://localhost:8000/api/state
  ```
- You should see JSON with keys: employees, attendanceLogs, inventory, orders, salesHistory, inventoryUsage, performanceScores, stockTrends, users.

## Troubleshooting

- If you get DB connection errors, check your `.env` settings and ensure PostgreSQL is running and accessible.
- If you need to change CORS settings, edit `main.py`.
