import os
import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
import json
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

# Database configuration - Always use Render production database
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please set it in your .env file.")

# Parse DATABASE_URL
import re
match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)
if match:
    DB_USER = match.group(1)
    DB_PASSWORD = match.group(2)
    DB_HOST = match.group(3)
    DB_PORT = int(match.group(4)) if match.group(4) else 5432
    DB_NAME = match.group(5)
else:
    raise ValueError("Invalid DATABASE_URL format. Expected: postgresql://user:pass@host:port/dbname")

app = FastAPI()

# CORS configuration - allow production domains
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else [
    "http://localhost:8000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]

# Add frontend URL for Render deployment
if os.getenv("RENDER"):
    ALLOWED_ORIGINS.extend([
        "https://sweetbox-frontend.onrender.com",
        "https://sweetbox-backend.onrender.com"
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TABLES = [
    "users",
    "attendance_logs",
    "inventory",
    "orders",
    "sales_history",
    "inventory_trends",
    "inventory_usage_logs",
    "requests"  # Renamed from leave_requests
]

async def fetch_table(conn, table):
    try:
        # Add limits to prevent overwhelming responses and localStorage quota issues
        limit_map = {
            "attendance_logs": 100,  # Last 100 attendance records (reduced from 1000)
            "sales_history": 90,     # Last 90 days sales (reduced from 500)
            "orders": 200,           # Last 200 orders (reduced from 500)
            "inventory_trends": 50,  # Last 50 trend records for analytics graphs
            "stock_trends": 50,      # Last 50 trend records (reduced from 500)
        }
        
        # Different ordering columns for different tables
        order_by_map = {
            "sales_history": "date DESC",
            "orders": "timestamp DESC",
            "attendance_logs": "timestamp DESC",
            "inventory_trends": "id DESC",
            "users": "created_at DESC",
        }
        
        limit = limit_map.get(table, None)
        order_by = order_by_map.get(table, "id DESC")
        
        if limit:
            query = f'SELECT * FROM {table} ORDER BY {order_by} LIMIT {limit}'
        else:
            query = f'SELECT * FROM {table} ORDER BY {order_by}'
            
        logger.info(f"Executing query for {table}: {query}")
        rows = await conn.fetch(query)
        logger.info(f"Fetched {len(rows)} rows from {table}")
        
        result = []
        for row in rows:
            item = dict(row)
            # Convert snake_case to camelCase for frontend compatibility
            if table == "orders":
                if "items_json" in item:
                    # If items_json is already a dict/list (from JSONB), use as-is
                    # Otherwise it will be None or a string that needs no processing
                    items_json = item.pop("items_json")
                    # Don't convert to string - keep as native Python object
                    item["itemsJson"] = items_json
                if "served_at" in item:
                    item["servedAt"] = item.pop("served_at")
                if "archived_at" in item:
                    item["archivedAt"] = item.pop("archived_at")
                if "archived_by" in item:
                    item["archivedBy"] = item.pop("archived_by")
            if table == "users":
                if "hire_date" in item:
                    item["hireDate"] = item.pop("hire_date")
                if "shift_start" in item:
                    item["shiftStart"] = item.pop("shift_start")
                if "created_at" in item:
                    item["createdAt"] = item.pop("created_at")
                if "require_password_reset" in item:
                    item["requirePasswordReset"] = item.pop("require_password_reset")
                if "archived_at" in item:
                    item["archivedAt"] = item.pop("archived_at")
                if "archived_by" in item:
                    item["archivedBy"] = item.pop("archived_by")
            if table == "attendance_logs":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
                if "archived_at" in item:
                    item["archivedAt"] = item.pop("archived_at")
                if "archived_by" in item:
                    item["archivedBy"] = item.pop("archived_by")
            if table == "requests":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
                if "start_date" in item:
                    item["startDate"] = item.pop("start_date")
                if "end_date" in item:
                    item["endDate"] = item.pop("end_date")
                if "requested_at" in item:
                    item["requestedAt"] = item.pop("requested_at")
                if "reviewed_by" in item:
                    item["reviewedBy"] = item.pop("reviewed_by")
                if "reviewed_at" in item:
                    item["reviewedAt"] = item.pop("reviewed_at")
                if "request_type" in item:
                    item["requestType"] = item.pop("request_type")
                if "requested_changes" in item:
                    item["requestedChanges"] = item.pop("requested_changes")
            if table == "sales_history" and "orders_count" in item:
                item["ordersCount"] = item.pop("orders_count")
            if table == "inventory":
                if "date_purchased" in item:
                    item["datePurchased"] = item.pop("date_purchased")
                if "use_by_date" in item:
                    item["useByDate"] = item.pop("use_by_date")
                if "expiry_date" in item:
                    item["expiryDate"] = item.pop("expiry_date")
                if "reorder_point" in item:
                    item["reorderPoint"] = item.pop("reorder_point")
                if "last_restocked" in item:
                    item["lastRestocked"] = item.pop("last_restocked")
                if "total_used" in item:
                    item["totalUsed"] = item.pop("total_used")
                if "created_at" in item:
                    item["createdAt"] = item.pop("created_at")
                if "archived_at" in item:
                    item["archivedAt"] = item.pop("archived_at")
                if "archived_by" in item:
                    item["archivedBy"] = item.pop("archived_by")
            if table == "inventory_usage_logs":
                if "inventory_item_id" in item:
                    item["inventoryItemId"] = item.pop("inventory_item_id")
                if "batch_id" in item:
                    item["batchId"] = item.pop("batch_id")
                if "created_at" in item:
                    item["createdAt"] = item.pop("created_at")
                if "archived_at" in item:
                    item["archivedAt"] = item.pop("archived_at")
                if "archived_by" in item:
                    item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        if table == "users" and result:
            logger.info(f"Sample user data: {result[0]}")
        
        return result
    except Exception as e:
        logger.error(f"Error fetching {table}: {e}")
        return []

class InventoryUpdate(BaseModel):
    id: str
    quantity: float
    category: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    reorder_point: Optional[int] = None
    cost: Optional[float] = None

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Sweet Box API",
        "version": "1.0.0"
    }

@app.get("/db-structure")
async def check_db_structure():
    """Check actual database table structures"""
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Get orders table structure
        orders_cols = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'orders'
            ORDER BY ordinal_position;
        """)
        
        # Get inventory table structure
        inventory_cols = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'inventory'
            ORDER BY ordinal_position;
        """)
        
        await conn.close()
        
        return {
            "orders": [dict(col) for col in orders_cols],
            "inventory": [dict(col) for col in inventory_cols]
        }
    except Exception as e:
        logger.error(f"Error checking DB structure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Detailed health check with database status"""
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        await conn.close()
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/state")
async def get_state():
    try:
        logger.info(f"Connecting to DB: {DB_HOST}:{DB_PORT}/{DB_NAME} as {DB_USER}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        logger.info("DB connection successful")
        data = {}
        for table in TABLES:
            logger.info(f"Fetching table: {table}")
            data[table] = await fetch_table(conn, table)
        # Calculate attendance trend from logs (last 30 days)
        from datetime import datetime, timedelta
        attendance_trend = []
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        logger.info(f"Calculating attendance trend with {len(data['attendance_logs'])} total logs")
        
        for i in range(29, -1, -1):  # Last 30 days
            day = today - timedelta(days=i)
            day_end = day + timedelta(days=1)
            
            present_count = 0
            late_count = 0
            
            # Count clock-in logs for this specific day
            for log in data["attendance_logs"]:
                if log.get("action") != "in" or log.get("archived", False):
                    continue
                    
                timestamp_str = log.get("timestamp")
                if not timestamp_str:
                    continue
                    
                try:
                    log_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    # Check if log is within this day
                    if day <= log_time < day_end:
                        # Check note field for 'late' status (status column doesn't exist in schema)
                        if log.get("note") == "late":
                            late_count += 1
                        else:
                            present_count += 1
                except Exception as e:
                    logger.warning(f"Error parsing timestamp {timestamp_str}: {e}")
                    pass
            
            # Count on-leave users for this day
            on_leave_count = 0
            for user in data["users"]:
                leave_until = user.get("leaveUntil")
                if leave_until:
                    try:
                        leave_date = datetime.fromisoformat(leave_until.replace('Z', '+00:00'))
                        # Check if this day is within the leave period (user is on leave until this date)
                        if day <= leave_date:
                            on_leave_count += 1
                    except Exception as e:
                        logger.warning(f"Error parsing leave date {leave_until}: {e}")
                        pass
            
            attendance_trend.append({
                "label": day.strftime("%m/%d"),
                "present": present_count,
                "late": late_count,
                "onLeave": on_leave_count
            })
        
        logger.info(f"Generated {len(attendance_trend)} days of attendance trend data")
        if attendance_trend:
            logger.info(f"Sample attendance entry: {attendance_trend[-1]}")
        
        await conn.close()
        logger.info("Returning data successfully")
        # Rename keys to match frontend expectations
        return {
            "users": data["users"],
            "attendanceLogs": data["attendance_logs"],
            "inventory": data["inventory"],
            "orders": data["orders"],
            "salesHistory": data["sales_history"],
            "inventoryTrends": data["inventory_trends"],
            "inventoryUsageLogs": data["inventory_usage_logs"],
            "requests": data["requests"],
            "attendanceTrend": attendance_trend
        }
    except Exception as e:
        logger.error(f"Error in /api/state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/inventory-partial/{item_id}")
async def update_inventory_partial(item_id: str, update: InventoryUpdate):
    """Partial update for inventory (legacy endpoint for quantity-only updates)"""
    try:
        logger.info(f"Updating inventory item {item_id}: {update}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Build dynamic UPDATE query
        updates = []
        values = []
        param_count = 1
        
        if update.quantity is not None:
            updates.append(f"quantity = ${param_count}")
            values.append(update.quantity)
            param_count += 1
        if update.category is not None:
            updates.append(f"category = ${param_count}")
            values.append(update.category)
            param_count += 1
        if update.name is not None:
            updates.append(f"name = ${param_count}")
            values.append(update.name)
            param_count += 1
        if update.unit is not None:
            updates.append(f"unit = ${param_count}")
            values.append(update.unit)
            param_count += 1
        if update.reorder_point is not None:
            updates.append(f"reorder_point = ${param_count}")
            values.append(update.reorder_point)
            param_count += 1
        if update.cost is not None:
            updates.append(f"cost = ${param_count}")
            values.append(update.cost)
            param_count += 1
        
        if not updates:
            await conn.close()
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.append(item_id)
        update_sql = f"UPDATE inventory SET {', '.join(updates)} WHERE id = ${param_count}"
        
        logger.info(f"Executing: {update_sql} with values {values}")
        await conn.execute(update_sql, *values)
        await conn.close()
        
        logger.info(f"Successfully updated {item_id}")
        return {"success": True, "id": item_id}
    except Exception as e:
        logger.error(f"Error updating inventory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def parse_timestamp(ts_str):
    """Parse ISO timestamp string to datetime object, or return None if invalid"""
    if not ts_str:
        return None
    try:
        # Handle ISO format with 'Z' or '+00:00'
        if isinstance(ts_str, str):
            # Replace 'Z' with '+00:00' for proper parsing
            ts_str = ts_str.replace('Z', '+00:00')
            dt = datetime.fromisoformat(ts_str)
            # Convert to naive datetime (remove timezone info) for PostgreSQL
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            return dt
        return ts_str
    except:
        return None

def parse_date(date_str):
    """Parse date string to date object, or return None if invalid"""
    if not date_str:
        return None
    try:
        if isinstance(date_str, str):
            return datetime.fromisoformat(date_str).date()
        return date_str
    except:
        return None

def parse_time(time_str):
    """Parse time string (HH:MM or HH:MM:SS) to time object, or return None if invalid"""
    if not time_str:
        return None
    try:
        if isinstance(time_str, str):
            # Handle HH:MM or HH:MM:SS format
            parts = time_str.split(':')
            if len(parts) == 2:
                hour, minute = int(parts[0]), int(parts[1])
                return datetime.strptime(f"{hour:02d}:{minute:02d}", "%H:%M").time()
            elif len(parts) == 3:
                return datetime.strptime(time_str, "%H:%M:%S").time()
        return time_str
    except:
        return None

@app.put("/api/orders/{order_id}")
async def update_order(order_id: str, order: dict):
    """Update a single order (for archiving, status changes, etc.)"""
    try:
        logger.info(f"Updating order {order_id}: {order}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Frontend sends itemsJson (array), not items (string)
        items_data = order.get("itemsJson") or order.get("items_json") or order.get("items", [])
        if isinstance(items_data, str):
            # If it's already a JSON string, parse it
            try:
                items_data = json.loads(items_data)
            except:
                items_data = []
        items_json = json.dumps(items_data)
        
        await conn.execute(
            """INSERT INTO orders (id, customer, items_json, total, type, archived, archived_at, archived_by, timestamp)
               VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO UPDATE SET
               customer = EXCLUDED.customer,
               items_json = EXCLUDED.items_json,
               total = EXCLUDED.total,
               type = EXCLUDED.type,
               archived = EXCLUDED.archived,
               archived_at = EXCLUDED.archived_at,
               archived_by = EXCLUDED.archived_by,
               timestamp = EXCLUDED.timestamp""",
            order.get("id"),
            order.get("customer"),
            items_json,
            order.get("total"),
            order.get("type"),
            order.get("archived", False),
            parse_timestamp(order.get("archivedAt")),
            order.get("archivedBy"),
            parse_timestamp(order.get("timestamp"))
        )
        
        await conn.close()
        logger.info(f"Successfully updated order {order_id}")
        return {"success": True, "id": order_id}
    except Exception as e:
        logger.error(f"Error updating order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/orders/{order_id}")
async def delete_order(order_id: str):
    """Permanently delete an order"""
    try:
        logger.info(f"Deleting order {order_id}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute("DELETE FROM orders WHERE id = $1", order_id)
        await conn.close()
        
        logger.info(f"Successfully deleted order {order_id}")
        return {"success": True, "id": order_id}
    except Exception as e:
        logger.error(f"Error deleting order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ========== EXPORT API ENDPOINTS (No Limits) ==========

@app.get("/api/export/inventory")
async def export_inventory():
    """Get all inventory items for export"""
    try:
        logger.info("Fetching all inventory for export")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        query = "SELECT * FROM inventory WHERE archived = FALSE ORDER BY category, name"
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            if "date_purchased" in item:
                item["datePurchased"] = item.pop("date_purchased")
            if "use_by_date" in item:
                item["useByDate"] = item.pop("use_by_date")
            if "expiry_date" in item:
                item["expiryDate"] = item.pop("expiry_date")
            if "reorder_point" in item:
                item["reorderPoint"] = item.pop("reorder_point")
            if "last_restocked" in item:
                item["lastRestocked"] = item.pop("last_restocked")
            if "total_used" in item:
                item["totalUsed"] = item.pop("total_used")
            if "created_at" in item:
                item["createdAt"] = item.pop("created_at")
            if "archived_at" in item:
                item["archivedAt"] = item.pop("archived_at")
            if "archived_by" in item:
                item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        logger.info(f"Returning {len(result)} inventory items for export")
        return result
    except Exception as e:
        logger.error(f"Error fetching inventory for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/inventory-usage")
async def export_inventory_usage():
    """Get all inventory usage logs for export"""
    try:
        logger.info("Fetching all inventory usage logs for export")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        query = "SELECT * FROM inventory_usage_logs WHERE archived = FALSE ORDER BY created_at DESC"
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            if "inventory_item_id" in item:
                item["inventoryItemId"] = item.pop("inventory_item_id")
            if "batch_id" in item:
                item["batchId"] = item.pop("batch_id")
            if "created_at" in item:
                item["createdAt"] = item.pop("created_at")
            if "archived_at" in item:
                item["archivedAt"] = item.pop("archived_at")
            if "archived_by" in item:
                item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        logger.info(f"Returning {len(result)} usage logs for export")
        return result
    except Exception as e:
        logger.error(f"Error fetching inventory usage for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/orders")
async def export_orders():
    """Get all orders for export"""
    try:
        logger.info("Fetching all orders for export")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        query = "SELECT * FROM orders WHERE archived = FALSE ORDER BY timestamp DESC"
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            if "items_json" in item:
                items_json = item.pop("items_json")
                item["itemsJson"] = items_json
            if "served_at" in item:
                item["servedAt"] = item.pop("served_at")
            if "archived_at" in item:
                item["archivedAt"] = item.pop("archived_at")
            if "archived_by" in item:
                item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        logger.info(f"Returning {len(result)} orders for export")
        return result
    except Exception as e:
        logger.error(f"Error fetching orders for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/sales")
async def export_sales():
    """Get all sales history for export"""
    try:
        logger.info("Fetching all sales history for export")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        query = "SELECT * FROM sales_history ORDER BY date DESC"
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            if "orders_count" in item:
                item["ordersCount"] = item.pop("orders_count")
            result.append(item)
        
        logger.info(f"Returning {len(result)} sales records for export")
        return result
    except Exception as e:
        logger.error(f"Error fetching sales for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/users")
async def export_users():
    """Get all users/employees for export"""
    try:
        logger.info("Fetching all users for export")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        query = "SELECT * FROM users WHERE archived = FALSE ORDER BY name"
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            if "hire_date" in item:
                item["hireDate"] = item.pop("hire_date")
            if "shift_start" in item:
                item["shiftStart"] = item.pop("shift_start")
            if "created_at" in item:
                item["createdAt"] = item.pop("created_at")
            if "require_password_reset" in item:
                item["requirePasswordReset"] = item.pop("require_password_reset")
            if "archived_at" in item:
                item["archivedAt"] = item.pop("archived_at")
            if "archived_by" in item:
                item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        logger.info(f"Returning {len(result)} users for export")
        return result
    except Exception as e:
        logger.error(f"Error fetching users for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/attendance")
async def export_attendance(employee_id: str = None, month: str = None):
    """Get attendance logs for export with optional filters
    
    Args:
        employee_id: Filter by specific employee ID
        month: Filter by month in YYYY-MM format
    """
    conn = None
    try:
        logger.info(f"Fetching attendance logs for export: employee_id={employee_id}, month={month}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Build query with filters
        query = "SELECT * FROM attendance_logs WHERE archived = FALSE"
        params = []
        param_count = 1
        
        if employee_id:
            query += f" AND employee_id = ${param_count}"
            params.append(employee_id)
            param_count += 1
        
        if month:
            # Month format: YYYY-MM
            import calendar
            year, month_num = map(int, month.split('-'))
            last_day = calendar.monthrange(year, month_num)[1]
            
            # Use simple date strings that PostgreSQL can handle
            start_date = f"{year}-{month_num:02d}-01"
            end_date = f"{year}-{month_num:02d}-{last_day:02d}"
            
            # Compare using date extraction from timestamp
            query += f" AND DATE(timestamp) >= ${param_count}::date AND DATE(timestamp) <= ${param_count + 1}::date"
            params.append(start_date)
            params.append(end_date)
            param_count += 2
        
        query += " ORDER BY timestamp DESC"
        
        logger.info(f"Final query: {query}")
        logger.info(f"Query params: {params}")
        
        if params:
            rows = await conn.fetch(query, *params)
        else:
            rows = await conn.fetch(query)
        
        result = []
        for row in rows:
            item = dict(row)
            if "employee_id" in item:
                item["employeeId"] = item.pop("employee_id")
            if "archived_at" in item:
                item["archivedAt"] = item.pop("archived_at")
            if "archived_by" in item:
                item["archivedBy"] = item.pop("archived_by")
            result.append(item)
        
        logger.info(f"Returning {len(result)} attendance logs for export")
        if result:
            logger.info(f"First timestamp: {result[0].get('timestamp')}, Last timestamp: {result[-1].get('timestamp')}")
        return result
    except Exception as e:
        logger.error(f"Error fetching attendance for export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            await conn.close()

# ========== END EXPORT API ENDPOINTS ==========

@app.get("/api/attendance-logs")
async def get_attendance_logs(start_date: str = None, end_date: str = None, limit: int = 1000):
    """Get attendance logs with optional date range filtering"""
    try:
        logger.info(f"Fetching attendance logs: start_date={start_date}, end_date={end_date}, limit={limit}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        if start_date and end_date:
            # Convert string dates to datetime objects for asyncpg
            from datetime import datetime as dt
            start_dt = dt.fromisoformat(start_date)
            end_dt = dt.fromisoformat(end_date)
            
            # Fetch logs within date range
            rows = await conn.fetch(
                """SELECT * FROM attendance_logs 
                   WHERE timestamp >= $1 AND timestamp < $2 
                   ORDER BY timestamp DESC 
                   LIMIT $3""",
                start_dt,
                end_dt,
                limit
            )
        elif start_date:
            # Fetch logs from start_date onwards
            from datetime import datetime as dt
            start_dt = dt.fromisoformat(start_date)
            
            rows = await conn.fetch(
                """SELECT * FROM attendance_logs 
                   WHERE timestamp >= $1 
                   ORDER BY timestamp DESC 
                   LIMIT $2""",
                start_dt,
                limit
            )
        else:
            # Fetch recent logs
            rows = await conn.fetch(
                """SELECT * FROM attendance_logs 
                   ORDER BY timestamp DESC 
                   LIMIT $1""",
                limit
            )
        
        await conn.close()
        
        # Serialize the rows properly, converting datetime objects to ISO strings
        logs = []
        for row in rows:
            log = dict(row)
            # Convert timestamp to ISO string if it's a datetime object
            if log.get('timestamp') and isinstance(log['timestamp'], datetime):
                log['timestamp'] = log['timestamp'].isoformat()
            # Convert archived_at to ISO string if it's a datetime object
            if log.get('archived_at') and isinstance(log['archived_at'], datetime):
                log['archived_at'] = log['archived_at'].isoformat()
            logs.append(log)
        
        logger.info(f"Successfully fetched {len(logs)} attendance logs")
        return logs
    except Exception as e:
        logger.error(f"Error fetching attendance logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/attendance-logs")
async def create_attendance_log(log: dict):
    """Create a new attendance log"""
    try:
        logger.info(f"Creating new attendance log: {log}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute(
            """INSERT INTO attendance_logs (id, employee_id, timestamp, action, note, shift, archived, archived_at, archived_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            log.get("id"),
            log.get("employeeId"),
            parse_timestamp(log.get("timestamp")),
            log.get("action"),
            log.get("note"),
            log.get("shift", None),
            log.get("archived", False),
            parse_timestamp(log.get("archivedAt")),
            log.get("archivedBy")
        )
        
        await conn.close()
        logger.info(f"Successfully created attendance log {log.get('id')}")
        return {"success": True, "id": log.get("id")}
    except Exception as e:
        logger.error(f"Error creating attendance log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/attendance-logs/{log_id}")
async def update_attendance_log(log_id: str, log: dict):
    """Update a single attendance log (for archiving, etc.)"""
    try:
        logger.info(f"Updating attendance log {log_id}: {log}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute(
            """INSERT INTO attendance_logs (id, employee_id, timestamp, action, note, shift, archived, archived_at, archived_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO UPDATE SET
               employee_id = EXCLUDED.employee_id,
               timestamp = EXCLUDED.timestamp,
               action = EXCLUDED.action,
               note = EXCLUDED.note,
               shift = EXCLUDED.shift,
               archived = EXCLUDED.archived,
               archived_at = EXCLUDED.archived_at,
               archived_by = EXCLUDED.archived_by""",
            log.get("id"),
            log.get("employeeId"),
            parse_timestamp(log.get("timestamp")),
            log.get("action"),
            log.get("note"),
            log.get("shift", None),  # Default to None if not provided
            log.get("archived", False),
            parse_timestamp(log.get("archivedAt")),
            log.get("archivedBy")
        )
        
        await conn.close()
        logger.info(f"Successfully updated attendance log {log_id}")
        return {"success": True, "id": log_id}
    except Exception as e:
        logger.error(f"Error updating attendance log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/attendance-logs/{log_id}")
async def delete_attendance_log(log_id: str):
    """Permanently delete an attendance log"""
    try:
        logger.info(f"Deleting attendance log {log_id}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        result = await conn.execute(
            "DELETE FROM attendance_logs WHERE id = $1",
            log_id
        )
        
        await conn.close()
        logger.info(f"Successfully deleted attendance log {log_id}")
        return {"success": True, "id": log_id}
    except Exception as e:
        logger.error(f"Error deleting attendance log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/inventory-usage-logs")
async def get_usage_logs():
    """Get all inventory usage logs"""
    try:
        logger.info("Fetching inventory usage logs")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        rows = await conn.fetch(
            """SELECT iul.*, u.name as user_name 
               FROM inventory_usage_logs iul
               LEFT JOIN users u ON iul.created_by = u.id
               WHERE iul.archived = FALSE
               ORDER BY iul.created_at DESC LIMIT 500"""
        )
        
        logs = []
        for row in rows:
            logs.append({
                "id": row["id"],
                "inventoryItemId": row["inventory_item_id"],
                "quantity": float(row["quantity"]),
                "reason": row["reason"],
                "batchId": row.get("batch_id"),
                "notes": row["notes"],
                "timestamp": row["created_at"].isoformat() if row["created_at"] else None,
                "createdBy": row.get("created_by"),  # Return user ID
                "userName": row["user_name"] if row["user_name"] else "System",  # Return user name separately
                "archived": row.get("archived", False),
            })
        
        await conn.close()
        logger.info(f"Fetched {len(logs)} usage logs")
        return logs
    except Exception as e:
        logger.error(f"Error fetching usage logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/inventory-usage-logs")
async def create_usage_log(log: dict):
    """Create a new inventory usage log"""
    try:
        logger.info(f"Creating usage log: {log}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Parse and validate timestamp
        timestamp = parse_timestamp(log.get("timestamp"))
        if not timestamp:
            timestamp = datetime.now()
            logger.warning(f"Invalid timestamp, using current time: {timestamp}")
        
        # Get user_id from session if available
        user_id = log.get("userId") or log.get("createdBy")
        
        await conn.execute(
            """INSERT INTO inventory_usage_logs (inventory_item_id, quantity, reason, batch_id, notes, created_at, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            log.get("inventoryItemId"),
            float(log.get("quantity", 0)),
            log.get("reason"),
            log.get("batchId"),
            log.get("notes"),
            timestamp,
            user_id
        )
        
        await conn.close()
        logger.info(f"Successfully created usage log for item {log.get('inventoryItemId')}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error creating usage log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/inventory-usage-logs/{log_id}")
async def update_usage_log(log_id: int, log: dict):
    """Update a single inventory usage log (for archiving, etc.)"""
    try:
        logger.info(f"Updating usage log {log_id}: {log}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute(
            """UPDATE inventory_usage_logs SET
               archived = $1,
               archived_at = $2,
               archived_by = $3
               WHERE id = $4""",
            log.get("archived", False),
            parse_timestamp(log.get("archivedAt")),
            log.get("archivedBy"),
            log_id
        )
        
        await conn.close()
        logger.info(f"Successfully updated usage log {log_id}")
        return {"success": True, "id": log_id}
    except Exception as e:
        logger.error(f"Error updating usage log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/inventory-usage-logs/{log_id}")
async def delete_usage_log(log_id: str):
    """Permanently delete an inventory usage log"""
    try:
        logger.info(f"Deleting usage log {log_id}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute("DELETE FROM inventory_usage_logs WHERE id = $1", int(log_id))
        await conn.close()
        
        logger.info(f"Successfully deleted usage log {log_id}")
        return {"success": True, "id": log_id}
    except Exception as e:
        logger.error(f"Error deleting usage log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user: dict):
    """Update a single user (for editing profile, archiving, etc.)"""
    try:
        logger.info(f"Updating user {user_id}: {user}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute(
            """INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, require_password_reset, archived, archived_at, archived_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_TIMESTAMP))
               ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               password = EXCLUDED.password,
               phone = EXCLUDED.phone,
               role = EXCLUDED.role,
               permission = EXCLUDED.permission,
               shift_start = EXCLUDED.shift_start,
               hire_date = EXCLUDED.hire_date,
               status = EXCLUDED.status,
               require_password_reset = EXCLUDED.require_password_reset,
               archived = EXCLUDED.archived,
               archived_at = EXCLUDED.archived_at,
               archived_by = EXCLUDED.archived_by""",
            user.get("id"),
            user.get("name"),
            user.get("email"),
            user.get("password"),
            user.get("phone"),
            user.get("role"),
            user.get("permission", "staff"),
            parse_time(user.get("shiftStart")),
            parse_date(user.get("hireDate")),
            user.get("status", "active"),
            user.get("requirePasswordReset", False),
            user.get("archived", False),
            parse_timestamp(user.get("archivedAt")),
            user.get("archivedBy"),
            parse_timestamp(user.get("createdAt")) if user.get("createdAt") else None
        )
        
        await conn.close()
        logger.info(f"Successfully updated user {user_id}")
        return {"success": True, "id": user_id}
    except Exception as e:
        logger.error(f"Error updating user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    """Permanently delete a user"""
    try:
        logger.info(f"Deleting user {user_id}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute("DELETE FROM users WHERE id = $1", user_id)
        await conn.close()
        
        logger.info(f"Successfully deleted user {user_id}")
        return {"success": True, "id": user_id}
    except Exception as e:
        logger.error(f"Error deleting user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/inventory/{item_id}")
async def update_inventory_item(item_id: str, item: dict):
    """Update a single inventory item (for editing, archiving, etc.)"""
    try:
        logger.info(f"Updating inventory item {item_id}: {item}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute(
            """INSERT INTO inventory (id, name, category, quantity, unit, cost, date_purchased, use_by_date, expiry_date, reorder_point, last_restocked, total_used, archived, archived_at, archived_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               quantity = EXCLUDED.quantity,
               unit = EXCLUDED.unit,
               cost = EXCLUDED.cost,
               date_purchased = EXCLUDED.date_purchased,
               use_by_date = EXCLUDED.use_by_date,
               expiry_date = EXCLUDED.expiry_date,
               reorder_point = EXCLUDED.reorder_point,
               last_restocked = EXCLUDED.last_restocked,
               total_used = EXCLUDED.total_used,
               archived = EXCLUDED.archived,
               archived_at = EXCLUDED.archived_at,
               archived_by = EXCLUDED.archived_by""",
            item.get("id"),
            item.get("name"),
            item.get("category"),
            item.get("quantity"),
            item.get("unit", "pieces"),
            item.get("cost"),
            parse_date(item.get("datePurchased")),
            parse_date(item.get("useByDate")),
            parse_date(item.get("expiryDate")),
            item.get("reorderPoint", 10),
            parse_date(item.get("lastRestocked")),
            item.get("totalUsed", 0),
            item.get("archived", False),
            parse_timestamp(item.get("archivedAt")),
            item.get("archivedBy")
        )
        
        await conn.close()
        logger.info(f"Successfully updated inventory item {item_id}")
        return {"success": True, "id": item_id}
    except Exception as e:
        logger.error(f"Error updating inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/inventory/{item_id}")
async def delete_inventory_item(item_id: str):
    """Permanently delete an inventory item"""
    try:
        logger.info(f"Deleting inventory item {item_id}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        await conn.execute("DELETE FROM inventory WHERE id = $1", item_id)
        await conn.close()
        
        logger.info(f"Successfully deleted inventory item {item_id}")
        return {"success": True, "id": item_id}
    except Exception as e:
        logger.error(f"Error deleting inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/requests")
async def create_request(request: dict):
    """Create a new leave or profile edit request"""
    try:
        logger.info(f"Creating new request: {request}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Insert request into database
        # Handle requestedChanges properly - don't double-encode
        requested_changes = request.get("requestedChanges")
        if requested_changes:
            if isinstance(requested_changes, str):
                # Already a JSON string, use as-is
                requested_changes_json = requested_changes
            else:
                # It's a dict/object, serialize it
                requested_changes_json = json.dumps(requested_changes)
        else:
            requested_changes_json = None
            
        await conn.execute(
            """INSERT INTO requests (id, employee_id, request_type, start_date, end_date, reason, requested_changes, status, requested_at, reviewed_by, reviewed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO NOTHING""",
            request.get("id"),
            request.get("employeeId"),
            request.get("requestType"),
            parse_date(request.get("startDate")),
            parse_date(request.get("endDate")),
            request.get("reason"),
            requested_changes_json,
            request.get("status", "pending"),
            parse_timestamp(request.get("requestedAt")),
            request.get("reviewedBy"),
            parse_timestamp(request.get("reviewedAt"))
        )
        
        await conn.close()
        logger.info(f"Successfully created request {request.get('id')}")
        return {"success": True, "id": request.get("id")}
    except Exception as e:
        logger.error(f"Error creating request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/requests/{request_id}")
async def update_request(request_id: str, request: dict):
    """Update an existing request (for status changes, approval, etc.)"""
    try:
        logger.info(f"Updating request {request_id}: {request}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Handle requestedChanges properly - don't double-encode
        requested_changes = request.get("requestedChanges")
        if requested_changes:
            if isinstance(requested_changes, str):
                # Already a JSON string, use as-is
                requested_changes_json = requested_changes
            else:
                # It's a dict/object, serialize it
                requested_changes_json = json.dumps(requested_changes)
        else:
            requested_changes_json = None
            
        await conn.execute(
            """INSERT INTO requests (id, employee_id, request_type, start_date, end_date, reason, requested_changes, status, requested_at, reviewed_by, reviewed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
               employee_id = EXCLUDED.employee_id,
               request_type = EXCLUDED.request_type,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               reason = EXCLUDED.reason,
               requested_changes = EXCLUDED.requested_changes,
               status = EXCLUDED.status,
               requested_at = EXCLUDED.requested_at,
               reviewed_by = EXCLUDED.reviewed_by,
               reviewed_at = EXCLUDED.reviewed_at""",
            request.get("id"),
            request.get("employeeId"),
            request.get("requestType"),
            parse_date(request.get("startDate")),
            parse_date(request.get("endDate")),
            request.get("reason"),
            requested_changes_json,
            request.get("status", "pending"),
            parse_timestamp(request.get("requestedAt")),
            request.get("reviewedBy"),
            parse_timestamp(request.get("reviewedAt"))
        )
        
        await conn.close()
        logger.info(f"Successfully updated request {request_id}")
        return {"success": True, "id": request_id}
    except Exception as e:
        logger.error(f"Error updating request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/state")
async def save_state(state: dict):
    try:
        logger.info("Saving full state to database")
        logger.info(f"State keys: {state.keys()}")
        logger.info(f"Number of users to save: {len(state.get('users', []))}")
        
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Save users (upsert - don't delete existing)
        if "users" in state and state["users"]:
            logger.info(f"Saving {len(state['users'])} users...")
            for idx, user in enumerate(state["users"]):
                try:
                    logger.info(f"Saving user {idx + 1}: {user.get('email', 'NO_EMAIL')}")
                    await conn.execute(
                        """INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, require_password_reset, archived, archived_at, archived_by, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_TIMESTAMP))
                           ON CONFLICT (id) DO UPDATE SET
                           name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password,
                           phone = EXCLUDED.phone, role = EXCLUDED.role, permission = EXCLUDED.permission,
                           shift_start = EXCLUDED.shift_start, hire_date = EXCLUDED.hire_date, 
                           status = EXCLUDED.status, require_password_reset = EXCLUDED.require_password_reset,
                           archived = EXCLUDED.archived, archived_at = EXCLUDED.archived_at, archived_by = EXCLUDED.archived_by""",
                        user.get("id"), user.get("name"), user.get("email"), user.get("password"),
                        user.get("phone"), user.get("role"), user.get("permission", "staff"),
                        parse_time(user.get("shiftStart")), parse_date(user.get("hireDate")), 
                        user.get("status", "active"), user.get("requirePasswordReset", False),
                        user.get("archived", False), parse_timestamp(user.get("archivedAt")),
                        user.get("archivedBy"), parse_timestamp(user.get("createdAt")) if user.get("createdAt") else None
                    )
                    logger.info(f"Successfully saved user {idx + 1}")
                except Exception as user_error:
                    logger.error(f"Error saving user {idx + 1} ({user.get('email', 'NO_EMAIL')}): {user_error}")
                    logger.error(f"User data: {user}")
                    raise
        
        # Save attendance logs (upsert - don't delete existing)
        if "attendanceLogs" in state and state["attendanceLogs"]:
            for log in state["attendanceLogs"]:
                await conn.execute(
                    """INSERT INTO attendance_logs (id, employee_id, timestamp, action, note, shift, archived, archived_at, archived_by)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                       ON CONFLICT (id) DO UPDATE SET
                       employee_id = EXCLUDED.employee_id, 
                       timestamp = EXCLUDED.timestamp, 
                       action = EXCLUDED.action,
                       note = EXCLUDED.note,
                       shift = EXCLUDED.shift,
                       archived = EXCLUDED.archived,
                       archived_at = EXCLUDED.archived_at,
                       archived_by = EXCLUDED.archived_by""",
                    log.get("id"), log.get("employeeId"), 
                    parse_timestamp(log.get("timestamp")), log.get("action"),
                    log.get("note"), log.get("shift", None),  # Default to None if not provided
                    log.get("archived", False), parse_timestamp(log.get("archivedAt")),
                    log.get("archivedBy")
                )
        
        # Save inventory (upsert - don't delete existing)
        if "inventory" in state and state["inventory"]:
            for item in state["inventory"]:
                await conn.execute(
                    """INSERT INTO inventory (id, name, category, quantity, unit, cost, date_purchased, use_by_date, expiry_date, reorder_point, last_restocked, total_used, archived, archived_at, archived_by)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                       ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name, category = EXCLUDED.category,
                       quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, cost = EXCLUDED.cost,
                       date_purchased = EXCLUDED.date_purchased, use_by_date = EXCLUDED.use_by_date,
                       expiry_date = EXCLUDED.expiry_date, reorder_point = EXCLUDED.reorder_point, 
                       last_restocked = EXCLUDED.last_restocked, total_used = EXCLUDED.total_used,
                       archived = EXCLUDED.archived, archived_at = EXCLUDED.archived_at, archived_by = EXCLUDED.archived_by""",
                    item.get("id"), item.get("name"), item.get("category"),
                    item.get("quantity"), item.get("unit", "pieces"), item.get("cost"),
                    parse_date(item.get("datePurchased")), parse_date(item.get("useByDate")),
                    parse_date(item.get("expiryDate")), item.get("reorderPoint", 10), 
                    parse_date(item.get("lastRestocked")), item.get("totalUsed", 0),
                    item.get("archived", False), parse_timestamp(item.get("archivedAt")),
                    item.get("archivedBy")
                )
        
        # Save orders (upsert - don't delete existing)
        if "orders" in state and state["orders"]:
            for order in state["orders"]:
                # Handle itemsJson properly - avoid double JSON encoding
                items_json_value = order.get("itemsJson")
                items_json_str = None
                
                if items_json_value is not None:
                    # If it's already a dict/list, convert to JSON string
                    if isinstance(items_json_value, (dict, list)):
                        items_json_str = json.dumps(items_json_value)
                    # If it's a string, check if it's valid JSON
                    elif isinstance(items_json_value, str):
                        try:
                            # Try to parse it to validate it's proper JSON
                            parsed = json.loads(items_json_value)
                            # Re-serialize to ensure clean JSON without escaping issues
                            items_json_str = json.dumps(parsed)
                        except:
                            # If parsing fails, store as-is or set to None
                            items_json_str = None
                
                await conn.execute(
                    """INSERT INTO orders (id, customer, items_json, total, type, archived, archived_at, archived_by, timestamp)
                       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
                       ON CONFLICT (id) DO UPDATE SET
                       customer = EXCLUDED.customer,
                       items_json = EXCLUDED.items_json, total = EXCLUDED.total,
                       type = EXCLUDED.type,
                       archived = EXCLUDED.archived, archived_at = EXCLUDED.archived_at, archived_by = EXCLUDED.archived_by,
                       timestamp = EXCLUDED.timestamp""",
                    order.get("id"), order.get("customer"),
                    items_json_str, order.get("total"),
                    order.get("type"), order.get("archived", False), parse_timestamp(order.get("archivedAt")),
                    order.get("archivedBy"), parse_timestamp(order.get("timestamp"))
                )
        
        # Save sales history (upsert - don't delete existing)
        if "salesHistory" in state and state["salesHistory"]:
            for sale in state["salesHistory"]:
                await conn.execute(
                    """INSERT INTO sales_history (id, date, total, orders_count)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (id) DO UPDATE SET
                       date = EXCLUDED.date, total = EXCLUDED.total, orders_count = EXCLUDED.orders_count""",
                    sale.get("id"), parse_date(sale.get("date")), 
                    sale.get("total"), sale.get("ordersCount")
                )
        
        # Save inventory usage
        if "inventoryUsage" in state and state["inventoryUsage"]:
            for usage in state["inventoryUsage"]:
                await conn.execute(
                    """INSERT INTO inventory_trends (id, label, used)
                       VALUES ($1, $2, $3)
                       ON CONFLICT (id) DO UPDATE SET
                       label = EXCLUDED.label, used = EXCLUDED.used""",
                    usage.get("id"), usage.get("label"), usage.get("used")
                )
        
        # Save requests (leave and profile edit requests)
        if "requests" in state and state["requests"]:
            for request in state["requests"]:
                # Handle requestedChanges properly - don't double-encode
                requested_changes = request.get("requestedChanges")
                if requested_changes:
                    if isinstance(requested_changes, str):
                        # Already a JSON string, use as-is
                        requested_changes_json = requested_changes
                    else:
                        # It's a dict/object, serialize it
                        requested_changes_json = json.dumps(requested_changes)
                else:
                    requested_changes_json = None
                    
                await conn.execute(
                    """INSERT INTO requests (id, employee_id, request_type, start_date, end_date, reason, requested_changes, status, requested_at, reviewed_by, reviewed_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                       ON CONFLICT (id) DO UPDATE SET
                       employee_id = EXCLUDED.employee_id, request_type = EXCLUDED.request_type,
                       start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
                       reason = EXCLUDED.reason, requested_changes = EXCLUDED.requested_changes,
                       status = EXCLUDED.status, requested_at = EXCLUDED.requested_at,
                       reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at""",
                    request.get("id"), request.get("employeeId"),
                    request.get("requestType", "leave"),
                    parse_date(request.get("startDate")), parse_date(request.get("endDate")),
                    request.get("reason"), requested_changes_json,
                    request.get("status", "pending"),
                    parse_timestamp(request.get("requestedAt")),
                    request.get("reviewedBy"), parse_timestamp(request.get("reviewedAt"))
                )
        
        await conn.close()
        logger.info("State saved successfully")
        return {"success": True, "message": "State saved to database"}
    except Exception as e:
        logger.error(f"Error saving state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

