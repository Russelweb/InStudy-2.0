#!/usr/bin/env python3
"""
Test script for admin functionality.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_admin_system():
    """Test the admin functionality"""
    print("🔐 Testing InStudy 2.0 Admin System")
    print("=" * 50)
    
    # Test 1: Login as admin
    print("\n1. Testing admin login...")
    login_data = {
        "email": "admin@instudy.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                print("✅ Admin login successful!")
                admin_token = result["session_token"]
                admin_headers = {"Authorization": f"Bearer {admin_token}"}
                print(f"   Admin user: {result['user']['email']}")
                print(f"   Is admin: {result['user']['is_admin']}")
            else:
                print(f"❌ Admin login failed: {result['error_message']}")
                return
        else:
            print(f"❌ Admin login failed with status {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Admin login error: {e}")
        return
    
    # Test 2: Get system stats
    print("\n2. Testing system stats...")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        if response.status_code == 200:
            stats = response.json()
            print("✅ System stats retrieved successfully!")
            print(f"   Total users: {stats['total_users']}")
            print(f"   Total admins: {stats['total_admins']}")
            print(f"   Total documents: {stats['total_documents']}")
            print(f"   Total courses: {stats['total_courses']}")
        else:
            print(f"❌ System stats failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ System stats error: {e}")
    
    # Test 3: Get all users
    print("\n3. Testing user management...")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        if response.status_code == 200:
            users_data = response.json()
            users = users_data['users']
            print("✅ User list retrieved successfully!")
            print(f"   Found {len(users)} users:")
            for user in users:
                role = "🔐 Admin" if user['is_admin'] else "👤 User"
                print(f"   - {user['email']} ({role})")
        else:
            print(f"❌ User list failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ User list error: {e}")
    
    # Test 4: Test single session enforcement
    print("\n4. Testing single session enforcement...")
    try:
        # Try to login again with same admin account
        response2 = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response2.status_code == 200:
            result2 = response2.json()
            new_token = result2["session_token"]
            new_headers = {"Authorization": f"Bearer {new_token}"}
            
            # Test if old token is invalidated
            old_response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
            new_response = requests.get(f"{BASE_URL}/api/auth/me", headers=new_headers)
            
            if old_response.status_code == 401 and new_response.status_code == 200:
                print("✅ Single session enforcement working!")
                print("   Old session invalidated, new session active")
            else:
                print("❌ Single session enforcement not working properly")
        else:
            print(f"❌ Second login failed with status {response2.status_code}")
    except Exception as e:
        print(f"❌ Single session test error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Admin system test completed!")
    print("\n📝 Default Admin Account:")
    print("   Email: admin@instudy.com")
    print("   Password: admin123")
    print("\n🚀 You can now access the Admin Panel in the frontend!")

if __name__ == "__main__":
    test_admin_system()