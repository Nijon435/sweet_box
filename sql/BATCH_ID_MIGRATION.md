# Database Migration: Batch ID for Usage Logs

## Summary

This migration updates the `inventory_usage_logs` table to support batch logging, where multiple items can be recorded together and displayed as a single entry in the UI.

## Changes

### Database Schema Changes

1. **Added**: `batch_id` VARCHAR(64) column - Groups multiple items logged together
2. **Removed**: `order_id` column and its foreign key constraint
3. **Added**: Index on `batch_id` for better query performance
4. **Added**: Index on `created_at` for sorting

### Backend Changes (main.py)

- Updated GET `/api/inventory-usage-logs` to return `batchId` instead of `orderId`
- Updated POST `/api/inventory-usage-logs` to accept `batchId` instead of `orderId`
- Updated field mapping in `fetch_table_data()` to convert `batch_id` to `batchId`

### Frontend Changes

#### common.js

- Modified `logConsolidatedIngredientUsage()` to:
  - Generate a unique `batchId` for each batch of items
  - Create separate database entries for each item with the same `batchId`, `timestamp`, and `reason`
  - All items in a batch share the same notes and metadata

#### inventory.js

- Updated `renderUsageLogs()` to:
  - Group logs by `batchId`
  - Display batched entries as single rows with multiple items listed
  - Show standalone logs (without batchId) individually
  - Added `archiveBatchUsageLogs()` function to archive all logs in a batch

#### archive.js

- Updated `renderArchivedUsageLogs()` to:
  - Group archived logs by `batchId`
  - Display batched entries consolidated
  - Added `restoreBatchUsageLogs()` and `deleteBatchUsageLogs()` functions

## Migration Steps

### For Development/Local Database

```bash
# Navigate to sql directory
cd sql

# Run the migration
psql -h localhost -U your_username -d sweet_box -f add_batch_id_remove_order_id.sql
```

### For Production (Render)

The migration SQL file should be run on the production database:

```bash
# Using Render's shell or pgcli
psql postgresql://your_connection_string
\i add_batch_id_remove_order_id.sql
```

## How It Works

### Before (Old System)

- Multiple items logged together created one row with `inventoryItemId = null`
- Items stored in `consolidatedItems` JSON field
- Database couldn't properly track individual item quantities

**Example:**

```
| id | inventory_item_id | quantity | reason | notes        |
|----|-------------------|----------|--------|--------------|
| 1  | null              | 3.0      | waste  | Batch record |
```

### After (New System)

- Multiple items logged together create separate rows with the same `batch_id`
- Each row has its own `inventory_item_id` and `quantity`
- UI groups them by `batch_id` for display

**Example:**

```
| id | inventory_item_id | quantity | reason | batch_id      | notes        |
|----|-------------------|----------|--------|---------------|--------------|
| 1  | inv-9             | 1.0      | waste  | batch-123-abc | dropped tray |
| 2  | inv-20            | 1.0      | waste  | batch-123-abc | dropped tray |
| 3  | inv-14            | 1.0      | waste  | batch-123-abc | dropped tray |
```

**UI Display:**

```
Date/Time         | Item & Quantity                  | Reason | Notes        |
------------------|----------------------------------|--------|--------------|
12/3/2025 2:30 PM | Sugar (1 kg)                     | Waste  | dropped tray |
                  | Eggs (1 dozen)                   |        |              |
                  | Flour (1 kg)                     |        |              |
```

## Benefits

1. **Better Database Integrity**: Each item has proper foreign key relationship
2. **Accurate Inventory Tracking**: Individual item quantities properly recorded
3. **Clean UI**: Related items still displayed together
4. **Flexible Queries**: Can analyze by item or by batch
5. **No Data Loss**: Maintains all information from previous system

## Backward Compatibility

- Old single-item logs (without `batchId`) continue to work
- UI handles both batched and standalone entries
- No existing data is lost during migration

## Testing Checklist

- [ ] Migration runs successfully without errors
- [ ] New logs with multiple items create separate database rows
- [ ] UI displays batched logs as single consolidated entries
- [ ] Standalone logs display correctly
- [ ] Archive/restore operations work for both batched and standalone logs
- [ ] Delete operations work for both batched and standalone logs
- [ ] Old logs (if any) display correctly after migration
