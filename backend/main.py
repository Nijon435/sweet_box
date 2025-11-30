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
    "inventory_usage",
    "ingredient_usage_logs",
    "requests"  # Renamed from leave_requests
]

async def fetch_table(conn, table):
    try:
        # Add limits to prevent overwhelming responses and localStorage quota issues
        limit_map = {
            "attendance_logs": 100,  # Last 100 attendance records (reduced from 1000)
            "sales_history": 90,     # Last 90 days sales (reduced from 500)
            "orders": 200,           # Last 200 orders (reduced from 500)
            "inventory_usage": 50,   # Last 50 usage records (reduced from 1000)
            "stock_trends": 50,      # Last 50 trend records (reduced from 500)
        }
        
        # Different ordering columns for different tables
        order_by_map = {
            "sales_history": "date DESC",
            "orders": "timestamp DESC",
            "attendance_logs": "timestamp DESC",
            "inventory_usage": "id DESC",
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
            if table == "ingredient_usage_logs":
                if "inventory_item_id" in item:
                    item["inventoryItemId"] = item.pop("inventory_item_id")
                if "order_id" in item:
                    item["orderId"] = item.pop("order_id")
                if "created_at" in item:
                    item["createdAt"] = item.pop("created_at")
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

@app.get("/health")
async def health_check():
    """Detailed health check with database status"""
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
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
            database=DB_NAME
        )
        logger.info("DB connection successful")
        data = {}
        for table in TABLES:
            logger.info(f"Fetching table: {table}")
            data[table] = await fetch_table(conn, table)
        await conn.close()
        logger.info("Returning data successfully")
        # Rename keys to match frontend expectations
        return {
            "users": data["users"],
            "attendanceLogs": data["attendance_logs"],
            "inventory": data["inventory"],
            "orders": data["orders"],
            "salesHistory": data["sales_history"],
            "inventoryUsage": data["inventory_usage"],
            "requests": data["requests"],
            "attendanceTrend": []
        }
    except Exception as e:
        logger.error(f"Error in /api/state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/inventory/{item_id}")
async def update_inventory(item_id: str, update: InventoryUpdate):
    try:
        logger.info(f"Updating inventory item {item_id}: {update}")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
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
            database=DB_NAME
        )
        
        # Save users (upsert - don't delete existing)
        if "users" in state and state["users"]:
            logger.info(f"Saving {len(state['users'])} users...")
            for idx, user in enumerate(state["users"]):
                try:
                    logger.info(f"Saving user {idx + 1}: {user.get('email', 'NO_EMAIL')}")
                    await conn.execute(
                        """INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, require_password_reset, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                           ON CONFLICT (id) DO UPDATE SET
                           name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password,
                           phone = EXCLUDED.phone, role = EXCLUDED.role, permission = EXCLUDED.permission,
                           shift_start = EXCLUDED.shift_start, hire_date = EXCLUDED.hire_date, 
                           status = EXCLUDED.status, require_password_reset = EXCLUDED.require_password_reset""",
                        user.get("id"), user.get("name"), user.get("email"), user.get("password"),
                        user.get("phone"), user.get("role"), user.get("permission", "front_staff"),
                        parse_time(user.get("shiftStart")), parse_date(user.get("hireDate")), 
                        user.get("status", "active"), user.get("requirePasswordReset", False),
                        parse_timestamp(user.get("createdAt"))
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
                    """INSERT INTO attendance_logs (id, employee_id, timestamp, action, note)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (id) DO UPDATE SET
                       employee_id = EXCLUDED.employee_id, 
                       timestamp = EXCLUDED.timestamp, 
                       action = EXCLUDED.action,
                       note = EXCLUDED.note""",
                    log.get("id"), log.get("employeeId"), 
                    parse_timestamp(log.get("timestamp")), log.get("action"),
                    log.get("note")
                )
        
        # Save inventory (upsert - don't delete existing)
        if "inventory" in state and state["inventory"]:
            for item in state["inventory"]:
                await conn.execute(
                    """INSERT INTO inventory (id, name, category, quantity, unit, cost, date_purchased, use_by_date, expiry_date, reorder_point, last_restocked, total_used)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                       ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name, category = EXCLUDED.category,
                       quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, cost = EXCLUDED.cost,
                       date_purchased = EXCLUDED.date_purchased, use_by_date = EXCLUDED.use_by_date,
                       expiry_date = EXCLUDED.expiry_date, reorder_point = EXCLUDED.reorder_point, 
                       last_restocked = EXCLUDED.last_restocked, total_used = EXCLUDED.total_used""",
                    item.get("id"), item.get("name"), item.get("category"),
                    item.get("quantity"), item.get("unit", "pieces"), item.get("cost"),
                    parse_date(item.get("datePurchased")), parse_date(item.get("useByDate")),
                    parse_date(item.get("expiryDate")), item.get("reorderPoint", 10), 
                    parse_date(item.get("lastRestocked")), item.get("totalUsed", 0)
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
                    """INSERT INTO orders (id, customer, items_json, total, status, type, timestamp, served_at)
                       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
                       ON CONFLICT (id) DO UPDATE SET
                       customer = EXCLUDED.customer,
                       items_json = EXCLUDED.items_json, total = EXCLUDED.total,
                       status = EXCLUDED.status, type = EXCLUDED.type,
                       timestamp = EXCLUDED.timestamp, served_at = EXCLUDED.served_at""",
                    order.get("id"), order.get("customer"),
                    items_json_str, order.get("total"), order.get("status"),
                    order.get("type"), parse_timestamp(order.get("timestamp")), parse_timestamp(order.get("servedAt"))
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
                    """INSERT INTO inventory_usage (id, label, used)
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

