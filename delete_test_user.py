"""
Delete test user from database
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def delete_test_user():
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Delete test user
        result = await conn.execute("""
            DELETE FROM users
            WHERE email = 'test@gmail.com'
        """)
        
        print(f"Deleted test user: {result}")
        
        # Show remaining users
        users = await conn.fetch("""
            SELECT id, name, email, permission
            FROM users
            ORDER BY created_at DESC
        """)
        
        print(f"\nRemaining users ({len(users)}):")
        for user in users:
            print(f"  - {user['name']} ({user['email']}) - {user['permission']}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(delete_test_user())
