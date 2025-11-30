#!/usr/bin/env python3
"""
Update Render Production Database
- Add unit column
- Add date_purchased and expiry_date columns
- Add ingredient_usage_logs table
- Update existing inventory with proper units
"""

import psycopg2
from urllib.parse import urlparse
import os
from dotenv import load_dotenv

load_dotenv()

def update_render_database():
    # Get Render database URL
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL not found in .env file")
        return
    
    # Parse the database URL
    result = urlparse(database_url)
    username = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port or 5432
    
    print(f"🔄 Connecting to Render database: {hostname}/{database}")
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            database=database,
            user=username,
            password=password,
            host=hostname,
            port=port,
            sslmode='require'  # Render requires SSL
        )
        
        cursor = conn.cursor()
        
        print("\n📋 Checking current schema...")
        
        # Check existing columns
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'inventory'
            ORDER BY ordinal_position;
        """)
        existing_columns = [row[0] for row in cursor.fetchall()]
        print(f"   Current columns: {', '.join(existing_columns)}")
        
        # Add unit column if missing
        if 'unit' not in existing_columns:
            print("\n✅ Adding 'unit' column...")
            cursor.execute("""
                ALTER TABLE inventory 
                ADD COLUMN unit VARCHAR(32) DEFAULT 'kg';
            """)
            conn.commit()
            print("   ✓ Unit column added")
        else:
            print("\n✓ Unit column already exists")
        
        # Add date_purchased column if missing
        if 'date_purchased' not in existing_columns:
            print("\n✅ Adding 'date_purchased' column...")
            cursor.execute("""
                ALTER TABLE inventory 
                ADD COLUMN date_purchased DATE;
            """)
            conn.commit()
            print("   ✓ date_purchased column added")
        else:
            print("\n✓ date_purchased column already exists")
        
        # Add expiry_date column if missing
        if 'expiry_date' not in existing_columns:
            print("\n✅ Adding 'expiry_date' column...")
            cursor.execute("""
                ALTER TABLE inventory 
                ADD COLUMN expiry_date DATE;
            """)
            conn.commit()
            print("   ✓ expiry_date column added")
        else:
            print("\n✓ expiry_date column already exists")
        
        # Check if ingredient_usage_logs table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ingredient_usage_logs'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("\n✅ Creating 'ingredient_usage_logs' table...")
            cursor.execute("""
                CREATE TABLE ingredient_usage_logs (
                    id SERIAL PRIMARY KEY,
                    inventory_item_id VARCHAR(64) REFERENCES inventory(id) ON DELETE CASCADE,
                    quantity NUMERIC(12,2) NOT NULL,
                    reason VARCHAR(64) NOT NULL,
                    order_id VARCHAR(64) REFERENCES orders(id) ON DELETE SET NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX idx_usage_logs_inventory ON ingredient_usage_logs(inventory_item_id);
                CREATE INDEX idx_usage_logs_reason ON ingredient_usage_logs(reason);
                CREATE INDEX idx_usage_logs_date ON ingredient_usage_logs(created_at);
            """)
            conn.commit()
            print("   ✓ ingredient_usage_logs table created")
        else:
            print("\n✓ ingredient_usage_logs table already exists")
        
        # Update inventory items with proper units
        print("\n✅ Updating inventory items with proper units...")
        
        # Get all inventory items
        cursor.execute("SELECT id, name, category FROM inventory ORDER BY id;")
        items = cursor.fetchall()
        
        updates = []
        for item_id, name, category in items:
            # Determine unit based on name/category
            if any(keyword in name.lower() for keyword in ['cake', 'slice', 'macaron', 'croissant', 'tart', 'cupcake', 'donut']):
                unit = 'whole'
            elif any(keyword in name.lower() for keyword in ['coffee', 'tea', 'juice', 'water', 'soda', 'milk', 'latte', 'cappuccino']):
                unit = 'liters'
            elif any(keyword in name.lower() for keyword in ['flour', 'sugar', 'butter', 'cream', 'chocolate', 'vanilla', 'cocoa', 'yeast', 'salt', 'baking']):
                unit = 'kg'
            elif any(keyword in name.lower() for keyword in ['box', 'pack', 'bag', 'container', 'wrapper']):
                unit = 'box'
            elif any(keyword in name.lower() for keyword in ['egg', 'eggs']):
                unit = 'dozen'
            elif any(keyword in name.lower() for keyword in ['cup', 'plate', 'napkin', 'spoon', 'fork']):
                unit = 'pieces'
            else:
                unit = 'pieces'  # default
            
            updates.append((unit, item_id))
        
        # Execute batch update
        cursor.executemany("UPDATE inventory SET unit = %s WHERE id = %s;", updates)
        conn.commit()
        print(f"   ✓ Updated {len(updates)} items with proper units")
        
        # Show unit distribution
        cursor.execute("""
            SELECT unit, COUNT(*) as count 
            FROM inventory 
            GROUP BY unit 
            ORDER BY unit;
        """)
        print("\n📊 Unit distribution:")
        for unit, count in cursor.fetchall():
            print(f"   {unit}: {count} items")
        
        # Show sample items
        print("\n📦 Sample inventory items:")
        cursor.execute("""
            SELECT id, name, unit, quantity 
            FROM inventory 
            ORDER BY id 
            LIMIT 10;
        """)
        for item_id, name, unit, qty in cursor.fetchall():
            print(f"   {item_id}: {name} ({qty} {unit})")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Render database updated successfully!")
        print("\n📝 Next steps:")
        print("   1. Deploy backend to Render (it will use the updated schema)")
        print("   2. Test the Record Usage feature on the live site")
        print("   3. Verify units display correctly in inventory")
        
    except Exception as e:
        print(f"\n❌ Error updating database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_render_database()
