# Database Setup Instructions

This folder contains the SQL files needed to set up and maintain the Sweet Box database.

## Files Overview

- **schema.sql** - Complete database schema with all tables (PostgreSQL)
- **seeds.sql** - Sample data for testing and development
- **queries.sql** - Example SQL queries for common operations (reference only, not used by the app)

## Database Configuration

The application uses the **Render production database** for both local development and production.

Set your DATABASE_URL in `backend/.env`:

```bash
DATABASE_URL=postgresql://username:password@hostname:port/database
```

## Initial Setup

### 1. Create the database schema

```bash
psql -U username -d database -f sql/schema.sql
```

### 2. (Optional) Insert sample data

```bash
psql -U username -d database -f sql/seeds.sql
```

## Database Schema

### Main Tables

1. **users** - User accounts with roles and permissions (replaces old employees table)
2. **attendance_logs** - Clock in/out records
3. **requests** - Leave and profile edit requests
4. **inventory** - Inventory items with units and tracking
5. **inventory_usage_logs** - Tracking usage of inventory items
6. **orders** - Customer orders (no status field - simple order history)
7. **sales_history** - Daily sales totals
8. **inventory_trends** - Usage metrics for analytics

### Key Features

- **Archive Support** - All main tables support soft deletion with archived flag
- **Foreign Key Constraints** - Maintains data integrity
- **JSONB Fields** - Used for flexible data storage (order items, profile changes)
- **Timestamps** - Automatic timestamps for created_at fields
- **Cascade Deletes** - Proper cleanup when parent records are removed
- **Unit Metrics** - Inventory items now have units (kg, slices, whole, pieces, liters, ml, dozen, box, small, medium, large, other)
- **Reorder Points** - Each item has a reorder_point that determines when stock is "low"

## Common Queries

See `queries.sql` for examples of:

- Getting latest attendance per employee
- Finding low stock items
- Fetching recent orders
- Generating sales reports
- Managing inventory usage
- And more...

**Note:** queries.sql is for reference only - the application uses the FastAPI backend to query data.

## Sample Data

The seeds.sql file includes:

- Multiple users (admin and staff members with different roles)
- 35+ inventory items across 4 categories:
  - Cakes & Pastries
  - Beverages
  - Ingredients
  - Supplies
- Sample orders spanning multiple days
- Attendance logs
- Sales history

## Notes

- All inventory items include proper units
- Some items are intentionally set to low stock to test alerts
- Reorder points are set based on typical usage patterns for each unit type
- The migration is idempotent (safe to run multiple times)
- The application connects to Render production database for both local and production environments
