"""
Compare what's in the database vs what might be cached
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def check_users():
    print("Connecting to Render database...")
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Get all users from database
        users = await conn.fetch("""
            SELECT id, name, email, permission, status
            FROM users
            ORDER BY created_at DESC
        """)
        
        print(f"\n=== Users in Database ({len(users)} total) ===")
        for user in users:
            status_marker = "✓" if user['status'] == 'active' else "✗"
            print(f"{status_marker} {user['name']} ({user['email']})")
            print(f"   ID: {user['id']}, Permission: {user['permission']}, Status: {user['status']}")
        
        # Check for any deleted/inactive users
        inactive = await conn.fetch("""
            SELECT id, name, email, status
            FROM users
            WHERE status != 'active'
        """)
        
        if inactive:
            print(f"\n=== Inactive Users ({len(inactive)}) ===")
            for user in inactive:
                print(f"  {user['name']} ({user['email']}) - Status: {user['status']}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_users())
