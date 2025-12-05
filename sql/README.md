# Database Setup Instructions

This folder contains the SQL files needed to set up and maintain the Sweet Box database.

## Files Overview

- **schema.sql** - Complete database schema with all tables (PostgreSQL)
- **seeds.sql** - Sample data for testing and development
- **queries.sql** - Example SQL queries for common operations

## Database Configuration

The application uses the **Render production database** for both local development and production.

Set your DATABASE_URL in `.env`:

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

1. **users** - User accounts with roles and permissions
2. **attendance_logs** - Clock in/out records
3. **requests** - Leave and profile edit requests
4. **inventory** - Inventory items with units and tracking
5. **inventory_usage_logs** - Tracking usage of inventory items
6. **orders** - Customer orders
7. **sales_history** - Daily sales totals
8. **inventory_trends** - Weekly usage metrics for analytics

### Key Features

- **Archive Support** - All main tables support soft deletion with archived flag
- **Foreign Key Constraints** - Maintains data integrity
- **JSONB Fields** - Used for flexible data storage (order items, profile changes)
- **Timestamps** - Automatic timestamps for created_at fields
- **Cascade Deletes** - Proper cleanup when parent records are removed

## Common Queries

See `queries.sql` for examples of:

- Getting latest attendance per employee
- Finding low stock items
- Filtering orders by status
- Generating sales reports
- And more...

5. **ingredient_usage_logs** - Detailed usage tracking (NEW)
6. **orders** - Customer orders
7. **sales_history** - Daily sales totals

### Key Features

- **Unit Metrics**: Inventory items now have units (kg, slices, whole, pieces, liters, ml, dozen, box, small, medium, large, other)
- **Reorder Points**: Each item has a reorder_point that determines when stock is "low"
- **Usage Tracking**: Separate logging for ingredient usage with reasons (order, waste, testing, staff_consumption, spoilage, other)
- **Status Calculation**: Item status (in stock, low stock, out of stock) is automatically determined by comparing quantity to reorder_point

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
- The application connects to Render production database for both local and production environments
