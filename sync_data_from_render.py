"""
Data Sync Script
Pulls data from your live Render database and saves it to local pgAdmin
This ensures your local database matches the production data
"""
import asyncpg
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Render database (production)
RENDER_DB_URL = os.getenv("DATABASE_URL")

# Local pgAdmin database
LOCAL_DB_HOST = os.getenv("LOCAL_DB_HOST", "localhost")
LOCAL_DB_PORT = int(os.getenv("LOCAL_DB_PORT", 5432))
LOCAL_DB_NAME = os.getenv("LOCAL_DB_NAME", "sweetbox")
LOCAL_DB_USER = os.getenv("LOCAL_DB_USER", "postgres")
LOCAL_DB_PASSWORD = os.getenv("LOCAL_DB_PASSWORD", "")

TABLES = ["users", "attendance_logs", "inventory", "orders", "sales_history", "inventory_usage"]

async def sync_data():
    """Sync data from Render (live) to local pgAdmin"""
    
    if not RENDER_DB_URL:
        print("❌ ERROR: DATABASE_URL not found")
        return
    
    print("="*60)
    print("📊 SWEET BOX - Data Sync Script")
    print("="*60)
    print()
    
    try:
        # Connect to Render (source)
        print("🔗 Connecting to Render database...")
        render_conn = await asyncpg.connect(RENDER_DB_URL)
        print("✅ Connected to Render\n")
        
        # Connect to local pgAdmin (destination)
        print("🔗 Connecting to local database...")
        local_conn = await asyncpg.connect(
            host=LOCAL_DB_HOST,
            port=LOCAL_DB_PORT,
            user=LOCAL_DB_USER,
            password=LOCAL_DB_PASSWORD,
            database=LOCAL_DB_NAME
        )
        print("✅ Connected to local pgAdmin\n")
        
        print("📥 Syncing data from Render to local...\n")
        
        # Track valid user IDs for foreign key validation
        valid_user_ids = set()
        
        for table in TABLES:
            print(f"   📋 Syncing {table}...", end=" ")
            
            # Fetch data from Render
            rows = await render_conn.fetch(f"SELECT * FROM {table}")
            
            if not rows:
                print(f"(empty)")
                continue
            
            # Clear local table
            await local_conn.execute(f"TRUNCATE TABLE {table} CASCADE")
            
            # Insert data into local
            if table == "users":
                inserted = 0
                for row in rows:
                    await local_conn.execute("""
                        INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    """, row['id'], row['name'], row.get('email'), row.get('password'), 
                       row.get('phone'), row['role'], row.get('permission'), 
                       row.get('shift_start'), row.get('hire_date'), row.get('status'), row.get('created_at'))
                    valid_user_ids.add(row['id'])
                    inserted += 1
                print(f"✅ {inserted} rows")
                       
            elif table == "attendance_logs":
                inserted = 0
                skipped = 0
                for row in rows:
                    # Only insert if employee_id exists in users table
                    employee_id = row['employee_id']
                    if employee_id in valid_user_ids:
                        try:
                            await local_conn.execute("""
                                INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note)
                                VALUES ($1, $2, $3, $4, $5, $6)
                            """, row['id'], employee_id, row['action'], 
                               row['timestamp'], row.get('shift'), row.get('note'))
                            inserted += 1
                        except Exception as e:
                            skipped += 1
                    else:
                        skipped += 1
                
                if skipped > 0:
                    print(f"✅ {inserted} rows (⚠️  skipped {skipped} invalid references)")
                else:
                    print(f"✅ {inserted} rows")
                       
            elif table == "inventory":
                inserted = 0
                for row in rows:
                    await local_conn.execute("""
                        INSERT INTO inventory (id, category, name, quantity, unit, cost, reorder_point, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """, row['id'], row.get('category'), row['name'], 
                       row.get('quantity'), row.get('unit'), row.get('cost'), 
                       row.get('reorder_point'), row.get('created_at'))
                    inserted += 1
                print(f"✅ {inserted} rows")
                       
            elif table == "orders":
                inserted = 0
                for row in rows:
                    await local_conn.execute("""
                        INSERT INTO orders (id, customer, items, items_json, total, status, type, timestamp, served_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """, row['id'], row.get('customer'), row.get('items'), 
                       row.get('items_json'), row.get('total'), row.get('status'), 
                       row.get('type'), row['timestamp'], row.get('served_at'))
                    inserted += 1
                print(f"✅ {inserted} rows")
                       
            elif table == "sales_history":
                inserted = 0
                for row in rows:
                    await local_conn.execute("""
                        INSERT INTO sales_history (id, date, total, orders_count)
                        VALUES ($1, $2, $3, $4)
                    """, row['id'], row['date'], row.get('total'), row.get('orders_count'))
                    inserted += 1
                print(f"✅ {inserted} rows")
                       
            elif table == "inventory_usage":
                inserted = 0
                for row in rows:
                    await local_conn.execute("""
                        INSERT INTO inventory_usage (id, label, used)
                        VALUES ($1, $2, $3)
                    """, row['id'], row['label'], row.get('used'))
                    inserted += 1
                print(f"✅ {inserted} rows")
        
        await render_conn.close()
        await local_conn.close()
        
        print("\n" + "="*60)
        print("✅ DATA SYNC COMPLETE!")
        print("="*60)
        print("Your local pgAdmin database now matches Render")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        print("\n💡 Make sure:")
        print("   1. Your local PostgreSQL is running")
        print("   2. Local database credentials in .env are correct")
        print("   3. The 'sweetbox' database exists in pgAdmin")

if __name__ == "__main__":
    asyncio.run(sync_data())
