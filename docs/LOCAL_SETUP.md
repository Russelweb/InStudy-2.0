# InStudy 2.0 - Local Setup Guide

## Overview

InStudy 2.0 now runs completely locally with:
- **Embeddings**: Sentence Transformers (all-MiniLM-L6-v2) - ~90MB
- **LLM**: Llama 3 via Ollama
- **Vector DB**: FAISS (local)

No API keys required! Everything runs on your machine.

---

## Prerequisites

- Python 3.9+
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space
- Ollama installed

---

## Step 1: Install Ollama

### Windows
1. Download from: https://ollama.ai/download
2. Run the installer
3. Ollama will start automatically

### Linux/Mac
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Verify Installation
```bash
ollama --version
```

---

## Step 2: Pull Llama 3 Model

```bash
ollama pull llama3
```

This downloads ~4.7GB. Wait for it to complete.

### Verify Llama 3
```bash
ollama run llama3 "Hello, how are you?"
```

Should get a response. Press Ctrl+D to exit.

---

## Step 3: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `sentence-transformers` - For local embeddings
- `langchain-community` - For Ollama integration
- Other dependencies

**First run will download the embedding model (~90MB)**

---

## Step 4: Configure Environment

```bash
cd backend
cp .env.example .env
```

The default `.env` should work:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

---

## Step 5: Start the Backend

```bash
cd backend
uvicorn main:app --reload
```

**First startup takes ~30 seconds** to load models.

You should see:
```
✅ Models preloaded successfully!
✅ InStudy 2.0 API is ready!
```

---

## Step 6: Test the System

### Test 1: Health Check
```bash
curl http://localhost:8000/health
```

Expected:
```json
{
  "status": "healthy",
  "embeddings": "local",
  "llm": "local"
}
```

### Test 2: Upload Document
1. Start frontend: `streamlit run app.py` (in frontend folder)
2. Go to http://localhost:8501
3. Create a course
4. Upload `backend/test_ml.txt`
5. Should process successfully

### Test 3: Ask Question
1. In AI Tutor, ask: "What is machine learning?"
2. Should get a response (may take 3-6 seconds)

---

## Performance Expectations

### First Request (Cold Start)
- Document upload: 5-10 seconds
- First question: 5-8 seconds
- First quiz: 8-12 seconds

### Subsequent Requests (Warm)
- Document upload: 2-4 seconds
- Questions: 3-6 seconds
- Quiz generation: 5-10 seconds
- Flashcards: 4-8 seconds

### Optimizations Applied
✅ Models loaded once at startup
✅ Chunk size reduced to 500 (faster embedding)
✅ Top-K retrieval limited to 3 (faster search)
✅ Temperature set to 0.2 (faster generation)
✅ FAISS for fast vector search

---

## Troubleshooting

### Issue: "Connection refused" to Ollama

**Solution:**
```bash
# Check if Ollama is running
ollama list

# If not running, start it
ollama serve
```

### Issue: "Model not found: llama3"

**Solution:**
```bash
ollama pull llama3
```

### Issue: Slow responses

**Causes:**
- First request is always slower (model loading)
- Large documents take longer
- CPU-only inference is slower than GPU

**Solutions:**
- Wait for first request to complete
- Use smaller documents for testing
- Consider GPU if available

### Issue: Out of memory

**Solution:**
- Close other applications
- Use smaller chunk sizes
- Reduce number of retrieved documents

### Issue: Embedding model download fails

**Solution:**
```bash
# Manually download
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

---

## System Requirements

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

---

## Advantages of Local Setup

✅ **No API costs** - Everything runs locally
✅ **Privacy** - Your data never leaves your machine
✅ **No rate limits** - Use as much as you want
✅ **Offline capable** - Works without internet (after initial setup)
✅ **Customizable** - Can swap models easily

---

## Model Information

### Embeddings: all-MiniLM-L6-v2
- Size: ~90MB
- Dimensions: 384
- Speed: Very fast
- Quality: Good for semantic search
- Source: sentence-transformers

### LLM: Llama 3
- Size: ~4.7GB
- Parameters: 8B
- Speed: 3-6 seconds per response
- Quality: Excellent for educational content
- Source: Meta via Ollama

---

## Switching Models (Optional)

### Use Different Embedding Model
Edit `backend/.env`:
```env
EMBEDDING_MODEL=sentence-transformers/paraphrase-MiniLM-L6-v2
```

### Use Different LLM
```bash
# Pull different model
ollama pull mistral

# Edit backend/.env
OLLAMA_MODEL=mistral
```

---

## Comparison: Local vs OpenAI

| Feature | Local (New) | OpenAI (Old) |
|---------|-------------|--------------|
| Cost | Free | ~$0.001/1K tokens |
| Speed | 3-6s | 1-2s |
| Privacy | 100% local | Cloud-based |
| Setup | Requires Ollama | Just API key |
| Quality | Excellent | Excellent |
| Offline | Yes (after setup) | No |

---

## Next Steps

1. ✅ Ollama installed and running
2. ✅ Llama 3 model pulled
3. ✅ Python dependencies installed
4. ✅ Backend started successfully
5. ✅ Test document uploaded
6. ✅ Questions answered successfully

**You're ready to use InStudy 2.0 locally!** 🎉

---

## Getting Help

**Ollama not working?**
- Check: https://ollama.ai/docs

**Models not loading?**
- Check backend logs for errors
- Verify disk space
- Check RAM usage

**Still having issues?**
- See TROUBLESHOOTING_QUICK.md
- Check backend terminal for detailed errors

---

**InStudy 2.0 - Now 100% Local!** 🚀
