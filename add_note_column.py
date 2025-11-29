"""
Add missing note column to attendance_logs table
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def add_note_column():
    print("Connecting to Render database...")
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Check if note column exists
        has_note = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'attendance_logs'
                AND column_name = 'note'
            )
        """)
        
        if has_note:
            print("✓ Column 'note' already exists in attendance_logs")
        else:
            print("Adding 'note' column to attendance_logs...")
            await conn.execute("""
                ALTER TABLE attendance_logs
                ADD COLUMN note TEXT
            """)
            print("✓ Successfully added 'note' column")
        
        # Show table structure
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'attendance_logs'
            ORDER BY ordinal_position
        """)
        
        print("\nattendance_logs table structure:")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            print(f"  {col['column_name']}: {col['data_type']} {nullable}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_note_column())
