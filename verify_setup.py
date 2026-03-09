#!/usr/bin/env python3
"""Verify InStudy 2.0 setup and dependencies"""

import sys
import os
from pathlib import Path

def check_python_version():
    """Check Python version"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 9:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor} (requires 3.9+)")
        return False

def check_dependencies():
    """Check if required packages are installed"""
    backend_deps = [
        "fastapi", "uvicorn", "langchain", "langchain_community",
        "faiss", "pypdf", "docx", "sentence_transformers", "pydantic"
    ]
    
    frontend_deps = [
        "streamlit", "requests", "plotly", "pandas"
    ]
    
    print("\n📦 Checking Backend Dependencies:")
    for dep in backend_deps:
        try:
            __import__(dep)
            print(f"  ✅ {dep}")
        except ImportError:
            print(f"  ❌ {dep} (run: pip install -r backend/requirements.txt)")
    
    print("\n📦 Checking Frontend Dependencies:")
    for dep in frontend_deps:
        try:
            __import__(dep)
            print(f"  ✅ {dep}")
        except ImportError:
            print(f"  ❌ {dep} (run: pip install -r frontend/requirements.txt)")

def check_env_files():
    """Check if .env files exist"""
    print("\n🔐 Checking Environment Files:")
    
    backend_env = Path("backend/.env")
    if backend_env.exists():
        print("  ✅ backend/.env exists")
        # Check for Ollama configuration
        with open(backend_env) as f:
            content = f.read()
            if "OLLAMA_BASE_URL" in content:
                print("  ✅ Ollama configuration found")
            else:
                print("  ⚠️  Ollama configuration not found (will use defaults)")
    else:
        print("  ⚠️  backend/.env missing (will use defaults)")
    
    frontend_env = Path("frontend/.env")
    if frontend_env.exists():
        print("  ✅ frontend/.env exists")
    else:
        print("  ⚠️  frontend/.env missing (optional)")

def check_directories():
    """Check if required directories exist"""
    print("\n📁 Checking Directory Structure:")
    
    required = [
        "backend/api/routes",
        "backend/services",
        "backend/models",
        "frontend/pages",
        "frontend/.streamlit"
    ]
    
    for dir_path in required:
        if Path(dir_path).exists():
            print(f"  ✅ {dir_path}")
        else:
            print(f"  ❌ {dir_path}")

def check_ollama():
    """Check if Ollama is installed and running"""
    print("\n🤖 Checking Ollama:")
    
    try:
        import requests
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            print(f"  ✅ Ollama is running")
            
            if any("llama3" in name for name in model_names):
                print(f"  ✅ Llama 3 is installed")
            else:
                print(f"  ⚠️  Llama 3 not found. Run: ollama pull llama3")
        else:
            print(f"  ❌ Ollama returned status {response.status_code}")
    except Exception as e:
        print(f"  ❌ Cannot connect to Ollama")
        print(f"     Install from: https://ollama.ai/download")
        print(f"     Then run: ollama pull llama3")

def main():
    print("🔍 InStudy 2.0 Setup Verification\n")
    print("=" * 50)
    
    check_python_version()
    check_ollama()
    check_dependencies()
    check_env_files()
    check_directories()
    
    print("\n" + "=" * 50)
    print("\n📚 Next Steps:")
    print("1. Install Ollama: https://ollama.ai/download")
    print("2. Pull Llama 3: ollama pull llama3")
    print("3. Install dependencies: pip install -r backend/requirements.txt")
    print("4. Run: start.bat (Windows) or ./start.sh (Linux/Mac)")
    print("5. Access: http://localhost:8501")
    print("\n✨ Happy studying!")

if __name__ == "__main__":
    main()
