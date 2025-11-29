"""
Cleanup database schema:
1. Remove unused 'pin' column from users table
2. Check for any remaining 'employee' foreign keys
3. Identify unnecessary columns across all tables
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup_database(db_url, db_name):
    """Clean up the database schema"""
    print(f"\n{'='*60}")
    print(f"Processing: {db_name}")
    print(f"{'='*60}")
    
    conn = await asyncpg.connect(db_url)
    
    try:
        # 1. Check if 'pin' column exists in users table
        pin_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name = 'pin'
            );
        """)
        
        if pin_exists:
            print("✓ Found 'pin' column in users table - removing...")
            await conn.execute("ALTER TABLE users DROP COLUMN IF EXISTS pin;")
            print("  ✓ Removed 'pin' column from users")
        else:
            print("✓ No 'pin' column found in users table")
        
        # 2. Check all foreign keys for references to 'employees' table
        print("\n📋 Checking for foreign keys referencing 'employees' table...")
        employee_fks = await conn.fetch("""
            SELECT 
                tc.table_name,
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'employees';
        """)
        
        if employee_fks:
            print(f"  ⚠️  Found {len(employee_fks)} foreign key(s) referencing 'employees' table:")
            for fk in employee_fks:
                print(f"    - {fk['table_name']}.{fk['column_name']} → employees")
                print(f"      Constraint: {fk['constraint_name']}")
        else:
            print("  ✓ No foreign keys referencing 'employees' table found")
        
        # 3. List all tables and their columns
        print("\n📊 Current database schema:")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        for table in tables:
            table_name = table['table_name']
            columns = await conn.fetch("""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position;
            """, table_name)
            
            print(f"\n  📋 {table_name}:")
            for col in columns:
                col_type = col['data_type']
                if col['character_maximum_length']:
                    col_type += f"({col['character_maximum_length']})"
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"    - {col['column_name']}: {col_type} {nullable}{default}")
        
        # 4. Check for foreign keys
        print("\n🔗 Foreign Key Constraints:")
        all_fks = await conn.fetch("""
            SELECT 
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name;
        """)
        
        for fk in all_fks:
            print(f"  {fk['table_name']}.{fk['column_name']} → {fk['foreign_table_name']}.{fk['foreign_column_name']}")
        
        # 5. Suggestions for unnecessary columns
        print("\n💡 Analysis and Recommendations:")
        
        # Check users table
        users_cols = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        """)
        users_col_names = [col['column_name'] for col in users_cols]
        
        print("\n  users table columns:")
        for col_name in users_col_names:
            print(f"    - {col_name}")
        
        # Check for potentially unused columns
        print("\n  Potentially unused columns to review:")
        
        # Check if status column is used
        status_values = await conn.fetch("SELECT DISTINCT status FROM users;")
        print(f"    - users.status: {len(status_values)} distinct value(s) - {[v['status'] for v in status_values]}")
        
        # Check if phone is used
        phone_count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE phone IS NOT NULL AND phone != '';")
        total_users = await conn.fetchval("SELECT COUNT(*) FROM users;")
        print(f"    - users.phone: Used by {phone_count}/{total_users} users")
        
        # Check attendance_logs.shift usage
        shift_count = await conn.fetchval("SELECT COUNT(*) FROM attendance_logs WHERE shift IS NOT NULL AND shift != '';")
        total_logs = await conn.fetchval("SELECT COUNT(*) FROM attendance_logs;")
        print(f"    - attendance_logs.shift: Used by {shift_count}/{total_logs} logs")
        
        # Check orders.items (old text field) vs items_json
        items_text_count = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE items IS NOT NULL AND items != '';")
        items_json_count = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE items_json IS NOT NULL;")
        total_orders = await conn.fetchval("SELECT COUNT(*) FROM orders;")
        print(f"    - orders.items (text): Used by {items_text_count}/{total_orders} orders")
        print(f"    - orders.items_json (jsonb): Used by {items_json_count}/{total_orders} orders")
        if items_json_count > 0 and items_text_count == 0:
            print(f"      → Consider removing 'items' text column (superseded by items_json)")
        
    finally:
        await conn.close()

async def main():
    """Run cleanup on both databases"""
    # Render (Production) Database
    render_url = os.getenv("DATABASE_URL")
    if render_url:
        await cleanup_database(render_url, "Render (Production)")
    
    # Local Database
    local_host = os.getenv("LOCAL_DB_HOST", "localhost")
    local_port = os.getenv("LOCAL_DB_PORT", "5432")
    local_db = os.getenv("LOCAL_DB_NAME", "sweetbox")
    local_user = os.getenv("LOCAL_DB_USER", "postgres")
    local_pass = os.getenv("LOCAL_DB_PASSWORD", "")
    
    if local_pass:
        local_url = f"postgresql://{local_user}:{local_pass}@{local_host}:{local_port}/{local_db}"
        await cleanup_database(local_url, "Local (pgAdmin)")
    
    print("\n" + "="*60)
    print("✅ Database cleanup analysis complete!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
