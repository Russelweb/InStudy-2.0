# Deployment Guide

## Backend Deployment (Render)

1. Push code to GitHub
2. Go to Render.com and create new Web Service
3. Connect your GitHub repository
4. Use these settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Environment: Python 3.11
5. Add environment variables:
   - `OPENAI_API_KEY`
   - Firebase credentials (if using)
6. Deploy

## Frontend Deployment (Streamlit Cloud)

1. Push code to GitHub
2. Go to share.streamlit.io
3. Deploy from GitHub repository
4. Point to `frontend/app.py`
5. Add secrets in Streamlit dashboard:
   ```toml
   API_URL = "https://your-backend-url.onrender.com"
   ```

## Alternative: Vercel Frontend

1. Install Vercel CLI: `npm i -g vercel`
2. In frontend directory: `vercel`
3. Follow prompts
4. Set environment variable: `API_URL`

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with API_URL
streamlit run app.py
```

## Environment Variables

### Backend (.env)
```
OPENAI_API_KEY=sk-...
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

### Frontend (.env)
```
API_URL=http://localhost:8000
```
