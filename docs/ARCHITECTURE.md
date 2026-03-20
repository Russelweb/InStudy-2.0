# InStudy 2.0 Architecture

## System Flow

```
User → Streamlit UI → FastAPI Backend → LangChain → OpenAI GPT-4o Mini
                            ↓
                    Document Processor
                            ↓
                    FAISS Vector Store
```

## Components

### 1. Document Processing Pipeline
- Upload → Extract Text → Chunk → Embed → Store in FAISS
- Supports: PDF, TXT, DOCX
- Metadata: user_id, course_id, document_name, page_number

### 2. Hybrid RAG System
- **Step 1:** Query vector database
- **Step 2:** Check similarity score
- **Case A (score < threshold):** Use retrieved context + question
- **Case B (score ≥ threshold):** Use general knowledge only

### 3. AI Services
- **RAG Service:** Question answering with context
- **Quiz Service:** Generate quizzes from materials
- **Flashcard Service:** Create flashcards
- **Summary Service:** Multiple summary styles
- **Planner Service:** Study schedule generation

### 4. Vector Database Structure
```
vector_store/
  {user_id}_{course_id}/
    index.faiss
    index.pkl
```

### 5. API Endpoints

#### Documents
- POST `/api/documents/upload` - Upload document
- GET `/api/documents/list/{user_id}/{course_id}` - List documents

#### Chat
- POST `/api/chat/ask` - Ask AI tutor

#### Quiz
- POST `/api/quiz/generate` - Generate quiz

#### Flashcards
- POST `/api/flashcards/generate` - Generate flashcards

#### Summary
- POST `/api/summary/generate` - Generate summary

#### Planner
- POST `/api/planner/create` - Create study plan

## Performance Optimizations

1. **Streaming Responses:** GPT-4o Mini streaming enabled
2. **Efficient Chunking:** 1000 chars with 200 overlap
3. **Caching:** Vector stores cached per user/course
4. **Async Operations:** FastAPI async endpoints

## Security

- Firebase Authentication (production)
- User-isolated vector stores
- File type validation
- CORS configuration

## Scalability

- Modular service architecture
- Separate vector stores per user/course
- Stateless API design
- Easy horizontal scaling
