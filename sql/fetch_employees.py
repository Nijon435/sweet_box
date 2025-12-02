import asyncpg
import asyncio
import os
from dotenv import load_dotenv
import re

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)

async def get_employees():
    conn = await asyncpg.connect(
        host=match.group(3), 
        port=int(match.group(4)) if match.group(4) else 5432, 
        user=match.group(1), 
        password=match.group(2), 
        database=match.group(5), 
        ssl='require'
    )
    employees = await conn.fetch("SELECT id, name, shift_start FROM users WHERE archived = false AND status = 'active'")
    await conn.close()
    return employees

employees = asyncio.run(get_employees())
print('Current Employees:')
for e in employees:
    print(f"{e['id']},{e['name']},{e['shift_start']}")
