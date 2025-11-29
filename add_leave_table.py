"""
Add leave_requests table to both databases
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")
LOCAL_DB_HOST = os.getenv("LOCAL_DB_HOST")
LOCAL_DB_PORT = int(os.getenv("LOCAL_DB_PORT", 5432))
LOCAL_DB_NAME = os.getenv("LOCAL_DB_NAME")
LOCAL_DB_USER = os.getenv("LOCAL_DB_USER")
LOCAL_DB_PASSWORD = os.getenv("LOCAL_DB_PASSWORD")

async def add_leave_table(db_name, db_url=None, is_local=False):
    print(f"\n{'='*50}")
    print(f"Adding leave_requests table to {db_name}")
    print('='*50)
    
    if is_local:
        conn = await asyncpg.connect(
            host=LOCAL_DB_HOST,
            port=LOCAL_DB_PORT,
            user=LOCAL_DB_USER,
            password=LOCAL_DB_PASSWORD,
            database=LOCAL_DB_NAME
        )
    else:
        conn = await asyncpg.connect(db_url)
    
    try:
        # Check if table exists
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'leave_requests'
            )
        """)
        
        if exists:
            print("✓ leave_requests table already exists")
        else:
            print("Creating leave_requests table...")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS leave_requests (
                  id VARCHAR(64) NOT NULL PRIMARY KEY,
                  employee_id VARCHAR(64) NOT NULL,
                  start_date DATE NOT NULL,
                  end_date DATE NOT NULL,
                  reason TEXT,
                  status VARCHAR(32) DEFAULT 'pending',
                  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  approved_by VARCHAR(64),
                  approved_at TIMESTAMP,
                  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
                  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
                )
            """)
            print("✓ leave_requests table created successfully")
        
        # Show table structure
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'leave_requests'
            ORDER BY ordinal_position
        """)
        
        print("\nTable structure:")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f", DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  {col['column_name']}: {col['data_type']} {nullable}{default}")
        
    finally:
        await conn.close()

async def main():
    print("Adding leave_requests table to both databases...\n")
    
    # Add to Render (production)
    await add_leave_table("Render (Production)", RENDER_DB_URL, is_local=False)
    
    # Add to local
    await add_leave_table("Local (pgAdmin)", is_local=True)
    
    print("\n✅ All done!")

if __name__ == "__main__":
    asyncio.run(main())
