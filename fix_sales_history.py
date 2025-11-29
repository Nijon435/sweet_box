"""
Fix sales_history table - add ids to rows with null ids
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

RENDER_DB_URL = os.getenv("DATABASE_URL")

async def fix_sales_history():
    print("Connecting to Render database...")
    conn = await asyncpg.connect(RENDER_DB_URL)
    
    try:
        # Check for null ids in sales_history
        print("\n--- Checking sales_history for null ids ---")
        null_ids = await conn.fetch("""
            SELECT date, total, orders_count
            FROM sales_history
            WHERE id IS NULL
            ORDER BY date
        """)
        
        if null_ids:
            print(f"Found {len(null_ids)} rows with null ids:")
            for row in null_ids:
                print(f"  Date: {row['date']}, Total: {row['total']}, Orders: {row['orders_count']}")
            
            print("\nFixing null ids...")
            for row in null_ids:
                new_id = f"sale-{uuid.uuid4().hex[:12]}"
                await conn.execute("""
                    UPDATE sales_history
                    SET id = $1
                    WHERE date = $2 AND id IS NULL
                """, new_id, row['date'])
                print(f"  ✓ Set id={new_id} for date={row['date']}")
            
            print(f"\n✅ Fixed {len(null_ids)} rows")
        else:
            print("✓ No rows with null ids found")
        
        # Check for duplicate dates (might cause issues)
        print("\n--- Checking for duplicate dates ---")
        duplicates = await conn.fetch("""
            SELECT date, COUNT(*) as count
            FROM sales_history
            GROUP BY date
            HAVING COUNT(*) > 1
        """)
        
        if duplicates:
            print(f"⚠️  Found {len(duplicates)} duplicate dates:")
            for dup in duplicates:
                print(f"  Date: {dup['date']} appears {dup['count']} times")
                
                # Show the duplicate rows
                rows = await conn.fetch("""
                    SELECT id, date, total, orders_count
                    FROM sales_history
                    WHERE date = $1
                    ORDER BY id
                """, dup['date'])
                
                for r in rows:
                    print(f"    id={r['id']}, total={r['total']}, orders={r['orders_count']}")
        else:
            print("✓ No duplicate dates found")
        
        # Show final state
        print("\n--- Final sales_history table ---")
        all_sales = await conn.fetch("""
            SELECT id, date, total, orders_count
            FROM sales_history
            ORDER BY date DESC
            LIMIT 10
        """)
        
        print("Last 10 entries:")
        for sale in all_sales:
            print(f"  {sale['date']}: id={sale['id']}, total={sale['total']}, orders={sale['orders_count']}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_sales_history())
