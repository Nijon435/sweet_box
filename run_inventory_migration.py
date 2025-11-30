import asyncpg
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def run_migration():
    """Apply inventory fields migration to database"""
    
    # Try DATABASE_URL first, then fall back to individual vars
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        import re
        match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', DATABASE_URL)
        if match:
            DB_USER = match.group(1)
            DB_PASSWORD = match.group(2)
            DB_HOST = match.group(3)
            DB_PORT = int(match.group(4)) if match.group(4) else 5432
            DB_NAME = match.group(5)
        else:
            DB_HOST = os.getenv("DB_HOST", "localhost")
            DB_PORT = int(os.getenv("DB_PORT", 5432))
            DB_NAME = os.getenv("DB_NAME", "sweetbox")
            DB_USER = os.getenv("DB_USER", "postgres")
            DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    else:
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = int(os.getenv("DB_PORT", 5432))
        DB_NAME = os.getenv("DB_NAME", "sweetbox")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    
    print(f"Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME}...")
    
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        
        print("✓ Connected successfully")
        
        # Read migration file
        with open('sql/add_inventory_fields.sql', 'r') as f:
            migration_sql = f.read()
        
        print("\nApplying migration...")
        
        # Execute migration
        await conn.execute(migration_sql)
        
        print("✓ Migration applied successfully!")
        
        # Verify columns exist
        result = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'inventory'
            ORDER BY ordinal_position
        """)
        
        print("\nInventory table columns:")
        for row in result:
            print(f"  - {row['column_name']}")
        
        # Check sample data
        sample = await conn.fetchrow("SELECT * FROM inventory LIMIT 1")
        if sample:
            print("\nSample inventory record:")
            print(f"  ID: {sample['id']}")
            print(f"  Name: {sample['name']}")
            print(f"  Date Purchased: {sample.get('date_purchased', 'N/A')}")
            print(f"  Use By Date: {sample.get('use_by_date', 'N/A')}")
            print(f"  Reorder Point: {sample.get('reorder_point', 'N/A')}")
            print(f"  Total Used: {sample.get('total_used', 'N/A')}")
        
        await conn.close()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_migration())
