# InStudy 2.0 - Local Edition 🚀

> AI-Powered Study Assistant - Now 100% Local!

InStudy 2.0 is an intelligent study assistant that runs completely on your machine. No API keys, no cloud services, complete privacy.

## ✨ What's New in Local Edition

- **🔒 100% Private** - All data stays on your machine
- **💰 Zero Cost** - No API fees ever
- **⚡ Fast** - Optimized for local inference
- **🌐 Offline** - Works without internet (after setup)
- **🎯 Customizable** - Swap models easily

## 🏗️ Architecture

```
Local Machine
├── Embeddings: Sentence Transformers (all-MiniLM-L6-v2)
├── LLM: Llama 3 via Ollama
├── Vector DB: FAISS
└── Backend: FastAPI + LangChain
```

## 📊 Performance

| Feature | Speed | Quality |
|---------|-------|---------|
| Document Upload | 2-4s | ✅ Excellent |
| Question Answering | 3-6s | ✅ Excellent |
| Quiz Generation | 5-10s | ✅ Excellent |
| Flashcard Generation | 4-8s | ✅ Excellent |

## 🚀 Quick Start

### 1. Install Ollama

**Windows:** Download from https://ollama.ai/download

**Linux/Mac:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Pull Llama 3

```bash
ollama pull llama3
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Start Backend

```bash
cd backend
uvicorn main:app --reload
```

**First startup takes ~30 seconds to load models.**

### 5. Start Frontend

```bash
cd frontend
streamlit run app.py
```

### 6. Use InStudy!

1. Open http://localhost:8501
2. Create a course
3. Upload documents
4. Ask questions, generate quizzes, flashcards!

## 📖 Features

### 🤖 AI Tutor
- Ask questions about your study materials
- Get structured, detailed answers
- Context-aware responses with sources
- ELI12 mode for simplified explanations

### 📝 Document Processing
- Upload PDF, TXT, DOCX files
- Automatic text extraction
- Intelligent chunking
- Fast vector search

### 🗂️ Flashcard Generator
- Auto-generate from your materials
- Interactive flip cards
- Perfect for memorization

### ❓ Quiz Generator
- Multiple choice, True/False, Short answer
- Three difficulty levels
- Automatic grading
- Detailed explanations

### 📊 Smart Summaries
- Four summary styles
- Document-specific or course-wide
- Export functionality

### 📅 Study Planner
- Personalized schedules
- Weekly breakdown
- Exam preparation tips

## 🔧 System Requirements

### Minimum
- CPU: 4 cores
- RAM: 8GB
- Storage: 10GB
- OS: Windows 10+, Linux, macOS

### Recommended
- CPU: 8 cores
- RAM: 16GB
- Storage: 20GB
- GPU: Optional (speeds up inference)

## 📚 Documentation

- **[LOCAL_SETUP.md](LOCAL_SETUP.md)** - Detailed setup guide
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migrating from OpenAI
- **[USAGE.md](USAGE.md)** - How to use features
- **[TROUBLESHOOTING_QUICK.md](TROUBLESHOOTING_QUICK.md)** - Common issues

## 🧪 Testing

Verify your setup:

```bash
cd backend
python test_local_setup.py
```

Should show all ✅ checks passing.

## 🎯 Optimizations

### Speed Optimizations
- ✅ Models loaded once at startup
- ✅ Reduced chunk size (500 chars)
- ✅ Limited retrieval (top 3)
- ✅ Lower temperature (0.2)
- ✅ FAISS for fast search

### Memory Optimizations
- ✅ Lightweight embedding model (~90MB)
- ✅ Efficient chunking
- ✅ Optimized batch processing

## 🔄 Model Information

### Embeddings: all-MiniLM-L6-v2
- **Size:** ~90MB
- **Dimensions:** 384
- **Speed:** Very fast
- **Quality:** Excellent for semantic search
- **Source:** sentence-transformers

### LLM: Llama 3
- **Size:** ~4.7GB
- **Parameters:** 8B
- **Speed:** 3-6 seconds per response
- **Quality:** Excellent for educational content
- **Source:** Meta via Ollama

## 🆚 Comparison: Local vs Cloud

| Feature | Local | OpenAI |
|---------|-------|--------|
| Cost | Free | ~$0.001/1K tokens |
| Speed | 3-6s | 1-2s |
| Privacy | 100% | Cloud-based |
| Setup | Requires Ollama | Just API key |
| Quality | Excellent | Excellent |
| Offline | Yes | No |
| Customizable | Yes | Limited |

## 🐛 Troubleshooting

### Ollama not running?
```bash
ollama serve
```

### Llama 3 not found?
```bash
ollama pull llama3
```

### Slow responses?
- First request is always slower (model loading)
- Subsequent requests are faster
- Consider using GPU if available

### Out of memory?
- Close other applications
- Reduce chunk size in config
- Use smaller documents

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- **Ollama** - Local LLM inference
- **Sentence Transformers** - Fast embeddings
- **LangChain** - RAG framework
- **FastAPI** - Modern Python backend
- **Streamlit** - Rapid UI development

## 📞 Support

**Setup Issues:** See [LOCAL_SETUP.md](LOCAL_SETUP.md)
**Ollama Help:** https://ollama.ai/docs
**General Issues:** See [TROUBLESHOOTING_QUICK.md](TROUBLESHOOTING_QUICK.md)

---

**InStudy 2.0 - Study Smarter, Locally!** 🎓✨

*No API keys. No costs. Complete privacy.*
