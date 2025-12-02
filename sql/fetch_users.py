"""
Fetch all users from the database to verify actual data
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import re

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment")
    exit(1)

# Parse DATABASE_URL
match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)
if match:
    DB_USER = match.group(1)
    DB_PASSWORD = match.group(2)
    DB_HOST = match.group(3)
    DB_PORT = int(match.group(4)) if match.group(4) else 5432
    DB_NAME = match.group(5)
else:
    print("ERROR: Invalid DATABASE_URL format")
    exit(1)

async def fetch_users():
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        
        rows = await conn.fetch("SELECT id, name, role, permission, shift_start FROM users ORDER BY id")
        
        print("\n=== ALL USERS IN DATABASE ===\n")
        print(f"{'ID':<25} {'Name':<30} {'Role':<20} {'Permission':<20} {'Shift Start':<15}")
        print("-" * 110)
        
        for row in rows:
            print(f"{row['id']:<25} {row['name']:<30} {row['role']:<20} {row['permission']:<20} {str(row['shift_start']) if row['shift_start'] else 'None':<15}")
        
        print(f"\nTotal users: {len(rows)}")
        
        # Show non-admin users for attendance tracking
        non_admin = [r for r in rows if r['permission'] != 'admin']
        print(f"\n=== NON-ADMIN USERS (for attendance) ===")
        print(f"Total: {len(non_admin)}\n")
        
        print("Python list for generate_attendance_seeds.py:")
        print("employees = [")
        for row in non_admin:
            shift = str(row['shift_start']) if row['shift_start'] else '08:00:00'
            print(f"    ('{row['id']}', '{row['name']}', '{shift}'),")
        print("]")
        
        await conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(fetch_users())
