"""
Delete users from LOCAL database (pgAdmin)
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

# Local database credentials
LOCAL_HOST = os.getenv("LOCAL_DB_HOST", "localhost")
LOCAL_PORT = os.getenv("LOCAL_DB_PORT", "5432")
LOCAL_USER = os.getenv("LOCAL_DB_USER", "postgres")
LOCAL_PASSWORD = os.getenv("LOCAL_DB_PASSWORD")
LOCAL_DB = os.getenv("LOCAL_DB_NAME", "sweetbox")

async def delete_users_local():
    print(f"Connecting to LOCAL database: {LOCAL_HOST}:{LOCAL_PORT}/{LOCAL_DB}")
    conn = await asyncpg.connect(
        host=LOCAL_HOST,
        port=LOCAL_PORT,
        user=LOCAL_USER,
        password=LOCAL_PASSWORD,
        database=LOCAL_DB
    )
    
    try:
        # Show current users
        users_before = await conn.fetch("""
            SELECT id, name, email
            FROM users
            ORDER BY created_at DESC
        """)
        
        print(f"\nUsers BEFORE deletion ({len(users_before)}):")
        for user in users_before:
            print(f"  - {user['name']} ({user['email']})")
        
        # Delete test user
        result1 = await conn.execute("""
            DELETE FROM users
            WHERE email = 'test@gmail.com'
        """)
        print(f"\n✓ Deleted test user: {result1}")
        
        # Delete Front Desk user
        result2 = await conn.execute("""
            DELETE FROM users
            WHERE email = 'frontdesk@sweetbox.com'
        """)
        print(f"✓ Deleted Front Desk user: {result2}")
        
        # Show remaining users
        users_after = await conn.fetch("""
            SELECT id, name, email, permission
            FROM users
            ORDER BY created_at DESC
        """)
        
        print(f"\nRemaining users AFTER deletion ({len(users_after)}):")
        for user in users_after:
            print(f"  - {user['name']} ({user['email']}) - {user['permission']}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(delete_users_local())
