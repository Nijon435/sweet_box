"""
Final database cleanup:
1. Drop the 'employees' table (obsolete, replaced by users)
2. Remove unused columns:
   - orders.items (superseded by items_json)
   - inventory.unit (not used in app)
   - inventory.reorder_point (not used in app)
3. Keep attendance_logs.shift (used for display purposes)
4. Keep users.status, users.phone (actively used)
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
        # 1. Drop the employees table if it exists
        employees_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'employees'
            );
        """)
        
        if employees_exists:
            print("✓ Found obsolete 'employees' table - dropping...")
            await conn.execute("DROP TABLE IF EXISTS employees CASCADE;")
            print("  ✓ Dropped 'employees' table")
        else:
            print("✓ No 'employees' table found (already removed)")
        
        # 2. Remove orders.items column (text version, superseded by items_json)
        items_col_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name = 'items'
            );
        """)
        
        if items_col_exists:
            # First, migrate any data from items to items_json if needed
            items_only_count = await conn.fetchval("""
                SELECT COUNT(*) FROM orders 
                WHERE items IS NOT NULL AND items != '' 
                AND items_json IS NULL;
            """)
            
            if items_only_count > 0:
                print(f"  ⚠️  Found {items_only_count} orders with only 'items' text data")
                print("     Migrating to items_json before dropping column...")
                
                # Get orders that need migration
                orders_to_migrate = await conn.fetch("""
                    SELECT id, items FROM orders 
                    WHERE items IS NOT NULL AND items != '' 
                    AND items_json IS NULL;
                """)
                
                for order in orders_to_migrate:
                    # Try to parse as JSON array
                    items_text = order['items']
                    try:
                        # Assume it's a JSON string already
                        await conn.execute("""
                            UPDATE orders 
                            SET items_json = $1::jsonb 
                            WHERE id = $2;
                        """, items_text, order['id'])
                    except:
                        print(f"      ⚠️  Could not migrate order {order['id']}")
                
                print("     ✓ Migration complete")
            
            print("✓ Removing 'orders.items' column (superseded by items_json)...")
            await conn.execute("ALTER TABLE orders DROP COLUMN IF EXISTS items;")
            print("  ✓ Removed 'orders.items' column")
        else:
            print("✓ No 'orders.items' column found (already removed)")
        
        # 3. Remove inventory.unit column
        unit_col_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'inventory' AND column_name = 'unit'
            );
        """)
        
        if unit_col_exists:
            print("✓ Removing 'inventory.unit' column (not used in app)...")
            await conn.execute("ALTER TABLE inventory DROP COLUMN IF EXISTS unit;")
            print("  ✓ Removed 'inventory.unit' column")
        else:
            print("✓ No 'inventory.unit' column found (already removed)")
        
        # 4. Remove inventory.reorder_point column
        reorder_col_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'inventory' AND column_name = 'reorder_point'
            );
        """)
        
        if reorder_col_exists:
            print("✓ Removing 'inventory.reorder_point' column (not used in app)...")
            await conn.execute("ALTER TABLE inventory DROP COLUMN IF EXISTS reorder_point;")
            print("  ✓ Removed 'inventory.reorder_point' column")
        else:
            print("✓ No 'inventory.reorder_point' column found (already removed)")
        
        # 5. Summary of kept columns and why
        print("\n📋 Columns kept (used by application):")
        print("  ✓ users.status - tracks active/inactive employees")
        print("  ✓ users.phone - contact information for employees")
        print("  ✓ attendance_logs.shift - displays shift in attendance logs")
        print("  ✓ orders.items_json - JSONB format for order items")
        print("  ✓ inventory.category, name, quantity, cost - core inventory fields")
        
        # Final schema check
        print("\n📊 Final database schema:")
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
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position;
            """, table_name)
            
            col_names = [col['column_name'] for col in columns]
            print(f"  📋 {table_name}: {', '.join(col_names)}")
        
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
    print("✅ Database cleanup complete!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
