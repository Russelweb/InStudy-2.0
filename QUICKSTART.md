# InStudy 2.0 - Quick Start Guide

## Prerequisites

- Python 3.9 or higher
- Ollama installed ([Download](https://ollama.ai/download))
- 10GB free disk space (for models)

## Installation (5 minutes)

### Step 1: Install Ollama

**Windows:**
Download and install from: https://ollama.ai/download

**Linux/Mac:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Step 2: Pull Llama 3 Model
```bash
ollama pull llama3
```

This downloads ~4.7GB. Wait for completion.

### Step 3: Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

**Note:** First run downloads embedding model (~90MB)

### Step 4: Install Frontend Dependencies
```bash
cd frontend
pip install -r requirements.txt
```

### Step 5: Run the Application

**Option A: Using start script (Recommended)**

Linux/Mac:
```bash
chmod +x start.sh
./start.sh
```

Windows:
```bash
start.bat
```

**Option B: Manual start**

Terminal 1 (Backend):
```bash
cd backend
uvicorn main:app --reload
```

Terminal 2 (Frontend):
```bash
cd frontend
streamlit run app.py
```

### Step 6: Access the Application

Open your browser:
- Frontend: http://localhost:8501
- Backend API: http://localhost:8000

## First Steps

1. **Create a Course**
   - Click "Courses" in sidebar
   - Create "Machine Learning" course

2. **Upload a Document**
   - Go to "AI Tutor"
   - Upload a PDF or TXT file
   - Wait for processing

3. **Ask a Question**
   - Type: "What are the main topics in this document?"
   - Get AI response with sources

4. **Generate Flashcards**
   - Go to "Flashcards"
   - Click "Generate Flashcards"
   - Study with flip cards

5. **Take a Quiz**
   - Go to "Quiz"
   - Select 5 questions, Medium difficulty
   - Generate and take quiz

## Troubleshooting

### "Connection refused" to Ollama
```bash
# Check if Ollama is running
ollama list

# If not running, start it
ollama serve
```

### "Model not found: llama3"
```bash
ollama pull llama3
```

### Slow responses
- First request is always slower (model loading)
- Subsequent requests are faster (3-6 seconds)
- This is normal for local inference

### Out of memory
- Close other applications
- Ensure you have 8GB+ RAM
- Consider using smaller documents for testing

### Port already in use
```bash
# Backend on different port
uvicorn main:app --reload --port 8001

# Frontend on different port
streamlit run app.py --server.port 8502
```

### Upload fails
- Check file size (max 200MB)
- Verify file format (PDF, TXT, DOCX)
- Ensure backend is running

## Next Steps

- Read [USAGE.md](USAGE.md) for detailed feature guide
- Check [FEATURES.md](FEATURES.md) for complete feature list
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

## Support

For issues:
1. Check [LOCAL_SETUP.md](LOCAL_SETUP.md) for setup help
2. See [TROUBLESHOOTING_QUICK.md](TROUBLESHOOTING_QUICK.md)
3. Run `python backend/test_local_setup.py` to verify setup
4. Check backend logs for detailed errors
5. Ensure Ollama is running: `ollama list`

## System Requirements

- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 10GB for models + uploaded documents
- **Internet:** Required for initial setup only (downloads models)
- **Browser:** Chrome, Firefox, Safari, Edge (latest versions)
- **CPU:** 4+ cores recommended

## 🔥 Local Edition Benefits

- ✅ **No API Costs** - Everything runs locally
- ✅ **Complete Privacy** - Data never leaves your machine
- ✅ **No Rate Limits** - Use as much as you want
- ✅ **Offline Capable** - Works without internet (after setup)

See [README_LOCAL.md](README_LOCAL.md) for more details.
