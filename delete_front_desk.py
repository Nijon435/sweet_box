"""
Delete Front Desk user from database
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def delete_front_desk():
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Delete Front Desk user
        result = await conn.execute("""
            DELETE FROM users
            WHERE id = 'staff-1' AND email = 'frontdesk@sweetbox.com'
        """)
        
        print(f"Deleted Front Desk user: {result}")
        
        # Show remaining users
        users = await conn.fetch("""
            SELECT id, name, email
            FROM users
            ORDER BY created_at DESC
        """)
        
        print(f"\nRemaining users ({len(users)}):")
        for user in users:
            print(f"  - {user['name']} ({user['email']})")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(delete_front_desk())
