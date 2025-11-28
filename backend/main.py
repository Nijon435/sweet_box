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

# Database configuration - support both individual vars and DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    # Parse DATABASE_URL (postgresql://user:pass@host:port/dbname or postgres://...)
    import re
    match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)
    if match:
        DB_USER = match.group(1)
        DB_PASSWORD = match.group(2)
        DB_HOST = match.group(3)
        DB_PORT = int(match.group(4)) if match.group(4) else 5432
        DB_NAME = match.group(5)
    else:
        # Fallback to individual env vars
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = int(os.getenv("DB_PORT", 5432))
        DB_NAME = os.getenv("DB_NAME", "sweetbox")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "")
else:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", 5432))
    DB_NAME = os.getenv("DB_NAME", "sweetbox")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

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
    "employees",
    "attendance_logs",
    "inventory",
    "orders",
    "sales_history",
    "inventory_usage",
    "users"
]

async def fetch_table(conn, table):
    try:
        # Add limits to prevent overwhelming responses
        limit_map = {
            "attendance_logs": 1000,  # Last 1000 attendance records
            "sales_history": 500,     # Last 500 sales records
            "orders": 500,            # Last 500 orders
            "inventory_usage": 1000,  # Last 1000 usage records
            "stock_trends": 500,      # Last 500 trend records
        }
        
        # Different ordering columns for different tables
        order_by_map = {
            "sales_history": "date DESC",
            "orders": "timestamp DESC",
            "attendance_logs": "timestamp DESC",
            "inventory_usage": "id DESC",
            "employees": "created_at DESC",
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
            if table == "orders" and "items_json" in item:
                item["itemsJson"] = item.pop("items_json")
            if table == "orders" and "served_at" in item:
                item["servedAt"] = item.pop("served_at")
            if table == "employees" and "hire_date" in item:
                item["hireDate"] = item.pop("hire_date")
            if table == "employees" and "shift_start" in item:
                item["shiftStart"] = item.pop("shift_start")
            if table == "attendance_logs":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
            if table == "sales_history" and "orders_count" in item:
                item["ordersCount"] = item.pop("orders_count")
            if table == "inventory" and "reorder_point" in item:
                item["reorderPoint"] = item.pop("reorder_point")
            result.append(item)
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
            "employees": data["employees"],
            "attendanceLogs": data["attendance_logs"],
            "inventory": data["inventory"],
            "orders": data["orders"],
            "salesHistory": data["sales_history"],
            "inventoryUsage": data["inventory_usage"],
            "attendanceTrend": [],
            "users": data["users"]
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

@app.post("/api/state")
async def save_state(state: dict):
    try:
        logger.info("Saving full state to database")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        
        # Save employees (upsert - don't delete existing)
        if "employees" in state and state["employees"]:
            for emp in state["employees"]:
                await conn.execute(
                    """INSERT INTO employees (id, name, role, contact, hire_date, status)
                       VALUES ($1, $2, $3, $4, $5, $6)
                       ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name, role = EXCLUDED.role, 
                       contact = EXCLUDED.contact, hire_date = EXCLUDED.hire_date, 
                       status = EXCLUDED.status""",
                    emp.get("id"), emp.get("name"), emp.get("role"), 
                    emp.get("contact"), parse_date(emp.get("hireDate")), emp.get("status", "active")
                )
        
        # Save attendance logs (upsert - don't delete existing)
        if "attendanceLogs" in state and state["attendanceLogs"]:
            for log in state["attendanceLogs"]:
                await conn.execute(
                    """INSERT INTO attendance_logs (id, employee_id, timestamp, action)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (id) DO UPDATE SET
                       employee_id = EXCLUDED.employee_id, 
                       timestamp = EXCLUDED.timestamp, 
                       action = EXCLUDED.action""",
                    log.get("id"), log.get("employeeId"), 
                    parse_timestamp(log.get("timestamp")), log.get("action")
                )
        
        # Save inventory (upsert - don't delete existing)
        if "inventory" in state and state["inventory"]:
            for item in state["inventory"]:
                await conn.execute(
                    """INSERT INTO inventory (id, name, category, quantity, unit, reorder_point, cost)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)
                       ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name, category = EXCLUDED.category,
                       quantity = EXCLUDED.quantity, unit = EXCLUDED.unit,
                       reorder_point = EXCLUDED.reorder_point, cost = EXCLUDED.cost""",
                    item.get("id"), item.get("name"), item.get("category"),
                    item.get("quantity"), item.get("unit"), 
                    item.get("reorderPoint"), item.get("cost")
                )
        
        # Save orders (upsert - don't delete existing)
        if "orders" in state and state["orders"]:
            for order in state["orders"]:
                items_json_str = json.dumps(order.get("itemsJson")) if order.get("itemsJson") else None
                await conn.execute(
                    """INSERT INTO orders (id, customer, items, items_json, total, status, type, timestamp, served_at)
                       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
                       ON CONFLICT (id) DO UPDATE SET
                       customer = EXCLUDED.customer, items = EXCLUDED.items,
                       items_json = EXCLUDED.items_json, total = EXCLUDED.total,
                       status = EXCLUDED.status, type = EXCLUDED.type,
                       timestamp = EXCLUDED.timestamp, served_at = EXCLUDED.served_at""",
                    order.get("id"), order.get("customer"), order.get("items"),
                    items_json_str, order.get("total"), order.get("status"),
                    order.get("type"), parse_timestamp(order.get("timestamp")), parse_timestamp(order.get("servedAt"))
                )
        
        # Save sales history (upsert - don't delete existing)
        if "salesHistory" in state and state["salesHistory"]:
            for sale in state["salesHistory"]:
                await conn.execute(
                    """INSERT INTO sales_history (id, date, total, orders_count)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (date) DO UPDATE SET
                       total = EXCLUDED.total, orders_count = EXCLUDED.orders_count""",
                    sale.get("id"), parse_date(sale.get("date")), 
                    sale.get("total"), sale.get("ordersCount")
                )
        
        # Save inventory usage
        if "inventoryUsage" in state and state["inventoryUsage"]:
            await conn.execute("DELETE FROM inventory_usage")
            for usage in state["inventoryUsage"]:
                await conn.execute(
                    """INSERT INTO inventory_usage (id, label, used)
                       VALUES ($1, $2, $3)""",
                    usage.get("id"), usage.get("label"), usage.get("used")
                )
        
        await conn.close()
        logger.info("State saved successfully")
        return {"success": True, "message": "State saved to database"}
    except Exception as e:
        logger.error(f"Error saving state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
