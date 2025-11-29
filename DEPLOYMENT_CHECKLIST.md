# Sweet Box Deployment Checklist ✅

## Pre-Deployment Verification

### 1. Database Schema ✅

- [x] `users` table has `phone` field (VARCHAR(32))
- [x] All required tables exist in `sql/schema.sql`
- [x] Foreign key relationships properly defined

### 2. Frontend Features ✅

- [x] Phone number field added to registration form (login.html)
- [x] Phone number validation in registration logic
- [x] Phone number captured in user object creation
- [x] Edit profile modal includes phone field
- [x] Edit profile modal saves phone to database
- [x] Kitchen staff permissions for inventory access

### 3. Backend API ✅

- [x] FastAPI backend configured in `backend/main.py`
- [x] Database connection supports both individual vars and DATABASE_URL
- [x] CORS middleware configured with production domains
- [x] All required endpoints exist:
  - GET `/api/state` - Fetch all data
  - POST `/api/state` - Save all data
  - POST `/api/sync` - Sync individual tables

### 4. Database Save Functionality ✅

- [x] Edit profile button has event listener
- [x] Edit profile saves to `appState.users`
- [x] Changes persisted via `saveState()` function
- [x] Data syncs to backend database
- [x] Session storage updated after save
- [x] UI updated after successful save

### 5. Loading Screen ✅

- [x] Animated blur text effect implemented
- [x] Uses website color theme (brown background, sunset text)
- [x] Background transparency: `rgba(92, 44, 6, 0.85)`
- [x] Text color: `#ffdb8a` (sunset/light gold)
- [x] Shows on page load, hides after data fetch
- [x] Prevents false logouts during navigation

### 6. Deployment Files ✅

- [x] `Procfile` exists with correct start command
- [x] `render.yaml` configured for Render deployment
- [x] `backend/requirements.txt` has all dependencies
- [x] `runtime.txt` specifies Python version (if needed)
- [x] `.gitignore` excludes sensitive files

### 7. Environment Variables Required

Set these in Render dashboard:

- `DATABASE_URL` - PostgreSQL connection string (auto-populated by Render)
- `DB_HOST` - Database host
- `DB_PORT` - Database port (5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend URLs
- `RENDER` - Set to `true` for production

### 8. CSS Cleanup ✅

- [x] All inline styles extracted to `design.css`
- [x] User session styles use CSS classes
- [x] Spacing utilities created and applied
- [x] Live metrics grid uses CSS classes
- [x] Code maintainability improved

## Deployment Steps

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Deployment ready: Added phone field, updated loader, CSS cleanup"
   git push origin main
   ```

2. **Create Render Services**

   - Create PostgreSQL database (sweetbox-db)
   - Create Web Service from GitHub repo
   - Use `render.yaml` blueprint or manual setup

3. **Configure Environment**

   - Link database to web service
   - Verify all environment variables are set
   - Check CORS origins include production URL

4. **Initialize Database**

   - Connect to database via Render dashboard
   - Run `sql/schema.sql` to create tables
   - Optionally run `sql/seeds.sql` for demo data

5. **Deploy**

   - Trigger manual deploy or wait for auto-deploy
   - Monitor build logs for errors
   - Check application logs after deployment

6. **Post-Deployment Testing**
   - [ ] Test registration with phone number
   - [ ] Test login functionality
   - [ ] Test edit profile with phone update
   - [ ] Test kitchen staff can access inventory
   - [ ] Verify loading screen appears/disappears
   - [ ] Check all pages load correctly
   - [ ] Verify data persistence across sessions

## Known Issues / Notes

- Frontend uses localStorage for client-side state caching
- Backend syncs data to PostgreSQL database
- Phone field is required in registration form
- Edit profile allows updating email, phone, and password only
- Role/permission changes require admin intervention

## API Endpoints Reference

### GET /api/state

Returns all application data (users, inventory, orders, etc.)

### POST /api/state

Saves complete application state to database

### POST /api/sync

Syncs specific table data to database
Body: `{ "table": "users", "data": [...] }`

## Contact

For issues during deployment, check:

1. Render build logs
2. Application logs in Render dashboard
3. Browser console for frontend errors
4. Network tab for API request failures
