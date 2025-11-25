# Database Auto-Sync Setup

## Overview

Your Sweet Box application now automatically syncs all data changes to the PostgreSQL database in real-time. Every time you create, update, or delete data, it will be saved to both localStorage and the database.

## Features

- **Auto-save**: All changes are automatically saved to the database after a 500ms delay (debounced)
- **Before-unload sync**: Data is saved when you refresh the page, close the tab, or navigate away
- **Local backup**: Data is always saved to localStorage first for instant access

## Setup Instructions

### 1. Run Database Migrations

First, apply the schema updates to add missing columns:

```bash
# Connect to your PostgreSQL database
psql -U postgres -d sweetbox

# Run the migration script
\i sql/migrations.sql
```

Or if you're setting up from scratch:

```bash
psql -U postgres -d sweetbox -f sql/schema.sql
```

### 2. Configure Backend

Make sure your `.env` file in the `backend/` folder has the correct database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sweetbox
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 3. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Start the Backend Server

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

The backend API will run on `http://localhost:8000`

### 5. Start the Frontend

Use Live Server or any local server to serve the HTML files. Make sure it's accessible at one of these URLs:

- http://localhost:8000
- http://127.0.0.1:5500
- http://localhost:3000

## How It Works

### Auto-Save on Changes

Every time you call `saveState()` in the code (which happens after every create/update/delete operation), the system will:

1. Save to localStorage immediately
2. Wait 500ms for any additional changes (debouncing)
3. Send the full state to the database via POST /api/state

### Save on Page Refresh

When you refresh the page or close the tab:

1. The `beforeunload` event triggers
2. Data is saved to localStorage synchronously
3. A final sync request is sent to the database

### Data Flow

```
User Action → Update appState → saveState() → localStorage + Database
```

## Testing

### Verify Backend is Running

Open `http://localhost:8000/docs` in your browser to see the FastAPI interactive documentation.

### Test Database Sync

1. Open your application in the browser
2. Make a change (e.g., add an order, update inventory)
3. Check the browser console - you should see "State synced to database successfully"
4. Query your database to verify:
   ```sql
   SELECT * FROM orders ORDER BY timestamp DESC LIMIT 5;
   SELECT * FROM inventory;
   ```

### Check for Errors

- Browser console: Check for sync errors
- Backend logs: Look at the terminal running uvicorn for database errors
- Network tab: Inspect the POST /api/state request/response

## Troubleshooting

### "Unable to sync to database" in console

- Make sure the backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify your frontend URL is in the `allow_origins` list

### Database connection errors

- Verify PostgreSQL is running
- Check `.env` file credentials
- Test connection: `psql -U postgres -d sweetbox`

### Data not saving

- Check browser console for JavaScript errors
- Verify `saveState()` is being called after data changes
- Check backend logs for SQL errors

## API Endpoints

### GET /api/state

Fetches all data from the database

- Returns: JSON object with all application state

### POST /api/state

Saves complete application state to database

- Body: JSON object with application state
- Deletes old data and inserts new data for each table

### PUT /api/inventory/{item_id}

Updates a specific inventory item

- Body: Inventory update object

## Notes

- The sync is debounced (500ms delay) to avoid excessive database writes
- All tables are cleared and repopulated on each save to ensure consistency
- For production, consider implementing incremental updates instead of full replacements
