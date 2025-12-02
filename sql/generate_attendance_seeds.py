"""
Generate SQL seed data for attendance logs (past 30 days)
Excludes admin and manager roles
Includes on-leave entries and late notes
"""
from datetime import datetime, timedelta
import random

# Employee data from actual database (non-admin users only)
# Fetched from database on 2025-12-02
employees = [
    ('staff-1', 'Ernesto Wells', '08:00:00'),
    ('staff-2', 'Mike Ehrmantraut', '06:00:00'),
    ('user-1764423066560', 'Jefferson Arvesu', '07:00:00'),
    ('user-1764436870863', 'Sofia Morales', '07:00:00'),
    ('user-1764571497896', 'Jake Hamlin', '07:00:00'),
    ('user-1764613939749', 'Jimmy McGill', '08:00:00'),
    ('user-manager-1', 'Jessica Martinez', '08:00:00'),
]

# Late excuse templates
late_reasons = [
    "Traffic jam on main road",
    "Car trouble - flat tire",
    "Public transport delay",
    "Family emergency",
    "Doctor appointment ran late",
    "Heavy rain caused delays",
    "Missed alarm",
    "Child care issue",
    "Road construction detour",
    "Accident on highway",
]

today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

sql_statements = []
sql_statements.append("-- Simulated Attendance Logs for Past 30 Days")
sql_statements.append("-- Generated for non-admin/non-manager employees")
sql_statements.append("-- Includes on-leave entries and late notes\n")
sql_statements.append("DELETE FROM attendance_logs;\n")

# Track who's on leave (employee_id: end_date)
on_leave_schedule = {}

for day_offset in range(30):
    current_day = today - timedelta(days=day_offset)
    
    # Randomly assign 1-2 employees to be on leave for 2-4 days
    if random.random() < 0.15:  # 15% chance per day to start a leave
        available_employees = [e for e in employees if e[0] not in on_leave_schedule or on_leave_schedule[e[0]] < current_day]
        if available_employees:
            leave_employee = random.choice(available_employees)
            leave_duration = random.randint(2, 4)
            on_leave_schedule[leave_employee[0]] = current_day + timedelta(days=leave_duration)
    
    for emp_id, emp_name, shift_start in employees:
        # Check if employee is on leave
        if emp_id in on_leave_schedule and on_leave_schedule[emp_id] >= current_day:
            # Create leave log entry
            leave_time = current_day.replace(hour=9, minute=0, second=0)
            leave_id = f"{emp_id}-{current_day.strftime('%Y%m%d')}-leave"
            
            sql_statements.append(
                f"INSERT INTO attendance_logs (id, employee_id, action, timestamp, note, archived, archived_at, archived_by) "
                f"VALUES ('{leave_id}', '{emp_id}', 'leave', '{leave_time.strftime('%Y-%m-%d %H:%M:%S')}', 'On approved leave', false, NULL, NULL);"
            )
            continue
        
        # 85% chance employee comes to work
        if random.random() > 0.85:
            continue
        
        # Parse shift time
        shift_hour, shift_minute = map(int, shift_start.split(':')[:2])
        
        # Determine if late (30% chance)
        if random.random() < 0.7:
            # On time: -10 to +5 minutes
            clock_in_offset = random.randint(-10, 5)
            note = None
        else:
            # Late: 5 to 60 minutes
            clock_in_offset = random.randint(5, 60)
            late_minutes = clock_in_offset
            
            # Calculate late duration
            if late_minutes >= 60:
                late_hours = late_minutes // 60
                remaining_minutes = late_minutes % 60
                if remaining_minutes > 0:
                    late_info = f"Late by {late_hours}h {remaining_minutes}m"
                else:
                    late_info = f"Late by {late_hours}h"
            else:
                late_info = f"Late by {late_minutes}m"
            
            # Add reason (70% of the time)
            if random.random() < 0.7:
                reason = random.choice(late_reasons)
                note = f"{late_info} - {reason}"
            else:
                note = late_info
        
        clock_in_time = current_day.replace(hour=shift_hour, minute=shift_minute) + timedelta(minutes=clock_in_offset)
        
        # Clock out: 8-9 hours later
        work_duration = random.randint(480, 540)
        clock_out_time = clock_in_time + timedelta(minutes=work_duration)
        
        # Generate IDs
        clock_in_id = f"{emp_id}-{current_day.strftime('%Y%m%d')}-in"
        clock_out_id = f"{emp_id}-{current_day.strftime('%Y%m%d')}-out"
        
        # Clock-in record (with note if late)
        note_value = f"'{note}'" if note else "NULL"
        sql_statements.append(
            f"INSERT INTO attendance_logs (id, employee_id, action, timestamp, note, archived, archived_at, archived_by) "
            f"VALUES ('{clock_in_id}', '{emp_id}', 'in', '{clock_in_time.strftime('%Y-%m-%d %H:%M:%S')}', {note_value}, false, NULL, NULL);"
        )
        
        # Clock-out record
        sql_statements.append(
            f"INSERT INTO attendance_logs (id, employee_id, action, timestamp, note, archived, archived_at, archived_by) "
            f"VALUES ('{clock_out_id}', '{emp_id}', 'out', '{clock_out_time.strftime('%Y-%m-%d %H:%M:%S')}', NULL, false, NULL, NULL);"
        )

# Write to file
with open('seed_attendance_logs.sql', 'w') as f:
    f.write('\n'.join(sql_statements))

print(f"✅ Generated {len(sql_statements) - 3} SQL statements")
print(f"   Saved to: seed_attendance_logs.sql")
print(f"\n   To apply: Run the SQL file against your database")
