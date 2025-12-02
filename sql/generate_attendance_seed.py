"""
Generate complete SQL seed data for attendance logs
Based on actual employee data from database
"""
from datetime import datetime, timedelta
import random

# Actual employees from database
employees = [
    ('staff-2', 'Mike Ehrmantraut', '06:00:00'),
    ('user-1764613939749', 'Jimmy McGill', '08:00:00'),
    ('staff-1', 'Ernesto Wells', '08:00:00'),
    ('user-1764571497896', 'Jake Hamlin', '07:00:00'),
    ('admin-1', 'Lair Broz Timothy Balmes', '09:00:00'),  # Default
    ('user-1764463415441', 'John Paolo Claveria', '09:00:00'),  # Default
    ('user-1', 'John Paul Arvesu', '09:00:00'),  # Default
    ('user-1764436870863', 'Sofia Morales', '07:00:00'),
    ('user-1764588484657', 'Brent Draniel Aclan', '09:00:00'),  # Default
    ('user-1764590020137', 'Cristian Javier', '09:00:00'),  # Default
    ('user-1764423066560', 'Jefferson Arvesu', '07:00:00'),
    ('user-manager-1', 'Jessica Martinez', '08:00:00'),
]

# Generate SQL for past 30 days
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
start_date = today - timedelta(days=29)

sql_output = []
sql_output.append("-- Simulated Attendance Logs for Past 30 Days")
sql_output.append("-- Generated based on actual employee data from database")
sql_output.append("-- Run this file to populate attendance_logs table\n")
sql_output.append("-- Clear existing attendance logs (optional)")
sql_output.append("-- DELETE FROM attendance_logs;\n")

for day_offset in range(30):
    current_day = start_date + timedelta(days=day_offset)
    date_str = current_day.strftime('%B %d, %Y')
    date_key = current_day.strftime('%Y%m%d')
    
    sql_output.append(f"\n-- {date_str}")
    sql_output.append("INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note, archived, archived_at, archived_by) VALUES")
    
    day_records = []
    
    # Each day, 70-90% of employees come to work
    working_employees = random.sample(employees, k=random.randint(int(len(employees) * 0.7), int(len(employees) * 0.9)))
    
    for emp_id, emp_name, shift_start in working_employees:
        # Parse shift time
        shift_hour, shift_minute = map(int, shift_start.split(':')[:2])
        
        # 70% on time, 30% late
        if random.random() < 0.7:
            clock_in_offset = random.randint(-10, 5)  # -10 to +5 minutes
            status = 'present'
        else:
            clock_in_offset = random.randint(5, 30)  # 5 to 30 minutes late
            status = 'late'
        
        clock_in_time = current_day.replace(hour=shift_hour, minute=shift_minute) + timedelta(minutes=clock_in_offset)
        
        # Work 8-9 hours
        work_duration = random.randint(480, 540)
        clock_out_time = clock_in_time + timedelta(minutes=work_duration)
        
        # Clock-in record
        day_records.append(
            f"('{emp_id}-{date_key}-in', '{emp_id}', 'in', "
            f"'{clock_in_time.strftime('%Y-%m-%d %H:%M:%S')}', "
            f"'{shift_start[:5]}', '{status}', false, NULL, NULL)"
        )
        
        # Clock-out record
        day_records.append(
            f"('{emp_id}-{date_key}-out', '{emp_id}', 'out', "
            f"'{clock_out_time.strftime('%Y-%m-%d %H:%M:%S')}', "
            f"'{shift_start[:5]}', '{status}', false, NULL, NULL)"
        )
    
    sql_output.append(',\n'.join(day_records) + ';')

sql_output.append("\n-- Attendance logs generated successfully!")
sql_output.append(f"-- Total days: 30 (from {start_date.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d')})")
sql_output.append(f"-- Total employees: {len(employees)}")

# Write to file
output_file = 'seed_attendance_logs_complete.sql'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_output))

print(f"✅ Generated {output_file}")
print(f"   30 days of attendance data")
print(f"   {len(employees)} employees")
print(f"   Date range: {start_date.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d')}")
print(f"\nTo apply: Run this SQL file against your database")
