# InStudy 2.0 - AI-Powered Study Assistant 📚

> An intelligent AI tutor that helps university students study using their own materials

**🔥 Now 100% Local!** No API keys, no costs, complete privacy. See [README_LOCAL.md](README_LOCAL.md)

InStudy 2.0 is a production-ready AI study assistant that acts as a personal tutor for university students. Upload your lecture notes, PDFs, and study materials, then get instant answers, generate quizzes, create flashcards, and build personalized study plans.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-1.30-red.svg)

## 🆕 Local Edition Highlights

- ✅ **No API Keys** - Everything runs on your machine
- ✅ **Zero Cost** - No usage fees ever
- ✅ **Complete Privacy** - Your data never leaves your computer
- ✅ **Offline Capable** - Works without internet (after setup)
- ✅ **Fast & Optimized** - 3-6 second responses

## 🎯 New Here? Start Here!

**👉 [START_HERE.md](START_HERE.md)** - Your complete getting started guide

**Quick Links:**
- ⚡ [3-Step Setup](GET_STARTED.md) - Run in 4 minutes
- 📖 [Documentation Index](INDEX.md) - Find anything
- ✅ [Project Status](STATUS.md) - See what's complete
- 🎓 [Feature Showcase](FEATURE_SHOWCASE.md) - See features in action
- 📋 [Final Summary](FINAL_SUMMARY.md) - Complete project overview

## ✨ Key Features

### 🤖 AI Tutor with Hybrid RAG
- Context-aware question answering using your study materials
- Fallback to general knowledge when needed
- Source attribution for transparency
- "Explain Like I'm 12" mode for complex topics

### 📝 Smart Document Processing
- Upload PDF, TXT, DOCX files
- Automatic text extraction and chunking
- FAISS vector database for fast retrieval
- Course-based organization

### 🗂️ Flashcard Generator
- Auto-generate flashcards from your materials
- Interactive flip cards
- Shuffle and navigation
- Perfect for memorization

### ❓ Quiz Generator
- Multiple question types (MCQ, True/False, Short Answer)
- Adjustable difficulty (Easy, Medium, Hard)
- Automatic grading
- Detailed explanations

### 📊 Smart Summaries
- Multiple styles: Short, Bullet Points, Detailed, Exam Revision
- Document-specific or course-wide
- Export to TXT

### 📅 Study Planner
- Personalized study schedules
- Weekly breakdown with daily tasks
- Revision strategies
- Exam preparation tips

### 📈 Dashboard
- Study statistics and progress tracking
- Recent activity
- Visual analytics

## 🚀 Quick Start

**[⚡ Get Started in 3 Steps](GET_STARTED.md)** - Fastest way to run InStudy 2.0

**🔥 Now 100% Local!** No API keys needed. See [README_LOCAL.md](README_LOCAL.md) for local edition details.

### Prerequisites
- Python 3.9+
- Ollama installed ([Download here](https://ollama.ai/download))

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd instudy
```

2. **Install dependencies**
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
pip install -r requirements.txt
```

3. **Install and configure Ollama**
```bash
# Install Ollama from https://ollama.ai/download
# Then pull Llama 3
ollama pull llama3
```

4. **Run the application**

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

5. **Access the app**
- Frontend: http://localhost:8501
- Backend API: http://localhost:8000

## 📖 Documentation

**[📑 Master Index](MASTER_INDEX.md)** - Complete file reference (75 files)
**[📑 Documentation Index](INDEX.md)** - Navigate all documentation (29 guides)

### Quick Links
- [Quick Start Guide](QUICKSTART.md) - Get up and running in 5 minutes
- [Usage Guide](USAGE.md) - Detailed feature walkthrough
- [Architecture](ARCHITECTURE.md) - System design and technical details
- [Deployment Guide](DEPLOYMENT.md) - Deploy to production
- [Features List](FEATURES.md) - Complete feature documentation
- [API Reference](API_REFERENCE.md) - Complete API documentation
- [System Diagrams](SYSTEM_DIAGRAM.md) - Visual architecture diagrams

## 🏗️ Tech Stack

**Backend:**
- FastAPI - Modern Python web framework
- LangChain - LLM orchestration
- FAISS - Vector database
- Llama 3 via Ollama - Local language model
- Sentence Transformers - Local embeddings
- PyPDF, python-docx - Document processing

**Frontend:**
- Streamlit - Rapid UI development
- Plotly - Data visualization
- streamlit-option-menu - Navigation

**Infrastructure:**
- Render - Backend hosting (optional)
- Streamlit Cloud - Frontend hosting (optional)
- Firebase - Authentication (optional)

## 📁 Project Structure

```
instudy/
├── backend/
│   ├── api/
│   │   └── routes/          # API endpoints
│   ├── services/            # Business logic
│   │   ├── rag_service.py   # Hybrid RAG system
│   │   ├── quiz_service.py
│   │   ├── flashcard_service.py
│   │   └── ...
│   ├── models/              # Data schemas
│   ├── main.py              # FastAPI app
│   └── config.py            # Configuration
├── frontend/
│   ├── pages/               # Streamlit pages
│   │   ├── ai_tutor.py
│   │   ├── quiz.py
│   │   ├── flashcards.py
│   │   └── ...
│   └── app.py               # Main Streamlit app
├── vector_store/            # FAISS indices (generated)
├── uploads/                 # User documents (generated)
└── docs/                    # Documentation
```

## 🎯 How It Works

### Hybrid RAG System

1. **Document Upload** → Text extraction → Chunking → Embedding generation
2. **Question Asked** → Vector similarity search
3. **Decision Point:**
   - **High similarity:** Answer using document context + LLM
   - **Low similarity:** Answer using LLM general knowledge
4. **Response** → Structured explanation with sources

### AI Tutor Response Structure

Every explanation includes:
1. Concept Definition
2. Step-by-step Explanation
3. Example
4. Possible Exam Question
5. Quick Summary

## 🔧 Configuration

### Backend (.env)
```env
# Ollama Configuration (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Embedding Model (Local)
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Optional Firebase
FIREBASE_PROJECT_ID=your_project_id
```

### Frontend (.env)
```env
API_URL=http://localhost:8000
```

See [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed configuration.

## 🚢 Deployment

### Backend (Render)
1. Push to GitHub
2. Connect to Render
3. Add `OPENAI_API_KEY` environment variable
4. Deploy

### Frontend (Streamlit Cloud)
1. Push to GitHub
2. Deploy from share.streamlit.io
3. Add `API_URL` in secrets

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 🤝 Contributing

Contributions are welcome! Please check [TODO.md](TODO.md) for planned features.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Ollama for local LLM inference
- Sentence Transformers for fast embeddings
- Meta for Llama 3
- LangChain for RAG framework
- Streamlit for rapid UI development
- FastAPI for modern Python backend

## 📞 Support

**Documentation:** 27 comprehensive guides covering every aspect
**Setup Help:** [SETUP_GUIDE.md](SETUP_GUIDE.md) troubleshooting section
**Navigation:** [INDEX.md](INDEX.md) - Find any document instantly
**Status:** [COMPLETION_REPORT.md](COMPLETION_REPORT.md) - Full project report

For issues and questions:
1. Check [USAGE.md](USAGE.md) troubleshooting section
2. Review [QUICKSTART.md](QUICKSTART.md)
3. Run `python verify_setup.py`
4. Check [NAVIGATION.md](NAVIGATION.md) to find relevant docs

---

Built with ❤️ for students who want to study smarter, not harder.
