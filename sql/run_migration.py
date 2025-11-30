# Run this script to add the unit column to your existing database
# Usage: python run_migration.py

import psycopg2
from urllib.parse import urlparse
import os

def run_migration():
    # Get database URL from environment or use default
    database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:4305@localhost:5432/sweetbox')
    
    # Parse the database URL
    result = urlparse(database_url)
    username = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            database=database,
            user=username,
            password=password,
            host=hostname,
            port=port
        )
        
        cursor = conn.cursor()
        
        # Read and execute the migration SQL
        with open('sql/add_unit_column.sql', 'r') as f:
            migration_sql = f.read()
        
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✓ Migration completed successfully!")
        print("✓ Unit column added to inventory table")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"✗ Error running migration: {e}")
        return False
    
    return True

if __name__ == '__main__':
    print("Running database migration...")
    print("Adding 'unit' column to inventory table...")
    success = run_migration()
    
    if success:
        print("\nYou can now run the seeds.sql file to populate with proper data:")
        print("  psql -U postgres -d sweetbox -f sql/seeds.sql")
