#!/usr/bin/env python3
"""Test backend connectivity"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000")

print(f"Testing backend at: {API_URL}")
print("=" * 50)

# Test 1: Health check
print("\n1. Testing health endpoint...")
try:
    response = requests.get(f"{API_URL}/health", timeout=5)
    if response.status_code == 200:
        print(f"✅ Backend is running: {response.json()}")
    else:
        print(f"❌ Backend returned status {response.status_code}")
except requests.exceptions.ConnectionError:
    print(f"❌ Cannot connect to backend at {API_URL}")
    print("   Make sure the backend is running with: uvicorn main:app --reload")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Root endpoint
print("\n2. Testing root endpoint...")
try:
    response = requests.get(f"{API_URL}/", timeout=5)
    if response.status_code == 200:
        print(f"✅ Root endpoint: {response.json()}")
    else:
        print(f"❌ Root returned status {response.status_code}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: API docs
print("\n3. Testing API docs...")
try:
    response = requests.get(f"{API_URL}/docs", timeout=5)
    if response.status_code == 200:
        print(f"✅ API docs available at {API_URL}/docs")
    else:
        print(f"❌ API docs returned status {response.status_code}")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 50)
print("Testing complete!")
print(f"\nIf all tests passed, the backend is working correctly.")
print(f"If tests failed, check that the backend is running:")
print(f"  cd backend")
print(f"  uvicorn main:app --reload")
