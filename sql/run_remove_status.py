#!/usr/bin/env python3
"""
Script to run the remove_order_status.sql migration on the production database
"""
import asyncpg
import asyncio
import os

# Production database credentials
DB_HOST = "dpg-ct5cqmu8ii6s73e7nh10-a.oregon-postgres.render.com"
DB_PORT = 5432
DB_USER = "sweetbox_db_user"
DB_PASSWORD = "6YJvv41xSUk9v3I6sLM6VqhPQh6NlK7K"
DB_NAME = "sweetbox_db"

async def run_migration():
    """Execute the remove_order_status.sql migration"""
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
        print("Connected successfully!")
        
        # Read the migration file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        migration_file = os.path.join(script_dir, "remove_order_status.sql")
        
        print(f"Reading migration file: {migration_file}")
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        # Split by semicolons and execute each statement
        statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        print(f"\nExecuting {len(statements)} SQL statements...")
        for i, statement in enumerate(statements, 1):
            # Skip if it's just a comment
            if statement.strip().startswith('--'):
                continue
            print(f"\n{i}. Executing: {statement[:80]}...")
            try:
                await conn.execute(statement)
                print(f"   ✓ Success")
            except Exception as e:
                print(f"   ⚠ Warning: {e}")
        
        await conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error running migration: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_migration())
