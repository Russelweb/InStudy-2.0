# Migration Guide: OpenAI → Local Models

## What Changed

InStudy 2.0 has been migrated from OpenAI to fully local models:

### Before (OpenAI)
- Embeddings: OpenAI text-embedding-ada-002
- LLM: GPT-4o Mini
- Cost: ~$0.001 per 1K tokens
- Speed: 1-2 seconds
- Requires: API key and internet

### After (Local)
- Embeddings: Sentence Transformers all-MiniLM-L6-v2
- LLM: Llama 3 via Ollama
- Cost: Free
- Speed: 3-6 seconds
- Requires: Ollama installation

---

## Breaking Changes

### 1. Environment Variables

**Removed:**
```env
OPENAI_API_KEY=sk-...
```

**Added:**
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### 2. Dependencies

**Removed:**
- `openai`
- `langchain-openai`

**Added:**
- `sentence-transformers`
- `docx2txt`

### 3. Configuration

**Old config.py:**
```python
OPENAI_API_KEY: str
CHUNK_SIZE: int = 1000
CHUNK_OVERLAP: int = 200
```

**New config.py:**
```python
OLLAMA_BASE_URL: str = "http://localhost:11434"
OLLAMA_MODEL: str = "llama3"
EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE: int = 500  # Optimized for speed
CHUNK_OVERLAP: int = 50
TOP_K_RETRIEVAL: int = 3  # Optimized for speed
LLM_TEMPERATURE: float = 0.2  # Optimized for speed
```

---

## Migration Steps

### Step 1: Install Ollama

**Windows:**
Download from https://ollama.ai/download

**Linux/Mac:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Step 2: Pull Llama 3

```bash
ollama pull llama3
```

### Step 3: Update Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will:
- Remove OpenAI packages
- Install sentence-transformers
- Install Ollama integration

### Step 4: Update Environment

```bash
cd backend
rm .env  # Remove old config
cp .env.example .env
```

No API key needed!

### Step 5: Restart Backend

```bash
cd backend
uvicorn main:app --reload
```

First startup takes ~30 seconds to load models.

### Step 6: Test

Upload a document and ask a question. Should work with local models!

---

## Code Changes Summary

### document_processor.py
```python
# Before
from langchain_openai import OpenAIEmbeddings
self.embeddings = OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)

# After
from models.global_models import get_embeddings
self.embeddings = get_embeddings()  # Loaded once globally
```

### rag_service.py
```python
# Before
from langchain_openai import ChatOpenAI
self.llm = ChatOpenAI(model="gpt-4o-mini", openai_api_key=settings.OPENAI_API_KEY)

# After
from models.global_models import get_llm
self.llm = get_llm()  # Loaded once globally
```

### All Services
- Removed OpenAI imports
- Use global model instances
- Added logging
- Better error handling
- Optimized for local inference

---

## Performance Comparison

### Document Processing
| Metric | OpenAI | Local |
|--------|--------|-------|
| Embedding time | 1-2s | 1-2s |
| Chunk size | 1000 | 500 |
| First upload | 3-5s | 5-10s |
| Subsequent | 2-3s | 2-4s |

### Question Answering
| Metric | OpenAI | Local |
|--------|--------|-------|
| Retrieval | 200ms | 200ms |
| Generation | 1-2s | 3-6s |
| Total | 1.5-2.5s | 3.5-6.5s |

### Quiz Generation
| Metric | OpenAI | Local |
|--------|--------|-------|
| 5 questions | 3-5s | 5-10s |
| 10 questions | 5-8s | 8-15s |

---

## Optimizations Applied

### 1. Global Model Loading
Models loaded once at startup, not per request:
```python
# models/global_models.py
_embeddings = None  # Loaded once
_llm = None  # Loaded once
```

### 2. Reduced Chunk Size
```python
CHUNK_SIZE: int = 500  # Was 1000
CHUNK_OVERLAP: int = 50  # Was 200
```
Faster embedding, still good quality.

### 3. Limited Retrieval
```python
TOP_K_RETRIEVAL: int = 3  # Was 4
```
Faster search, sufficient context.

### 4. Lower Temperature
```python
LLM_TEMPERATURE: float = 0.2  # Was 0.7
```
Faster generation, more focused responses.

### 5. FAISS Optimization
Already using FAISS (fastest local vector DB).

---

## Data Compatibility

### Existing Vector Stores
**⚠️ NOT COMPATIBLE**

Old vector stores used OpenAI embeddings (1536 dimensions).
New vector stores use Sentence Transformers (384 dimensions).

**Action Required:**
- Delete old vector stores: `rm -rf backend/vector_store/*`
- Re-upload documents

### Uploaded Documents
**✅ COMPATIBLE**

Original documents are preserved. Just re-process them.

---

## Rollback (If Needed)

If you need to go back to OpenAI:

### 1. Restore Old Code
```bash
git checkout <previous-commit>
```

### 2. Restore Dependencies
```bash
pip install openai langchain-openai
```

### 3. Restore .env
```env
OPENAI_API_KEY=sk-...
```

### 4. Delete New Vector Stores
```bash
rm -rf backend/vector_store/*
```

---

## FAQ

### Q: Can I use both OpenAI and local?
A: Not simultaneously. Choose one.

### Q: Is quality worse with local models?
A: Llama 3 quality is excellent, comparable to GPT-4o Mini for educational content.

### Q: Can I use GPU?
A: Yes! Ollama automatically uses GPU if available. Much faster.

### Q: What about costs?
A: Local is 100% free. No API costs ever.

### Q: Can I use different models?
A: Yes! Edit `OLLAMA_MODEL` and `EMBEDDING_MODEL` in .env

### Q: Does it work offline?
A: Yes, after initial model downloads.

---

## Troubleshooting

### Issue: "Connection refused" to Ollama
```bash
ollama serve
```

### Issue: Models not loading
Check logs:
```bash
tail -f backend/logs/app.log
```

### Issue: Out of memory
Reduce chunk size or close other apps.

### Issue: Slow responses
First request is always slower. Subsequent requests are faster.

---

## Support

**Ollama Issues:**
- https://ollama.ai/docs
- https://github.com/ollama/ollama

**Sentence Transformers:**
- https://www.sbert.net/

**InStudy Issues:**
- Check LOCAL_SETUP.md
- Check backend logs
- See TROUBLESHOOTING_QUICK.md

---

## Summary

✅ **Completed:**
- Removed OpenAI dependency
- Added Sentence Transformers embeddings
- Added Ollama/Llama 3 integration
- Optimized for local performance
- Updated all services
- Added comprehensive logging
- Created setup guides

✅ **Benefits:**
- No API costs
- Complete privacy
- No rate limits
- Offline capable
- Customizable

⚠️ **Trade-offs:**
- Slightly slower (3-6s vs 1-2s)
- Requires Ollama installation
- Needs more RAM
- Existing vector stores incompatible

---

**Migration Complete!** 🎉

InStudy 2.0 now runs 100% locally with no API dependencies.
