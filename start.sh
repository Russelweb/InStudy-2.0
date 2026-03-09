#!/bin/bash

echo "🚀 Starting InStudy 2.0..."

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  Creating backend/.env from example..."
    cp backend/.env.example backend/.env
    echo "📝 Please edit backend/.env and add your OPENAI_API_KEY"
    exit 1
fi

if [ ! -f frontend/.env ]; then
    echo "⚠️  Creating frontend/.env from example..."
    cp frontend/.env.example frontend/.env
fi

# Start backend
echo "🔧 Starting FastAPI backend..."
cd backend
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting Streamlit frontend..."
cd frontend
streamlit run app.py &
FRONTEND_PID=$!
cd ..

echo "✅ InStudy 2.0 is running!"
echo "📱 Frontend: http://localhost:8501"
echo "🔌 Backend: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
