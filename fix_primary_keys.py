"""
Fix Primary Key Constraints on Render Database
This script adds PRIMARY KEY constraints to tables that are missing them.
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

# Render database credentials
RENDER_DB_URL = os.getenv("DATABASE_URL")

async def fix_primary_keys():
    """Add PRIMARY KEY constraints to tables"""
    
    print("Connecting to Render database...")
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Check current constraints
        print("\n--- Checking existing constraints ---")
        constraints = await conn.fetch("""
            SELECT table_name, constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND constraint_type = 'PRIMARY KEY'
            ORDER BY table_name
        """)
        
        print("\nExisting PRIMARY KEY constraints:")
        for c in constraints:
            print(f"  {c['table_name']}: {c['constraint_name']}")
        
        # Tables that need PRIMARY KEY
        tables_to_fix = [
            ('users', 'id'),
            ('attendance_logs', 'id'),
            ('inventory', 'id'),
            ('orders', 'id'),
            ('sales_history', 'id'),
            ('inventory_usage', 'id')
        ]
        
        print("\n--- Adding PRIMARY KEY constraints ---")
        
        for table_name, pk_column in tables_to_fix:
            # Check if table exists
            table_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            """, table_name)
            
            if not table_exists:
                print(f"⚠️  Table {table_name} does not exist, skipping...")
                continue
            
            # Check if PRIMARY KEY already exists
            has_pk = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.table_constraints
                    WHERE table_schema = 'public'
                    AND table_name = $1
                    AND constraint_type = 'PRIMARY KEY'
                )
            """, table_name)
            
            if has_pk:
                print(f"✓ Table {table_name} already has PRIMARY KEY")
                continue
            
            # Check for duplicate values in the id column
            print(f"\nChecking {table_name} for duplicate {pk_column} values...")
            duplicates = await conn.fetch(f"""
                SELECT {pk_column}, COUNT(*) as count
                FROM {table_name}
                GROUP BY {pk_column}
                HAVING COUNT(*) > 1
            """)
            
            if duplicates:
                print(f"❌ Found {len(duplicates)} duplicate {pk_column} values in {table_name}:")
                for dup in duplicates[:5]:  # Show first 5
                    print(f"   {dup[pk_column]}: {dup['count']} occurrences")
                
                # Ask for confirmation to delete duplicates
                response = input(f"\nDelete duplicate rows in {table_name}? (yes/no): ")
                if response.lower() == 'yes':
                    # Keep only the first occurrence of each id
                    deleted = await conn.execute(f"""
                        DELETE FROM {table_name}
                        WHERE ctid NOT IN (
                            SELECT MIN(ctid)
                            FROM {table_name}
                            GROUP BY {pk_column}
                        )
                    """)
                    print(f"   Deleted duplicates: {deleted}")
                else:
                    print(f"   Skipping {table_name}...")
                    continue
            
            # Add PRIMARY KEY constraint
            try:
                print(f"Adding PRIMARY KEY to {table_name}({pk_column})...")
                await conn.execute(f"""
                    ALTER TABLE {table_name}
                    ADD PRIMARY KEY ({pk_column})
                """)
                print(f"✓ Successfully added PRIMARY KEY to {table_name}")
            except Exception as e:
                print(f"❌ Failed to add PRIMARY KEY to {table_name}: {e}")
        
        print("\n--- Final constraint check ---")
        final_constraints = await conn.fetch("""
            SELECT table_name, constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND constraint_type = 'PRIMARY KEY'
            ORDER BY table_name
        """)
        
        print("\nFinal PRIMARY KEY constraints:")
        for c in final_constraints:
            print(f"  ✓ {c['table_name']}: {c['constraint_name']}")
        
        print("\n✅ Primary key fix complete!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_primary_keys())
