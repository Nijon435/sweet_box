#!/usr/bin/env python3
"""
Pre-deployment checklist for Sweet Box
Run this script to verify everything is ready for Render deployment
"""

import os
import sys

def check_file(filepath, description):
    """Check if a file exists"""
    exists = os.path.exists(filepath)
    status = "✓" if exists else "✗"
    print(f"{status} {description}: {filepath}")
    return exists

def check_gitignore():
    """Check if .env is in .gitignore"""
    if os.path.exists('.gitignore'):
        with open('.gitignore', 'r') as f:
            content = f.read()
            has_env = '.env' in content
            status = "✓" if has_env else "✗"
            print(f"{status} .env in .gitignore")
            return has_env
    return False

def check_env_example():
    """Check if .env.example exists but .env is not committed"""
    has_example = os.path.exists('backend/.env.example')
    env_exists = os.path.exists('backend/.env')
    
    status = "✓" if has_example else "✗"
    print(f"{status} .env.example exists (template for production)")
    
    if env_exists:
        print(f"⚠ Warning: .env file exists - make sure it's in .gitignore!")
    
    return has_example

def main():
    print("=" * 60)
    print("Sweet Box - Render Deployment Checklist")
    print("=" * 60)
    print()
    
    checks = []
    
    print("📁 Required Files:")
    checks.append(check_file('backend/main.py', 'Backend API'))
    checks.append(check_file('backend/requirements.txt', 'Python dependencies'))
    checks.append(check_file('sql/schema.sql', 'Database schema'))
    checks.append(check_file('sql/seeds.sql', 'Database seeds'))
    checks.append(check_file('index.html', 'Frontend entry point'))
    print()
    
    print("🚀 Deployment Files:")
    checks.append(check_file('Procfile', 'Procfile for process'))
    checks.append(check_file('runtime.txt', 'Python runtime version'))
    checks.append(check_file('render.yaml', 'Render blueprint (optional)'))
    print()
    
    print("🔒 Security:")
    checks.append(check_gitignore())
    checks.append(check_env_example())
    print()
    
    print("📄 Documentation:")
    check_file('DEPLOYMENT_GUIDE.md', 'Deployment guide')
    check_file('README.md', 'Project readme')
    print()
    
    # Summary
    passed = sum(checks)
    total = len(checks)
    
    print("=" * 60)
    if passed == total:
        print(f"✅ All checks passed ({passed}/{total})")
        print("🎉 Ready for Render deployment!")
        print()
        print("Next steps:")
        print("1. Commit and push to GitHub")
        print("2. Create PostgreSQL database on Render")
        print("3. Deploy backend service")
        print("4. Deploy frontend static site")
        print("5. Run database migrations")
        print()
        print("See DEPLOYMENT_GUIDE.md for detailed instructions")
        return 0
    else:
        print(f"⚠️ {total - passed} checks failed ({passed}/{total} passed)")
        print("Please fix the issues above before deploying")
        return 1

if __name__ == '__main__':
    sys.exit(main())
