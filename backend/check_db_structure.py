#!/usr/bin/env python3
"""
Check the actual database structure from production
"""
import asyncpg
import asyncio

# Production database credentials
DB_HOST = "dpg-ct5cqmu8ii6s73e7nh10-a.oregon-postgres.render.com"
DB_PORT = 5432
DB_USER = "sweetbox_db_user"
DB_PASSWORD = "6YJvv41xSUk9v3I6sLM6VqhPQh6NlK7K"
DB_NAME = "sweetbox_db"

async def check_structure():
    """Check database table structures"""
    try:
        print(f"Connecting to database at {DB_HOST}...")
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl='require'
        )
        print("✓ Connected successfully!\n")
        
        # Check orders table structure
        print("=" * 60)
        print("ORDERS TABLE STRUCTURE:")
        print("=" * 60)
        orders_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'orders'
            ORDER BY ordinal_position;
        """)
        
        for col in orders_columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f"DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  {col['column_name']:20} {col['data_type']:20} {nullable:10} {default}")
        
        # Check inventory table structure
        print("\n" + "=" * 60)
        print("INVENTORY TABLE STRUCTURE:")
        print("=" * 60)
        inventory_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'inventory'
            ORDER BY ordinal_position;
        """)
        
        for col in inventory_columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f"DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  {col['column_name']:20} {col['data_type']:20} {nullable:10} {default}")
        
        # Check users table structure
        print("\n" + "=" * 60)
        print("USERS TABLE STRUCTURE:")
        print("=" * 60)
        users_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        """)
        
        for col in users_columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f"DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  {col['column_name']:20} {col['data_type']:20} {nullable:10} {default}")
        
        await conn.close()
        print("\n✓ Database structure check complete!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_structure())
