# Database Setup Instructions

This folder contains all the SQL files needed to set up and maintain the Sweet Box database.

## Files Overview

- **schema.sql** - Complete database schema with all tables
- **seeds.sql** - Sample data for testing and development
- **add_unit_column.sql** - Migration to add unit column to existing databases
- **run_migration.py** - Python script to run migrations automatically

## Initial Setup (New Database)

If you're setting up the database for the first time:

```bash
# 1. Create the database
createdb sweetbox

# 2. Run the schema
psql -U postgres -d sweetbox -f sql/schema.sql

# 3. Load sample data
psql -U postgres -d sweetbox -f sql/seeds.sql
```

## Migration (Existing Database)

If you already have a database and need to add the unit column:

### Option 1: Using Python script
```bash
# Make sure psycopg2 is installed
pip install psycopg2-binary

# Run the migration
python sql/run_migration.py
```

### Option 2: Using psql directly
```bash
psql -U postgres -d sweetbox -f sql/add_unit_column.sql
```

## Database Schema

### Main Tables

1. **users** - User accounts with roles and permissions
2. **attendance_logs** - Clock in/out records
3. **requests** - Leave and profile edit requests
4. **inventory** - Inventory items with units and tracking
5. **ingredient_usage_logs** - Detailed usage tracking (NEW)
6. **orders** - Customer orders
7. **sales_history** - Daily sales totals

### Key Features

- **Unit Metrics**: Inventory items now have units (kg, slices, whole, pieces, liters, ml, dozen, box, small, medium, large, other)
- **Reorder Points**: Each item has a reorder_point that determines when stock is "low"
- **Usage Tracking**: Separate logging for ingredient usage with reasons (order, waste, testing, staff_consumption, spoilage, other)
- **Status Calculation**: Item status (in stock, low stock, out of stock) is automatically determined by comparing quantity to reorder_point

## Environment Variables

For the Python migration script, set your database URL:

```bash
export DATABASE_URL="postgresql://username:password@hostname:port/database"
```

Or it will default to: `postgresql://postgres:postgres@localhost:5432/sweetbox`

## Sample Data

The seeds.sql file includes:
- 11 users (1 admin, staff members with different roles)
- 35 inventory items across 4 categories:
  - Cakes & Pastries (10 items)
  - Beverages (5 items)
  - Ingredients (10 items)
  - Supplies (10 items)
- 30 orders spanning 7 days
- Attendance logs
- Sales history

## Notes

- All inventory items now include proper units
- Some items are intentionally set to low stock to test alerts
- Reorder points are set based on typical usage patterns for each unit type
- The migration is idempotent (safe to run multiple times)
