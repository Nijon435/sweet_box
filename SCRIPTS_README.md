# 🗂️ Useful Scripts

This folder contains utility scripts for database management.

## 📥 sync_data_from_render.py

**Purpose:** Sync data from your live Render database to local pgAdmin

**When to use:**

- After making changes on the live site
- To update your local development database
- To backup production data locally

**How to use:**

```bash
# 1. Update .env with your local database password:
LOCAL_DB_PASSWORD=your_password

# 2. Run the sync:
python sync_data_from_render.py
```

## 📁 SQL Files (sql/)

### schema.sql

- Database table definitions
- Run this first when setting up a new database
- Contains the complete structure for all tables

### seeds.sql

- Sample/initial data for development
- Includes test users, inventory items, and orders
- Use for fresh database setup

### queries.sql

- Common SQL queries for reference
- Useful for database management and debugging

---

## ⚙️ Setup Instructions

### First Time Setup:

1. Update `.env` with your credentials
2. Create database: `CREATE DATABASE sweetbox;`
3. Run schema: `psql -d sweetbox -f sql/schema.sql`
4. Run seeds: `psql -d sweetbox -f sql/seeds.sql`

### Sync Production to Local:

1. Update `.env` LOCAL_DB_PASSWORD
2. Run: `python sync_data_from_render.py`

---

**Note:** The database fix scripts have been removed as they were one-time use only.
