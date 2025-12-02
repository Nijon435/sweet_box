"""
Generate simulated attendance logs for the past 30 days
This script creates realistic clock-in/clock-out records for existing employees
"""
import asyncpg
import asyncio
from datetime import datetime, timedelta
import random
import os
from dotenv import load_dotenv
import re

load_dotenv()

# Parse DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)
if match:
    DB_USER = match.group(1)
    DB_PASSWORD = match.group(2)
    DB_HOST = match.group(3)
    DB_PORT = int(match.group(4)) if match.group(4) else 5432
    DB_NAME = match.group(5)
else:
    raise ValueError("Invalid DATABASE_URL format")

async def generate_attendance_logs():
    """Generate attendance logs for the past 30 days"""
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        ssl='require'
    )
    
    try:
        # Get all active employees
        employees = await conn.fetch("""
            SELECT id, name, shift_start 
            FROM users 
            WHERE archived = false AND status = 'active'
            ORDER BY name
        """)
        
        print(f"\nFound {len(employees)} active employees")
        
        if len(employees) == 0:
            print("No active employees found. Please add employees first.")
            return
        
        # Clear existing attendance logs
        deleted = await conn.execute("DELETE FROM attendance_logs")
        print(f"Cleared existing attendance logs: {deleted}")
        
        # Generate logs for past 30 days
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        logs_created = 0
        
        for day_offset in range(30):
            current_day = today - timedelta(days=day_offset)
            
            # Skip if it's a future date
            if current_day > today:
                continue
            
            for employee in employees:
                # 85% chance employee comes to work on any given day
                if random.random() > 0.85:
                    continue
                
                # Parse shift start time
                if isinstance(employee['shift_start'], str):
                    shift_hour, shift_minute = map(int, employee['shift_start'].split(':'))
                    shift_start_str = employee['shift_start']
                else:
                    # shift_start is already a time object
                    shift_hour = employee['shift_start'].hour
                    shift_minute = employee['shift_start'].minute
                    shift_start_str = f"{shift_hour:02d}:{shift_minute:02d}"
                
                # Clock-in time: within 30 minutes of shift start
                # 70% on time, 30% late (5-30 minutes)
                if random.random() < 0.7:
                    # On time: -10 to +5 minutes from shift start
                    clock_in_offset = random.randint(-10, 5)
                    status = "present"
                else:
                    # Late: 5 to 30 minutes after shift start
                    clock_in_offset = random.randint(5, 30)
                    status = "late"
                
                clock_in_time = current_day.replace(
                    hour=shift_hour, 
                    minute=shift_minute
                ) + timedelta(minutes=clock_in_offset)
                
                # Clock-out time: 8-9 hours after clock-in
                work_duration = random.randint(480, 540)  # 8-9 hours in minutes
                clock_out_time = clock_in_time + timedelta(minutes=work_duration)
                
                # Insert clock-in record
                await conn.execute("""
                    INSERT INTO attendance_logs 
                    (id, employee_id, action, timestamp, shift, note, archived, archived_at, archived_by)
                    VALUES ($1, $2, $3, $4, $5, $6, false, NULL, NULL)
                """, f"{employee['id']}-{current_day.strftime('%Y%m%d')}-in", 
                    employee['id'], 'in', clock_in_time, 
                    shift_start_str, status)
                
                # Insert clock-out record
                await conn.execute("""
                    INSERT INTO attendance_logs 
                    (id, employee_id, action, timestamp, shift, note, archived, archived_at, archived_by)
                    VALUES ($1, $2, $3, $4, $5, $6, false, NULL, NULL)
                """, f"{employee['id']}-{current_day.strftime('%Y%m%d')}-out", 
                    employee['id'], 'out', clock_out_time, 
                    shift_start_str, status)
                
                logs_created += 2
        
        print(f"\n✅ Successfully created {logs_created} attendance log entries")
        print(f"   ({logs_created // 2} clock-in/out pairs)")
        print(f"   Covering {30} days for {len(employees)} employees")
        
        # Show sample of created logs
        sample = await conn.fetch("""
            SELECT u.name, a.action, a.timestamp, a.note
            FROM attendance_logs a
            JOIN users u ON a.employee_id = u.id
            ORDER BY a.timestamp DESC
            LIMIT 10
        """)
        
        print("\nSample of recent logs:")
        for log in sample:
            print(f"  {log['name']:20} - {log['action']:3} at {log['timestamp']} ({log['note']})")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("ATTENDANCE LOG GENERATOR")
    print("=" * 60)
    asyncio.run(generate_attendance_logs())
    print("\n✨ Done! Reload your analytics page to see the attendance trend.")
