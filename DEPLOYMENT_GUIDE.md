# Sweet Box - Render Deployment Guide

## Prerequisites

- GitHub account
- Render account (free tier is fine)
- PostgreSQL database on Render

## Step-by-Step Deployment

### 1. **Prepare Your Repository**

```bash
# Make sure .env is not committed (it's in .gitignore)
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. **Create PostgreSQL Database on Render**

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `sweetbox-db`
   - **Database**: `sweetbox`
   - **User**: `sweetbox_user`
   - **Region**: Choose closest to you
   - **Plan**: Free
4. Click **Create Database**
5. Wait for database to provision (2-3 minutes)

### 3. **Run Database Setup**

Once database is created:

1. Get connection details from Render dashboard:

   - **Internal Database URL** (for backend connection)
   - **External Database URL** (for running migrations)

2. Run schema and seeds using External URL:

```bash
# From your local terminal
psql <EXTERNAL_DATABASE_URL> -f sql/schema.sql
psql <EXTERNAL_DATABASE_URL> -f sql/seeds.sql
```

Or use Render's PSQL console:

1. Go to your database → **Connect** → **PSQL Command**
2. Copy and paste the contents of `sql/schema.sql`
3. Then copy and paste the contents of `sql/seeds.sql`

### 4. **Deploy Backend API**

1. Go to Render Dashboard → **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:

   - **Name**: `sweetbox-backend`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

4. Add Environment Variables:

   - `DB_HOST`: (from database Internal Connection)
   - `DB_PORT`: `5432`
   - `DB_NAME`: `sweetbox`
   - `DB_USER`: (from database credentials)
   - `DB_PASSWORD`: (from database credentials)
   - Or use single `DATABASE_URL`: (Internal Database URL from Render)

5. Click **Create Web Service**

### 5. **Deploy Frontend**

1. Go to Render Dashboard → **New +** → **Static Site**
2. Connect your GitHub repository
3. Configure:

   - **Name**: `sweetbox-frontend`
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Build Command**: Leave empty
   - **Publish Directory**: `.`

4. Add Rewrite Rules (to proxy API requests):

   - Go to **Redirects/Rewrites** tab
   - Add rewrite rule:
     - **Source**: `/api/*`
     - **Destination**: `https://sweetbox-backend.onrender.com/api/:splat`
     - **Type**: `Rewrite`

5. Click **Create Static Site**

### 6. **Update CORS Settings**

After deployment, update backend CORS to include your frontend URL:

1. Go to backend service → **Environment**
2. Add variable:

   - **Key**: `ALLOWED_ORIGINS`
   - **Value**: `https://your-frontend-name.onrender.com`

3. Save and wait for redeployment

## Alternative: Blueprint Deployment (Easier)

Using the included `render.yaml` file:

1. Go to Render Dashboard
2. Click **New +** → **Blueprint**
3. Connect your GitHub repository
4. Render will automatically:

   - Create PostgreSQL database
   - Deploy backend service
   - Deploy frontend static site
   - Configure environment variables

5. After deployment, manually run the SQL scripts on the database

## Post-Deployment

### Test the API

```bash
curl https://your-backend-name.onrender.com/api/state
```

### Access Your Application

- Frontend: `https://your-frontend-name.onrender.com`
- Backend API: `https://your-backend-name.onrender.com`

## Important Notes

### Free Tier Limitations

- Services spin down after 15 minutes of inactivity
- First request after inactivity may take 30-60 seconds
- Database has 90-day expiration (upgrade to persist longer)

### Database Backups

Regular backups recommended:

```bash
pg_dump <EXTERNAL_DATABASE_URL> > backup_$(date +%Y%m%d).sql
```

### Environment Variables

Never commit `.env` file. Use Render's environment variable UI instead.

## Troubleshooting

### Database Connection Issues

- Verify DB_HOST uses **Internal Database URL** hostname
- Check DB_PASSWORD is correct
- Ensure database is in same region as backend

### CORS Errors

- Add frontend URL to `ALLOWED_ORIGINS` environment variable
- Format: `https://your-app.onrender.com` (no trailing slash)

### Slow Initial Load

- This is normal for free tier (cold starts)
- Consider upgrading to paid tier for persistent services

## Maintenance

### Update Database Schema

```bash
psql <EXTERNAL_DATABASE_URL> -f sql/migrations.sql
```

### View Logs

- Go to service on Render dashboard
- Click **Logs** tab
- Filter by time range or search terms

### Manual Deployment

- Push to GitHub → Auto-deploys
- Or trigger manual deploy from Render dashboard

## Support

For issues, check Render documentation: https://render.com/docs
