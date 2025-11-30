#!/usr/bin/env python3
"""
Populate inventory dates and usage data with realistic fabricated data
"""

import psycopg2
from urllib.parse import urlparse
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import random

load_dotenv()

def populate_dates():
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL not found in .env file")
        return
    
    result = urlparse(database_url)
    
    print(f"🔄 Connecting to database...")
    
    try:
        conn = psycopg2.connect(
            database=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port or 5432,
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        # Get all inventory items
        cursor.execute("SELECT id, name, unit, quantity FROM inventory ORDER BY id;")
        items = cursor.fetchall()
        
        print(f"\n📦 Updating {len(items)} inventory items with fabricated dates and usage data...")
        
        updates = []
        today = datetime.now().date()
        
        for item_id, name, unit, quantity in items:
            # Convert quantity to float
            qty = float(quantity)
            
            # Generate realistic dates based on item type
            
            # Date purchased: Random date within last 1-60 days
            days_since_purchase = random.randint(1, 60)
            date_purchased = today - timedelta(days=days_since_purchase)
            
            # Last restocked: Random date within last 1-30 days
            days_since_restock = random.randint(1, min(30, days_since_purchase))
            last_restocked = today - timedelta(days=days_since_restock)
            
            # Determine shelf life based on item category
            if any(keyword in name.lower() for keyword in ['cake', 'slice', 'pastry', 'croissant', 'donut', 'macaron', 'tart']):
                # Fresh baked goods: 3-7 days shelf life
                shelf_life_days = random.randint(3, 7)
                use_by = last_restocked + timedelta(days=shelf_life_days)
                expiry = use_by + timedelta(days=1)
            elif any(keyword in name.lower() for keyword in ['milk', 'cream', 'juice']):
                # Dairy/beverages: 7-14 days
                shelf_life_days = random.randint(7, 14)
                use_by = last_restocked + timedelta(days=shelf_life_days)
                expiry = use_by + timedelta(days=2)
            elif any(keyword in name.lower() for keyword in ['coffee', 'tea', 'water', 'soda']):
                # Packaged drinks: 30-180 days
                shelf_life_days = random.randint(30, 180)
                use_by = last_restocked + timedelta(days=shelf_life_days)
                expiry = use_by + timedelta(days=7)
            elif any(keyword in name.lower() for keyword in ['flour', 'sugar', 'butter', 'chocolate', 'vanilla']):
                # Ingredients: 60-365 days
                shelf_life_days = random.randint(60, 365)
                use_by = last_restocked + timedelta(days=shelf_life_days)
                expiry = use_by + timedelta(days=30)
            else:
                # Default: 30-90 days
                shelf_life_days = random.randint(30, 90)
                use_by = last_restocked + timedelta(days=shelf_life_days)
                expiry = use_by + timedelta(days=7)
            
            # Total used: Random amount based on how long since purchase and item type
            if unit == 'whole':
                # For whole items (cakes, etc)
                max_used = min(50, int(qty * 0.3))
                total_used = random.randint(5, max(5, max_used))
            elif unit in ['kg', 'liters']:
                # For bulk items
                max_used = min(100, int(qty * 0.4))
                total_used = round(random.uniform(10, max(10, max_used)), 2)
            elif unit == 'pieces':
                # For individual pieces
                max_used = min(200, int(qty * 0.3))
                total_used = random.randint(20, max(20, max_used))
            elif unit == 'box':
                # For boxes
                max_used = min(10, int(qty * 0.2))
                total_used = random.randint(1, max(1, max_used))
            elif unit == 'dozen':
                # For dozens
                max_used = min(20, int(qty * 0.3))
                total_used = random.randint(2, max(2, max_used))
            else:
                # Default
                total_used = round(random.uniform(5, 50), 2)
            
            updates.append((
                date_purchased,
                use_by,
                expiry,
                last_restocked,
                float(total_used),
                item_id
            ))
        
        # Execute batch update
        cursor.executemany("""
            UPDATE inventory 
            SET date_purchased = %s,
                use_by_date = %s,
                expiry_date = %s,
                last_restocked = %s,
                total_used = %s
            WHERE id = %s;
        """, updates)
        
        conn.commit()
        print(f"   ✓ Updated {len(updates)} items")
        
        # Show sample data
        print("\n📊 Sample inventory with dates:")
        cursor.execute("""
            SELECT id, name, unit, quantity, 
                   date_purchased, use_by_date, expiry_date, 
                   last_restocked, total_used
            FROM inventory 
            ORDER BY id 
            LIMIT 10;
        """)
        
        for row in cursor.fetchall():
            item_id, name, unit, qty, purchased, use_by, expiry, restocked, used = row
            print(f"\n   {item_id}: {name}")
            print(f"      Quantity: {qty} {unit}")
            print(f"      Purchased: {purchased}")
            print(f"      Last Restocked: {restocked}")
            print(f"      Use By: {use_by}")
            print(f"      Expires: {expiry}")
            print(f"      Total Used: {used} {unit}")
        
        # Show items expiring soon
        print("\n⚠️  Items expiring within 7 days:")
        cursor.execute("""
            SELECT id, name, unit, expiry_date
            FROM inventory 
            WHERE expiry_date <= CURRENT_DATE + INTERVAL '7 days'
            ORDER BY expiry_date
            LIMIT 10;
        """)
        
        expiring_items = cursor.fetchall()
        if expiring_items:
            for item_id, name, unit, expiry in expiring_items:
                days_until_expiry = (expiry - today).days
                print(f"   {item_id}: {name} - Expires in {days_until_expiry} days ({expiry})")
        else:
            print("   No items expiring soon")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Inventory dates and usage data populated successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    populate_dates()
