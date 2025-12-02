"""
Generate SQL seed data for attendance logs (past 30 days)
Excludes admin and manager roles
"""
from datetime import datetime, timedelta
import random

# Employee data from database (excluding admins and managers)
employees = [
    ('staff-2', 'Mike Ehrmantraut', '06:00:00'),
    ('user-1764613939749', 'Jimmy McGill', '08:00:00'),
    ('staff-1', 'Ernesto Wells', '08:00:00'),
    ('user-1764571497896', 'Jake Hamlin', '07:00:00'),
    ('user-1764436870863', 'Sofia Morales', '07:00:00'),
    ('user-1764423066560', 'Jefferson Arvesu', '07:00:00'),
    ('user-manager-1', 'Jessica Martinez', '08:00:00'),
]

today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

sql_statements = []
sql_statements.append("-- Simulated Attendance Logs for Past 30 Days")
sql_statements.append("-- Generated for non-admin/non-manager employees\n")
sql_statements.append("DELETE FROM attendance_logs;\n")

for day_offset in range(30):
    current_day = today - timedelta(days=day_offset)
    
    for emp_id, emp_name, shift_start in employees:
        # 85% chance employee comes to work
        if random.random() > 0.85:
            continue
        
        # Parse shift time
        shift_hour, shift_minute = map(int, shift_start.split(':')[:2])
        
        # Determine if late (30% chance)
        if random.random() < 0.7:
            # On time: -10 to +5 minutes
            clock_in_offset = random.randint(-10, 5)
            status = "present"
        else:
            # Late: 5 to 30 minutes
            clock_in_offset = random.randint(5, 30)
            status = "late"
        
        clock_in_time = current_day.replace(hour=shift_hour, minute=shift_minute) + timedelta(minutes=clock_in_offset)
        
        # Clock out: 8-9 hours later
        work_duration = random.randint(480, 540)
        clock_out_time = clock_in_time + timedelta(minutes=work_duration)
        
        # Generate IDs
        clock_in_id = f"{emp_id}-{current_day.strftime('%Y%m%d')}-in"
        clock_out_id = f"{emp_id}-{current_day.strftime('%Y%m%d')}-out"
        
        # Clock-in record
        sql_statements.append(
            f"INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note, archived, archived_at, archived_by) "
            f"VALUES ('{clock_in_id}', '{emp_id}', 'in', '{clock_in_time.strftime('%Y-%m-%d %H:%M:%S')}', '{shift_start}', '{status}', false, NULL, NULL);"
        )
        
        # Clock-out record
        sql_statements.append(
            f"INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note, archived, archived_at, archived_by) "
            f"VALUES ('{clock_out_id}', '{emp_id}', 'out', '{clock_out_time.strftime('%Y-%m-%d %H:%M:%S')}', '{shift_start}', '{status}', false, NULL, NULL);"
        )

# Write to file
with open('seed_attendance_logs.sql', 'w') as f:
    f.write('\n'.join(sql_statements))

print(f"✅ Generated {len(sql_statements) - 3} SQL statements")
print(f"   Saved to: seed_attendance_logs.sql")
print(f"\n   To apply: Run the SQL file against your database")
