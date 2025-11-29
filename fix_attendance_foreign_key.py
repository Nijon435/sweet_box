"""
Fix foreign key constraint in attendance_logs table
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

async def fix_foreign_key(db_name, db_url=None, is_local=False):
    print(f"\n{'='*50}")
    print(f"Fixing foreign key constraint in {db_name}")
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
        # Check current constraints
        constraints = await conn.fetch("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'attendance_logs'
            AND constraint_type = 'FOREIGN KEY'
        """)
        
        print("\nCurrent foreign key constraints:")
        for c in constraints:
            print(f"  - {c['constraint_name']}")
        
        # Drop old constraint if it exists
        print("\nDropping old foreign key constraint...")
        try:
            await conn.execute("""
                ALTER TABLE attendance_logs
                DROP CONSTRAINT IF EXISTS attendance_logs_employee_id_fkey
            """)
            print("✓ Old constraint dropped")
        except Exception as e:
            print(f"⚠️  Warning: {e}")
        
        # Add new constraint pointing to users table
        print("\nAdding new foreign key constraint to users table...")
        await conn.execute("""
            ALTER TABLE attendance_logs
            ADD CONSTRAINT attendance_logs_employee_id_fkey
            FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
        """)
        print("✓ New constraint added")
        
        # Verify
        new_constraints = await conn.fetch("""
            SELECT tc.constraint_name, ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'attendance_logs'
            AND tc.constraint_type = 'FOREIGN KEY'
        """)
        
        print("\nVerified foreign key constraints:")
        for c in new_constraints:
            print(f"  ✓ {c['constraint_name']} → {c['foreign_table_name']}")
        
    finally:
        await conn.close()

async def main():
    print("Fixing attendance_logs foreign key constraint...\n")
    
    # Fix Render (production)
    await fix_foreign_key("Render (Production)", RENDER_DB_URL, is_local=False)
    
    # Fix local
    await fix_foreign_key("Local (pgAdmin)", is_local=True)
    
    print("\n✅ All done!")

if __name__ == "__main__":
    asyncio.run(main())
