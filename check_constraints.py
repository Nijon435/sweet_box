"""
Check constraints on all tables
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def check_constraints():
    print("Connecting to Render database...")
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Check constraints for all tables
        tables = ['users', 'attendance_logs', 'inventory', 'orders', 'sales_history', 'inventory_usage']
        
        for table in tables:
            print(f"\n=== {table} ===")
            
            # Get constraints
            constraints = await conn.fetch("""
                SELECT 
                    tc.constraint_name, 
                    tc.constraint_type,
                    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
                FROM information_schema.table_constraints tc
                LEFT JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                AND tc.table_name = $1
                GROUP BY tc.constraint_name, tc.constraint_type
                ORDER BY tc.constraint_type, tc.constraint_name
            """, table)
            
            if constraints:
                for c in constraints:
                    print(f"  {c['constraint_type']}: {c['constraint_name']} on ({c['columns']})")
            else:
                print(f"  ❌ No constraints found!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_constraints())
