@echo off
setlocal enabledelayedexpansion

echo ===========================================
echo         InStudy 2.0 Unified Launcher
echo ===========================================
echo.
echo [1] Launch Cyber-Elite React (New High-Performance)
echo [2] Launch Classic Streamlit (Legacy Interface)
echo.
set /p choice="Select your terminal experience [1-2]: "

REM Check for Backend .env
if not exist backend\.env (
    echo [!] Creating backend\.env from example...
    copy backend\.env.example backend\.env
    echo [!] Please edit backend\.env and add your API keys.
    pause
    exit
)

REM Start Backend (Always required)
echo.
echo [*] Initializing Neural Backend on port 8000...
start "InStudy Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

REM Wait for backend to warm up
timeout /t 3 /nobreak > nul

if "%choice%"=="1" (
    echo [*] Launching Cyber-Elite React Dashboard...
    echo [*] Interface: http://localhost:5173
    cd frontend-v2
    if not exist node_modules (
        echo [!] First launch detected. Installing dependencies...
        call npm install
    )
    start "InStudy React UI" cmd /k "npm run dev"
) else if "%choice%"=="2" (
    echo [*] Launching Classic Streamlit Interface...
    echo [*] Interface: http://localhost:8501
    cd frontend
    start "InStudy Streamlit UI" cmd /k "streamlit run app.py"
) else (
    echo [!] Invalid selection. Booting aborted.
    pause
    exit
)

echo.
echo ===========================================
echo   InStudy 2.0 System Online
echo ===========================================
echo.
pause
