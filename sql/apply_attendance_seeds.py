import asyncpg
import asyncio
import os
from dotenv import load_dotenv
import re

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)

async def apply_seeds():
    conn = await asyncpg.connect(
        host=match.group(3), 
        port=int(match.group(4)) if match.group(4) else 5432, 
        user=match.group(1), 
        password=match.group(2), 
        database=match.group(5), 
        ssl='require'
    )
    
    # Read the SQL file
    with open('seed_attendance_logs.sql', 'r') as f:
        sql_content = f.read()
    
    # Clear existing data first
    print("Clearing existing attendance logs...")
    await conn.execute("DELETE FROM attendance_logs")
    print("  Cleared!")
    
    # Execute SQL statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"Executing {len(statements)} SQL statements...")
    
    for i, stmt in enumerate(statements, 1):
        try:
            await conn.execute(stmt)
            if i % 50 == 0:
                print(f"  Processed {i}/{len(statements)} statements...")
        except Exception as e:
            print(f"  Error on statement {i}: {e}")
            print(f"  Statement: {stmt[:100]}...")
            break
    
    # Verify results
    count = await conn.fetchval("SELECT COUNT(*) FROM attendance_logs WHERE archived = false")
    print(f"\n✅ Done! {count} attendance logs now in database")
    
    # Show sample
    sample = await conn.fetch("""
        SELECT u.name, a.action, a.timestamp, a.note
        FROM attendance_logs a
        JOIN users u ON a.employee_id = u.id
        WHERE a.archived = false
        ORDER BY a.timestamp DESC
        LIMIT 5
    """)
    
    print("\nRecent logs:")
    for log in sample:
        print(f"  {log['name']:25} - {log['action']:3} at {log['timestamp']} ({log['note']})")
    
    await conn.close()

asyncio.run(apply_seeds())
