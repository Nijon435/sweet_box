import asyncpg
import asyncio
import os
from dotenv import load_dotenv
import re

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)

async def get_non_admin():
    conn = await asyncpg.connect(
        host=match.group(3), 
        port=int(match.group(4)) if match.group(4) else 5432, 
        user=match.group(1), 
        password=match.group(2), 
        database=match.group(5), 
        ssl='require'
    )
    employees = await conn.fetch("""
        SELECT id, name, shift_start, permission 
        FROM users 
        WHERE archived = false 
        AND status = 'active' 
        AND permission != 'admin'
    """)
    await conn.close()
    return employees

employees = asyncio.run(get_non_admin())
print('Non-admin employees:')
for e in employees:
    print(f"{e['id']},{e['name']},{e['shift_start']},{e['permission']}")
print(f'\nTotal: {len(employees)}')
