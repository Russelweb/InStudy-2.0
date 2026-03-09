@echo off
echo Starting InStudy 2.0...

REM Check if .env exists
if not exist backend\.env (
    echo Creating backend\.env from example...
    copy backend\.env.example backend\.env
    echo Please edit backend\.env and add your OPENAI_API_KEY
    pause
    exit
)

if not exist frontend\.env (
    echo Creating frontend\.env from example...
    copy frontend\.env.example frontend\.env
)

REM Start backend
echo Starting FastAPI backend...
start cmd /k "cd backend && uvicorn main:app --reload --port 8000"

REM Wait a bit
timeout /t 3 /nobreak

REM Start frontend
echo Starting Streamlit frontend...
start cmd /k "cd frontend && streamlit run app.py"

echo.
echo InStudy 2.0 is running!
echo Frontend: http://localhost:8501
echo Backend: http://localhost:8000
echo.
echo Close the command windows to stop the services
pause
