# Complete Setup Guide - InStudy 2.0

## 🎯 What You're Building

A full-stack AI study assistant with:
- FastAPI backend with RAG system
- Streamlit frontend
- OpenAI GPT-4o Mini integration
- FAISS vector database
- Document processing pipeline

## 📋 Prerequisites Checklist

- [ ] Python 3.9 or higher installed
- [ ] pip package manager
- [ ] OpenAI API account
- [ ] 2GB free disk space
- [ ] Internet connection

## 🚀 Installation Steps

### Step 1: Verify Python Installation

```bash
python --version
# Should show Python 3.9.x or higher
```

If not installed, download from: https://www.python.org/downloads/

### Step 2: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Keep it safe - you'll need it in Step 5

### Step 3: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- LangChain (RAG framework)
- FAISS (vector database)
- OpenAI (LLM API)
- PyPDF (PDF processing)
- And more...

**Expected time:** 2-3 minutes

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
pip install -r requirements.txt
```

This installs:
- Streamlit (UI framework)
- Plotly (charts)
- Requests (API calls)

**Expected time:** 1-2 minutes

### Step 5: Configure Environment Variables

**Backend configuration:**
```bash
cd ../backend
cp .env.example .env
```

Edit `backend/.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=sk-your-actual-key-here
```

**Frontend configuration (optional):**
```bash
cd ../frontend
cp .env.example .env
```

The default `API_URL=http://localhost:8000` works for local development.

### Step 6: Verify Setup

```bash
cd ..
python verify_setup.py
```

This checks:
- Python version
- Installed dependencies
- Environment files
- Directory structure

Fix any issues before proceeding.

### Step 7: Start the Application

**Option A: Automated (Recommended)**

Windows:
```bash
start.bat
```

Linux/Mac:
```bash
chmod +x start.sh
./start.sh
```

**Option B: Manual**

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

### Step 8: Access the Application

Open your browser:
- **Frontend:** http://localhost:8501
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## ✅ First-Time Usage

### 1. Create Your First Course

1. Click "Courses" in sidebar
2. Expand "Create New Course"
3. Enter: "Machine Learning"
4. Click "Create Course"

### 2. Upload a Test Document

1. Click "AI Tutor"
2. Expand "Upload Study Material"
3. Upload `backend/test_ml.txt` (provided sample)
4. Click "Process Document"
5. Wait for success message

### 3. Ask Your First Question

1. In the chat input, type: "What is machine learning?"
2. Press Enter
3. See AI response with sources
4. Try: "Explain gradient descent"

### 4. Generate Flashcards

1. Click "Flashcards" in sidebar
2. Set slider to 10 cards
3. Click "Generate Flashcards"
4. Use flip and navigation buttons

### 5. Take a Quiz

1. Click "Quiz" in sidebar
2. Select: 5 questions, Medium, Mixed
3. Click "Generate Quiz"
4. Answer questions
5. Submit for score

### 6. Create a Study Plan

1. Click "Study Planner"
2. Enter course: "Machine Learning"
3. Set exam date (2 weeks from now)
4. Topics: "Neural Networks, Gradient Descent"
5. Generate plan

## 🔧 Troubleshooting

### Issue: "Module not found" error

**Solution:**
```bash
# Reinstall dependencies
cd backend
pip install -r requirements.txt

cd ../frontend
pip install -r requirements.txt
```

### Issue: "OPENAI_API_KEY not found"

**Solution:**
1. Check `backend/.env` exists
2. Verify key format: `OPENAI_API_KEY=sk-...`
3. No quotes needed around the key
4. Restart backend server

### Issue: Port 8000 already in use

**Solution:**
```bash
# Find and kill process
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn main:app --reload --port 8001
```

### Issue: Port 8501 already in use

**Solution:**
```bash
streamlit run app.py --server.port 8502
```

### Issue: Upload fails

**Checks:**
- Backend is running (check http://localhost:8000/health)
- File is PDF, TXT, or DOCX
- File size < 200MB
- Sufficient disk space

### Issue: Slow responses

**Causes:**
- First query loads vector store (slower)
- Large documents take longer
- OpenAI API latency
- Internet connection

**Solutions:**
- Wait for first query to complete
- Use smaller documents for testing
- Check OpenAI API status

### Issue: Poor quiz/flashcard quality

**Solutions:**
- Upload more comprehensive materials
- Use well-formatted documents
- Try different difficulty levels
- Upload multiple documents on same topic

## 🎓 Best Practices

### Document Upload
✅ DO:
- Upload organized lecture notes
- Use descriptive filenames
- Upload one topic per document
- Ensure text is readable (not scanned images)

❌ DON'T:
- Upload unrelated documents to same course
- Use very large files (>50MB)
- Upload image-only PDFs

### Asking Questions
✅ DO:
- Be specific: "Explain backpropagation in neural networks"
- Reference your materials
- Ask follow-up questions
- Use ELI12 for complex topics

❌ DON'T:
- Ask vague questions: "Tell me about ML"
- Expect answers on topics not in your materials (unless using general knowledge)

### Study Strategy
1. **Week 1:** Upload all materials, generate summaries
2. **Week 2-3:** Deep learning with AI Tutor
3. **Week 4:** Flashcards and quizzes
4. **Week 5:** Practice tests and revision

## 🌐 Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Render backend deployment
- Streamlit Cloud frontend deployment
- Environment variable configuration
- Domain setup
- SSL certificates

## 📚 Additional Resources

- [USAGE.md](USAGE.md) - Detailed feature guide
- [API_REFERENCE.md](API_REFERENCE.md) - API documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [FEATURES.md](FEATURES.md) - Complete feature list
- [TODO.md](TODO.md) - Future enhancements

## 🎉 You're Ready!

Your InStudy 2.0 installation is complete. Start uploading your study materials and experience AI-powered learning!

**Quick Commands:**
```bash
# Start everything
start.bat  # Windows
./start.sh # Linux/Mac

# Backend only
cd backend && uvicorn main:app --reload

# Frontend only
cd frontend && streamlit run app.py

# Verify setup
python verify_setup.py
```

Happy studying! 📚✨
