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

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "sweetbox")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:5500", "http://127.0.0.1:3000", "http://localhost:3000", "file://"],
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
    "performance_scores",
    "stock_trends",
    "users"
]

async def fetch_table(conn, table):
    try:
        rows = await conn.fetch(f'SELECT * FROM {table}')
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
            if table == "attendance_logs":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
            if table == "sales_history" and "orders_count" in item:
                item["ordersCount"] = item.pop("orders_count")
            if table == "performance_scores":
                if "employee_id" in item:
                    item["employeeId"] = item.pop("employee_id")
                if "completed_orders" in item:
                    item["completedOrders"] = item.pop("completed_orders")
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
            "performanceScores": data["performance_scores"],
            "stockTrends": data["stock_trends"],
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
        
        # Save employees
        if "employees" in state and state["employees"]:
            await conn.execute("DELETE FROM employees")
            for emp in state["employees"]:
                await conn.execute(
                    """INSERT INTO employees (id, name, role, contact, hire_date, status)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    emp.get("id"), emp.get("name"), emp.get("role"), 
                    emp.get("contact"), parse_date(emp.get("hireDate")), emp.get("status", "active")
                )
        
        # Save attendance logs
        if "attendanceLogs" in state and state["attendanceLogs"]:
            await conn.execute("DELETE FROM attendance_logs")
            for log in state["attendanceLogs"]:
                await conn.execute(
                    """INSERT INTO attendance_logs (id, employee_id, timestamp, action)
                       VALUES ($1, $2, $3, $4)""",
                    log.get("id"), log.get("employeeId"), 
                    parse_timestamp(log.get("timestamp")), log.get("action")
                )
        
        # Save inventory
        if "inventory" in state and state["inventory"]:
            await conn.execute("DELETE FROM inventory")
            for item in state["inventory"]:
                await conn.execute(
                    """INSERT INTO inventory (id, name, category, quantity, unit, reorder_point, cost)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    item.get("id"), item.get("name"), item.get("category"),
                    item.get("quantity"), item.get("unit"), 
                    item.get("reorderPoint"), item.get("cost")
                )
        
        # Save orders
        if "orders" in state and state["orders"]:
            await conn.execute("DELETE FROM orders")
            for order in state["orders"]:
                items_json_str = json.dumps(order.get("itemsJson")) if order.get("itemsJson") else None
                await conn.execute(
                    """INSERT INTO orders (id, customer, items, items_json, total, status, type, timestamp, served_at)
                       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)""",
                    order.get("id"), order.get("customer"), order.get("items"),
                    items_json_str, order.get("total"), order.get("status"),
                    order.get("type"), parse_timestamp(order.get("timestamp")), parse_timestamp(order.get("servedAt"))
                )
        
        # Save sales history
        if "salesHistory" in state and state["salesHistory"]:
            await conn.execute("DELETE FROM sales_history")
            for sale in state["salesHistory"]:
                await conn.execute(
                    """INSERT INTO sales_history (id, date, total, orders_count)
                       VALUES ($1, $2, $3, $4)""",
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
        
        # Save performance scores
        if "performanceScores" in state and state["performanceScores"]:
            await conn.execute("DELETE FROM performance_scores")
            for perf in state["performanceScores"]:
                await conn.execute(
                    """INSERT INTO performance_scores (id, employee_id, rating, completed_orders)
                       VALUES ($1, $2, $3, $4)""",
                    perf.get("id"), perf.get("employeeId"), 
                    perf.get("rating"), perf.get("completedOrders")
                )
        
        # Save stock trends
        if "stockTrends" in state and state["stockTrends"]:
            await conn.execute("DELETE FROM stock_trends")
            for trend in state["stockTrends"]:
                await conn.execute(
                    """INSERT INTO stock_trends (id, item, turnover)
                       VALUES ($1, $2, $3)""",
                    trend.get("id"), trend.get("item"), trend.get("turnover")
                )
        
        await conn.close()
        logger.info("State saved successfully")
        return {"success": True, "message": "State saved to database"}
    except Exception as e:
        logger.error(f"Error saving state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
