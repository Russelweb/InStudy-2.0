#!/usr/bin/env python3
"""
Test script for authentication system.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_auth_system():
    """Test the complete authentication flow"""
    print("🧪 Testing InStudy 2.0 Authentication System")
    print("=" * 50)
    
    # Test 1: Register new user
    print("\n1. Testing user registration...")
    register_data = {
        "email": "test@example.com",
        "password": "testpass123",
        "confirm_password": "testpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                print("✅ Registration successful!")
                token = result["session_token"]
                user_id = result["user_id"]
                print(f"   User ID: {user_id}")
                print(f"   Token: {token[:20]}...")
            else:
                print(f"❌ Registration failed: {result['error_message']}")
                return
        else:
            print(f"❌ Registration failed with status {response.status_code}")
            print(f"   Error: {response.text}")
            return
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return
    
    # Test 2: Login with same credentials
    print("\n2. Testing user login...")
    login_data = {
        "email": "test@example.com",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                print("✅ Login successful!")
                login_token = result["session_token"]
                print(f"   New Token: {login_token[:20]}...")
            else:
                print(f"❌ Login failed: {result['error_message']}")
                return
        else:
            print(f"❌ Login failed with status {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Test 3: Access protected endpoint
    print("\n3. Testing protected endpoint access...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/stats/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print("✅ Protected endpoint access successful!")
            print(f"   Stats: {stats}")
        else:
            print(f"❌ Protected endpoint failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Protected endpoint error: {e}")
    
    # Test 4: Get user info
    print("\n4. Testing user info endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if response.status_code == 200:
            user_info = response.json()
            print("✅ User info retrieved successfully!")
            print(f"   User: {user_info}")
        else:
            print(f"❌ User info failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ User info error: {e}")
    
    # Test 5: Logout
    print("\n5. Testing logout...")
    try:
        response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        if response.status_code == 200:
            print("✅ Logout successful!")
        else:
            print(f"❌ Logout failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Logout error: {e}")
    
    # Test 6: Try accessing protected endpoint after logout
    print("\n6. Testing access after logout...")
    try:
        response = requests.get(f"{BASE_URL}/api/stats/stats", headers=headers)
        if response.status_code == 401:
            print("✅ Access properly denied after logout!")
        else:
            print(f"❌ Unexpected status after logout: {response.status_code}")
    except Exception as e:
        print(f"❌ Post-logout test error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Authentication system test completed!")

if __name__ == "__main__":
    test_auth_system()