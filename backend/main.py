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

@app.on_event("startup")
async def startup_migrations():
    """Run database migrations on startup"""
    try:
        logger.info("Running startup migrations...")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        
        # Add archive columns to orders table if they don't exist
        try:
            await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE")
            await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP")
            await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64)")
            logger.info("Added archive columns to orders table")
        except Exception as e:
            logger.warning(f"Could not add archive columns to orders: {e}")
        
        # Add archive columns to inventory table if they don't exist
        try:
            await conn.execute("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE")
            await conn.execute("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP")
            await conn.execute("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64)")
            logger.info("Added archive columns to inventory table")
        except Exception as e:
            logger.warning(f"Could not add archive columns to inventory: {e}")
        
        # Remove status and served_at columns from orders table if they exist
        try:
            await conn.execute("ALTER TABLE orders DROP COLUMN IF EXISTS status")
            logger.info("Dropped status column from orders table")
        except Exception as e:
            logger.warning(f"Could not drop status column: {e}")
        
        try:
            await conn.execute("ALTER TABLE orders DROP COLUMN IF EXISTS served_at")
            logger.info("Dropped served_at column from orders table")
        except Exception as e:
            logger.warning(f"Could not drop served_at column: {e}")
        
        # Remove archived_by from users table (users don't track who archived them)
        try:
            await conn.execute("ALTER TABLE users DROP COLUMN IF EXISTS archived_by")
            logger.info("Dropped archived_by column from users table")
        except Exception as e:
            logger.warning(f"Could not drop archived_by column from users: {e}")
        
        # Add archive columns to attendance_logs table
        try:
            await conn.execute("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE")
            await conn.execute("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP")
            await conn.execute("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64)")
            logger.info("Added archive columns to attendance_logs table")
        except Exception as e:
            logger.warning(f"Could not add archive columns to attendance_logs: {e}")
        
        await conn.close()
        logger.info("Startup migrations completed successfully")
    except Exception as e:
        logger.error(f"Error running startup migrations: {e}")
        # Don't fail startup if migrations fail
        pass

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
            if table == "users":
                if "hire_date" in item:
                    item["hireDate"] = item.pop("hire_date")
                if "shift_start" in item:
                    item["shiftStart"] = item.pop("shift_start")
                if "created_at" in item:
                    item["createdAt"] = item.pop("created_at")
                if "require_password_reset" in item:
                    item["requirePasswordReset"] = item.pop("require_password_reset")
            if table == "attendance_logs":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
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
            if table == "inventory_usage_logs":
                if "inventory_item_id" in item:
                    item["inventoryItemId"] = item.pop("inventory_item_id")
                if "order_id" in item:
                    item["orderId"] = item.pop("order_id")
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
                        if log.get("status") == "late":
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
            log.get("shift"),
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

@app.put("/api/inventory-usage-logs/{log_id}")
async def update_usage_log(log_id: str, log: dict):
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
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
            parse_timestamp(user.get("createdAt"))
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
            json.dumps(request.get("requestedChanges")) if request.get("requestedChanges") else None,
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
            json.dumps(request.get("requestedChanges")) if request.get("requestedChanges") else None,
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
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
                        user.get("archivedBy"), parse_timestamp(user.get("createdAt"))
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
                    log.get("note"), log.get("shift"),
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
                    request.get("reason"), json.dumps(request.get("requestedChanges")) if request.get("requestedChanges") else None,
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

