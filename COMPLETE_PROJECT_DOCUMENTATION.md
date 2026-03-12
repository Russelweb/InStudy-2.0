# InStudy 2.0 - Complete Technical Documentation & Code Analysis

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack Analysis](#technology-stack-analysis)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Database Design](#database-design)
6. [Authentication System](#authentication-system)
7. [Admin System](#admin-system)
8. [AI/ML Integration](#aiml-integration)
9. [File-by-File Analysis](#file-by-file-analysis)
10. [API Documentation](#api-documentation)
11. [Security Implementation](#security-implementation)
12. [Performance Optimizations](#performance-optimizations)

---

## Project Overview

InStudy 2.0 is a comprehensive AI-powered study assistant application built with a modern full-stack architecture. The system combines document processing, natural language processing, and machine learning to provide personalized learning experiences.

### Core Features
- **AI Tutor**: RAG-based question answering system using local LLM
- **Document Processing**: PDF, DOCX, TXT file processing and vectorization
- **Interactive Learning**: Auto-generated flashcards, quizzes, summaries
- **Study Planning**: Personalized study schedules and progress tracking
- **User Management**: Complete authentication system with admin capabilities
- **Analytics**: Study progress tracking with beautiful visualizations

### Architecture Pattern
- **Backend**: RESTful API using FastAPI (Python)
- **Frontend**: Interactive web app using Streamlit
- **Database**: SQLite for user data, FAISS for vector storage
- **AI/ML**: Local models (Llama 3 + Sentence Transformers)
- **Authentication**: Session-based with PBKDF2 password hashing

---

## Technology Stack Analysis

### Backend Technologies

#### 1. FastAPI Framework
**Files**: `backend/main.py`, all route files
**Purpose**: Modern, fast web framework for building APIs

```python
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
app = FastAPI(title="InStudy 2.0 API", version="2.0.0")
```

**Why FastAPI?**
- **Performance**: Built on Starlette and Pydantic, extremely fast (comparable to NodeJS/Go)
- **Type Safety**: Automatic request/response validation using Python type hints
- **Documentation**: Auto-generated OpenAPI/Swagger docs at `/docs`
- **Async Support**: Native async/await support for concurrent operations
- **Dependency Injection**: Clean dependency management system

**How it affects the project**:
- Provides robust API endpoints for all frontend operations
- Automatic validation prevents invalid data from entering the system
- Built-in documentation makes API testing and development easier
- High performance handles multiple concurrent users efficiently
- Type hints make code self-documenting and catch errors early

#### 2. Pydantic Models
**Files**: `backend/models/auth_models.py`, `backend/models/schemas.py`
**Purpose**: Data validation and serialization

```python
class User(BaseModel):
    id: int
    email: str
    is_admin: bool = False
    created_at: Optional[datetime] = None
    
    @validator('email')
    def validate_email(cls, v):
        # Email validation logic
        return v
```

**Key Features**:
- **Type Validation**: Ensures data integrity at API boundaries
- **Serialization**: Converts Python objects to JSON automatically
- **Custom Validators**: Business logic validation (email format, password strength)
- **Documentation**: Models serve as API documentation
- **Error Handling**: Clear validation error messages with field-specific details

**Impact on Project**:
- Prevents data corruption by validating all inputs before processing
- Provides consistent data structures across the entire application
- Reduces debugging time with clear, specific error messages
- Enables automatic API documentation generation
- Makes refactoring safer with compile-time type checking

#### 3. SQLite Database
**Files**: `backend/database/auth_db.py`
**Purpose**: Lightweight, serverless database for user data

```python
import sqlite3
from pathlib import Path

class AuthDatabase:
    def __init__(self, db_path: str = "backend/users.db"):
        self.db_path = Path(db_path)
        self.init_database()
```

**Why SQLite?**
- **Simplicity**: No separate database server required
- **Portability**: Single file database, easy to backup/move
- **Performance**: Fast for read-heavy workloads (perfect for study app)
- **ACID Compliance**: Reliable transactions ensure data consistency
- **Zero Configuration**: Works out of the box, no setup required

**How it's used**:
- Stores user accounts, passwords, and session tokens
- Handles authentication and authorization data
- Provides ACID transactions for data consistency
- Enables complex queries with JOINs for user management

#### 4. FAISS Vector Database
**Files**: `backend/services/document_processor.py`, `backend/services/rag_service.py`
**Purpose**: High-performance similarity search for document retrieval

```python
import faiss
from langchain.vectorstores import FAISS

# Create vector store from documents
vector_store = FAISS.from_documents(chunks, embeddings)
vector_store.save_local(vector_store_path)
```

**Why FAISS?**
- **Performance**: Optimized for fast similarity search on large datasets
- **Memory Efficient**: Compressed vector storage
- **Scalability**: Handles millions of vectors efficiently
- **Local Storage**: No external dependencies, works offline

**Role in Project**:
- Stores document embeddings for semantic search
- Enables fast retrieval of relevant document chunks
- Powers the RAG (Retrieval-Augmented Generation) system
- Provides context for AI tutor responses

### Frontend Technologies

#### 1. Streamlit Framework
**Files**: `frontend/app.py`, all page files
**Purpose**: Rapid development of interactive web applications

```python
import streamlit as st
from streamlit_option_menu import option_menu

st.set_page_config(
    page_title="InStudy 2.0",
    page_icon="📚",
    layout="wide"
)
```

**Why Streamlit?**
- **Rapid Development**: Build web apps with pure Python
- **Interactive Components**: Built-in widgets for user interaction
- **Real-time Updates**: Automatic re-rendering on state changes
- **Data Visualization**: Native support for charts and plots
- **Session State**: Built-in state management

**Project Benefits**:
- Enables quick prototyping and iteration
- No need for separate HTML/CSS/JavaScript
- Built-in components for file uploads, forms, charts
- Easy integration with Python ML libraries
- Automatic responsive design

#### 2. Plotly for Visualizations
**Files**: `frontend/pages/dashboard.py`
**Purpose**: Interactive charts and data visualizations

```python
import plotly.graph_objects as go
import plotly.express as px

fig = go.Figure()
fig.add_trace(go.Bar(x=dates, y=study_hours, name='Daily Study Hours'))
st.plotly_chart(fig, use_container_width=True)
```

**Features Used**:
- **Bar Charts**: Study hours over time
- **Line Charts**: Progress tracking
- **Heatmaps**: Activity patterns
- **Radar Charts**: Performance metrics
- **Pie Charts**: Course distribution

**Why Plotly?**
- **Interactivity**: Hover effects, zoom, pan
- **Professional Look**: Publication-quality charts
- **Responsive**: Adapts to container size
- **Customizable**: Full control over styling

### AI/ML Technologies

#### 1. Sentence Transformers
**Files**: `backend/models/global_models.py`, `backend/services/document_processor.py`
**Purpose**: Convert text to numerical embeddings for similarity search

```python
from sentence_transformers import SentenceTransformer

# Load model once at startup
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Convert text to embeddings
embeddings = embedding_model.encode(texts)
```

**Model Details**:
- **Model**: `all-MiniLM-L6-v2` (90MB, fast inference)
- **Dimensions**: 384-dimensional embeddings
- **Performance**: ~14,000 sentences/second on CPU
- **Quality**: Good balance of speed and accuracy

**Role in Project**:
- Converts document chunks to embeddings for storage in FAISS
- Enables semantic search (finds meaning, not just keywords)
- Powers document similarity and retrieval
- Lightweight enough to run locally without GPU

#### 2. Ollama + Llama 3
**Files**: `backend/services/rag_service.py`, `backend/config.py`
**Purpose**: Local large language model for text generation

```python
import requests

def query_ollama(prompt: str, model: str = "llama3") -> str:
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }
    )
    return response.json()["response"]
```

**Why Local LLM?**
- **Privacy**: No data sent to external APIs
- **Cost**: No per-token charges
- **Speed**: No network latency
- **Reliability**: Works offline
- **Control**: Full control over model behavior

**Integration Details**:
- **Ollama**: Serves Llama 3 model locally on port 11434
- **Temperature**: Set to 0.2 for consistent, focused responses
- **Context Window**: Handles long document contexts
- **Streaming**: Supports real-time response streaming

#### 3. LangChain Integration
**Files**: `backend/services/document_processor.py`
**Purpose**: Document processing and text splitting

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import PyPDFLoader, Docx2txtLoader

# Split documents into chunks
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", " ", ""]
)
chunks = text_splitter.split_documents(documents)
```

**Components Used**:
- **Document Loaders**: PDF, DOCX, TXT file processing
- **Text Splitters**: Intelligent document chunking
- **Vector Stores**: Integration with FAISS
- **Retrievers**: Document similarity search

**Benefits**:
- **Standardized**: Common interface for different document types
- **Optimized**: Smart chunking preserves context
- **Extensible**: Easy to add new document types
- **Integration**: Works seamlessly with vector databases

---

*This is the beginning of the comprehensive documentation. Let me continue with more sections...*

## Backend Architecture - File-by-File Analysis

### Core Application Files

#### 1. main.py - Application Entry Point
**Location**: `backend/main.py`
**Purpose**: FastAPI application initialization and configuration

```python
# Application Setup
app = FastAPI(title="InStudy 2.0 API", version="2.0.0")
```
- Creates the main FastAPI application instance
- Sets title and version for API documentation
- This is the central hub that coordinates all backend functionality

```python
# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
**Purpose**: Enables cross-origin requests from frontend
**Security**: Allows Streamlit frontend (port 8501) to communicate with API (port 8000)
**Development**: "*" allows all origins (should be restricted in production)

```python
# Authentication Middleware
app.add_middleware(AuthMiddleware)
```
**Custom middleware** that protects API endpoints
**Automatic**: Checks authentication on every request
**User Context**: Injects user information into request state

```python
# Model Preloading
@app.on_event("startup")
async def startup_event():
    preload_models()
```
**Performance Optimization**: Loads AI models at startup
**User Experience**: Eliminates first-request delay
**Memory Management**: Models loaded once, shared across requests

#### 2. config.py - Configuration Management
**Location**: `backend/config.py`
**Purpose**: Centralized configuration using Pydantic Settings

```python
class Settings(BaseSettings):
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # RAG Configuration
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    TOP_K_RETRIEVAL: int = 3
    SIMILARITY_THRESHOLD: float = 0.7
    LLM_TEMPERATURE: float = 0.2
```

**Configuration Categories**:

1. **AI/ML Settings**:
   - `OLLAMA_BASE_URL`: Local LLM server endpoint
   - `OLLAMA_MODEL`: Specific model name (Llama 3)
   - `EMBEDDING_MODEL`: Sentence transformer model for vectorization

2. **Storage Settings**:
   - `UPLOAD_DIR`: User file storage location (`uploads/`)
   - `VECTOR_STORE_DIR`: FAISS index storage location (`vector_store/`)

3. **RAG Parameters**:
   - `CHUNK_SIZE: 500`: Document chunk size for processing (optimized for speed)
   - `CHUNK_OVERLAP: 50`: Overlap between chunks for context preservation
   - `TOP_K_RETRIEVAL: 3`: Number of relevant chunks to retrieve per query
   - `SIMILARITY_THRESHOLD: 0.7`: Minimum similarity score for relevance
   - `LLM_TEMPERATURE: 0.2`: Low temperature for consistent, focused responses

**Impact on Project**:
- **Flexibility**: Easy to modify settings without code changes
- **Environment Support**: Different configs for dev/prod using .env files
- **Type Safety**: Pydantic validates configuration values at startup
- **Documentation**: Self-documenting configuration structure

### Database Layer

#### 1. auth_db.py - Authentication Database
**Location**: `backend/database/auth_db.py`
**Purpose**: All database operations for user management and sessions

```python
class AuthDatabase:
    def __init__(self, db_path: str = "backend/users.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
```

**Database Schema**:
```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
)

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
)
```

**Key Methods Analysis**:

1. **Password Security**:
```python
def _hash_password(self, password: str) -> str:
    salt = secrets.token_hex(16)  # 16 bytes = 32 hex chars
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return salt + password_hash.hex()  # 96 total characters
```
- **Salt**: Random 16-byte salt prevents rainbow table attacks
- **PBKDF2**: Industry-standard key derivation function
- **SHA-256**: Cryptographically secure hash algorithm
- **100,000 iterations**: Slows down brute force attacks significantly
- **Storage**: Salt + hash combined for easy storage and retrieval

2. **Session Management**:
```python
def create_session(self, user_id: int, expires_days: int = 90) -> str:
    # Single session enforcement
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    
    # Create new session
    token = secrets.token_urlsafe(32)  # 256 bits of entropy
    expires_at = datetime.now() + timedelta(days=expires_days)
    
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at)
    )
    return token
```
- **Single Session**: Deletes old sessions to prevent account sharing
- **Secure Tokens**: 32 bytes = 256 bits of cryptographic entropy
- **Long Expiry**: 90 days accommodates extended study sessions
- **URL-Safe**: Base64 encoding safe for HTTP headers

3. **Admin Management**:
```python
def get_all_users(self) -> List[Dict[str, Any]]:
    cursor = conn.execute(
        "SELECT id, email, is_admin, created_at, last_login FROM users ORDER BY created_at DESC"
    )
    return [dict(user) for user in cursor.fetchall()]

def delete_user(self, user_id: int) -> bool:
    # Delete user's sessions first (foreign key constraint)
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    # Delete user
    cursor = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return cursor.rowcount > 0
```
- **Admin Queries**: Specialized methods for user management
- **Data Integrity**: Proper foreign key handling
- **Cascade Deletion**: Removes related sessions when deleting users

### Service Layer

#### 1. auth_service.py - Authentication Business Logic
**Location**: `backend/services/auth_service.py`
**Purpose**: Business logic layer between API and database

```python
class AuthService:
    def __init__(self):
        self.auth_db = auth_db
    
    def register_user(self, email: str, password: str, confirm_password: str) -> AuthResult:
        # Input validation
        if not self.validate_email(email):
            return AuthResult(success=False, error_message="Invalid email format")
        
        if not self.validate_password(password):
            return AuthResult(success=False, error_message="Password must be at least 8 characters")
        
        if password != confirm_password:
            return AuthResult(success=False, error_message="Passwords do not match")
        
        # Create user and session
        user_id = self.auth_db.create_user(email, password)
        if user_id:
            session_token = self.auth_db.create_session(user_id)
            self.create_user_directories(user_id)
            return AuthResult(success=True, user_id=user_id, session_token=session_token)
```

**Key Responsibilities**:
- **Input Validation**: Email format, password strength, confirmation matching
- **Business Rules**: User creation workflow, directory setup
- **Error Handling**: Consistent error response format
- **Directory Management**: Creates user-specific upload and vector store directories

```python
def create_user_directories(self, user_id: int) -> bool:
    # Create upload directory
    upload_path = Path(f"backend/uploads/{user_id}")
    upload_path.mkdir(parents=True, exist_ok=True)
    os.chmod(upload_path, 0o700)  # Owner read/write only
    
    # Ensure vector store base exists
    vector_base_path = Path("backend/vector_store")
    vector_base_path.mkdir(parents=True, exist_ok=True)
    
    return True
```
- **User Isolation**: Each user gets their own upload directory
- **Security**: Directory permissions restrict access to owner only
- **Vector Storage**: Prepares for user-specific vector stores

#### 2. document_processor.py - Document Processing Service
**Location**: `backend/services/document_processor.py`
**Purpose**: Handles file upload, processing, and vectorization

```python
class DocumentProcessor:
    def __init__(self):
        self.embedding_model = get_embedding_model()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", " ", ""]
        )
```

**Document Processing Pipeline**:

1. **File Loading**:
```python
def load_document(self, file_path: str) -> List[Document]:
    file_ext = os.path.splitext(file_path)[1].lower()
    
    if file_ext == '.pdf':
        loader = PyPDFLoader(file_path)
    elif file_ext == '.docx':
        loader = Docx2txtLoader(file_path)
    elif file_ext == '.txt':
        loader = TextLoader(file_path, encoding='utf-8')
    else:
        raise ValueError(f"Unsupported file type: {file_ext}")
    
    return loader.load()
```
- **Multi-format Support**: PDF, DOCX, TXT files
- **Appropriate Loaders**: Specialized loaders for each format
- **Error Handling**: Clear error messages for unsupported formats

2. **Text Chunking**:
```python
def process_document(self, file_path: str, user_id: str, course_id: str, filename: str) -> int:
    # Load and split document
    documents = self.load_document(file_path)
    chunks = self.text_splitter.split_documents(documents)
    
    # Add metadata to chunks
    for chunk in chunks:
        chunk.metadata.update({
            "user_id": user_id,
            "course_id": course_id,
            "document_name": filename,
            "chunk_id": str(uuid.uuid4())
        })
    
    # Create or update vector store
    vector_store_path = f"backend/vector_store/{user_id}_{course_id}"
    
    if os.path.exists(vector_store_path):
        # Load existing vector store and add new documents
        vector_store = FAISS.load_local(vector_store_path, self.embedding_model)
        vector_store.add_documents(chunks)
    else:
        # Create new vector store
        vector_store = FAISS.from_documents(chunks, self.embedding_model)
    
    vector_store.save_local(vector_store_path)
    return len(chunks)
```

**Processing Steps**:
- **Document Loading**: Extracts text from various file formats
- **Intelligent Chunking**: Preserves context with overlapping chunks
- **Metadata Enrichment**: Adds user, course, and document information
- **Vector Store Management**: Creates or updates FAISS indices
- **Persistence**: Saves vector stores for future retrieval

3. **Chunking Strategy**:
```python
RecursiveCharacterTextSplitter(
    chunk_size=500,        # Optimal for embedding model context
    chunk_overlap=50,      # 10% overlap preserves context
    separators=["\n\n", "\n", " ", ""]  # Hierarchical splitting
)
```
- **Size Optimization**: 500 characters fit well in embedding model context
- **Context Preservation**: 50-character overlap maintains continuity
- **Smart Splitting**: Tries paragraph breaks first, then sentences, then words

#### 3. rag_service.py - Retrieval-Augmented Generation
**Location**: `backend/services/rag_service.py`
**Purpose**: Combines document retrieval with LLM generation

```python
class RAGService:
    def __init__(self):
        self.llm = get_llm()
        self.doc_processor = DocumentProcessor()
    
    def answer_question(self, user_id: str, course_id: str, question: str, use_eli12: bool = False) -> dict:
        # Get relevant documents
        vector_store = self.doc_processor.get_vector_store(user_id, course_id)
        if not vector_store:
            return {
                "answer": "No documents found. Please upload study materials first.",
                "sources": [],
                "has_context": False
            }
        
        # Retrieve relevant chunks
        docs = vector_store.similarity_search(question, k=settings.TOP_K_RETRIEVAL)
        
        # Build context from retrieved documents
        context = "\n\n".join([doc.page_content for doc in docs])
        sources = list(set([doc.metadata.get("document_name", "Unknown") for doc in docs]))
        
        # Generate response
        prompt = self.build_prompt(context, question, use_eli12)
        response = self.llm.invoke(prompt)
        
        return {
            "answer": response,
            "sources": sources,
            "has_context": True
        }
```

**RAG Pipeline**:
1. **Document Retrieval**: Uses FAISS similarity search to find relevant chunks
2. **Context Building**: Combines retrieved chunks into coherent context
3. **Source Tracking**: Maintains list of source documents for citations
4. **Prompt Engineering**: Constructs effective prompts for the LLM
5. **Response Generation**: Uses local Llama 3 model for answer generation

**Prompt Engineering**:
```python
def build_prompt(self, context: str, question: str, use_eli12: bool) -> str:
    if use_eli12:
        style_instruction = "Explain in simple terms that a 12-year-old could understand. Use analogies and examples."
    else:
        style_instruction = "Provide a comprehensive and detailed explanation."
    
    return f"""Context from study materials:
{context}

Question: {question}

Instructions: {style_instruction}
Base your answer on the provided context. If the context doesn't contain enough information, say so clearly.

Answer:"""
```
- **Context Integration**: Provides relevant document chunks as context
- **Style Adaptation**: Adjusts explanation complexity based on user preference
- **Grounding**: Instructs model to base answers on provided context
- **Transparency**: Asks model to acknowledge when information is insufficient

#### 4. Streaming Implementation
```python
def answer_question_stream(self, user_id: str, course_id: str, question: str, use_eli12: bool = False):
    # Get context (same as non-streaming)
    vector_store = self.doc_processor.get_vector_store(user_id, course_id)
    docs = vector_store.similarity_search(question, k=settings.TOP_K_RETRIEVAL)
    context = "\n\n".join([doc.page_content for doc in docs])
    sources = list(set([doc.metadata.get("document_name", "Unknown") for doc in docs]))
    
    # Send metadata first
    yield f"data: {json.dumps({'type': 'metadata', 'sources': sources})}\n\n"
    
    # Stream response
    prompt = self.build_prompt(context, question, use_eli12)
    
    response = requests.post(
        f"{settings.OLLAMA_BASE_URL}/api/generate",
        json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": True},
        stream=True
    )
    
    for line in response.iter_lines():
        if line:
            data = json.loads(line)
            if 'response' in data:
                yield f"data: {json.dumps({'type': 'content', 'text': data['response']})}\n\n"
    
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
```

**Streaming Benefits**:
- **Real-time Feedback**: Users see responses as they're generated
- **Better UX**: No waiting for complete response (important for long answers)
- **Server-Sent Events**: Standard web technology for real-time updates
- **Metadata First**: Sources shown immediately, content streams after

### API Layer - Route Analysis

#### 1. auth.py - Authentication Endpoints
**Location**: `backend/api/routes/auth.py`
**Purpose**: HTTP endpoints for user authentication

```python
@router.post("/register", response_model=AuthResult)
async def register(request: RegisterRequest):
    result = auth_service.register_user(
        email=request.email,
        password=request.password,
        confirm_password=request.confirm_password
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error_message)
    
    return result
```

**Endpoint Analysis**:
- **Input Validation**: Pydantic model validates request structure
- **Business Logic**: Delegates to service layer for processing
- **Error Handling**: Converts service errors to HTTP status codes
- **Response Model**: Ensures consistent response structure

```python
@router.get("/me", response_model=User)
async def get_me(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = credentials.credentials
    user = auth_service.get_current_user(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user
```

**Security Features**:
- **Bearer Token**: Standard HTTP Authorization header
- **Token Validation**: Verifies token with auth service
- **User Context**: Returns current user information
- **Error Responses**: Clear error messages for different failure modes

#### 2. admin.py - Admin Management Endpoints
**Location**: `backend/api/routes/admin.py`
**Purpose**: Administrative functions for user and system management

```python
def require_admin(current_user: User = Depends(get_authenticated_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

@router.get("/users")
async def get_all_users(admin: User = Depends(require_admin)):
    users = auth_service.auth_db.get_all_users()
    return {"users": users}
```

**Admin Security**:
- **Role-based Access**: `require_admin` dependency ensures admin privileges
- **Dependency Injection**: FastAPI automatically handles authentication chain
- **Forbidden Response**: 403 status for insufficient privileges

```python
@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: User = Depends(require_admin)):
    # Prevent self-deletion
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete from database
    success = auth_service.auth_db.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user files
    user_upload_dir = Path(settings.UPLOAD_DIR) / str(user_id)
    if user_upload_dir.exists():
        shutil.rmtree(user_upload_dir)
    
    # Delete vector stores
    vector_store_dir = Path(settings.VECTOR_STORE_DIR)
    for vector_dir in vector_store_dir.glob(f"{user_id}_*"):
        shutil.rmtree(vector_dir)
    
    return {"message": f"User {user_id} deleted successfully"}
```

**Complete User Deletion**:
- **Safety Check**: Prevents admin from deleting their own account
- **Database Cleanup**: Removes user and associated sessions
- **File Cleanup**: Deletes user's uploaded documents
- **Vector Cleanup**: Removes user's vector stores
- **Atomic Operation**: All-or-nothing deletion process

#### 3. documents.py - Document Management
**Location**: `backend/api/routes/documents.py`
**Purpose**: File upload and document management

```python
@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    course_id: str = Form(...),
    current_user: User = Depends(get_authenticated_user)
):
    user_id = str(current_user.id)
    
    # Validate file type
    allowed_extensions = ['.pdf', '.txt', '.docx']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {file_ext}")
    
    # Save file
    user_dir = os.path.join(settings.UPLOAD_DIR, user_id, course_id)
    os.makedirs(user_dir, exist_ok=True)
    
    file_path = os.path.join(user_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process document
    num_chunks = doc_processor.process_document(file_path, user_id, course_id, file.filename)
    
    # Log activity
    log_activity(user_id, "document_upload", {
        "filename": file.filename,
        "course": course_id,
        "chunks": num_chunks
    })
    
    return {
        "message": "Document uploaded successfully",
        "filename": file.filename,
        "chunks": num_chunks
    }
```

**Upload Process**:
1. **Authentication**: Ensures user is logged in
2. **File Validation**: Checks file type against allowed extensions
3. **User Isolation**: Saves to user-specific directory
4. **File Storage**: Saves uploaded file to disk
5. **Document Processing**: Converts to chunks and creates embeddings
6. **Activity Logging**: Records upload for analytics
7. **Response**: Returns success status with metadata

#### 4. chat.py - AI Tutor Endpoints
**Location**: `backend/api/routes/chat.py`
**Purpose**: Question answering and streaming responses

```python
class AuthenticatedChatRequest(BaseModel):
    course_id: str
    question: str
    use_eli12: bool = False

@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    request: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    user_id = str(current_user.id)
    
    result = rag_service.answer_question(
        user_id,
        request.course_id,
        request.question,
        request.use_eli12
    )
    
    # Log the question
    log_activity(user_id, "question", {
        "question": request.question,
        "course": request.course_id
    })
    
    return ChatResponse(**result)
```

**Question Processing**:
- **User Context**: Automatically gets user ID from authentication
- **RAG Integration**: Uses retrieval-augmented generation for answers
- **Activity Tracking**: Logs questions for analytics
- **Response Structure**: Consistent response format with sources

```python
@router.post("/ask-stream")
async def ask_question_stream(
    request: AuthenticatedChatRequest,
    current_user: User = Depends(get_authenticated_user)
):
    user_id = str(current_user.id)
    
    # Log the question
    log_activity(user_id, "question", {
        "question": request.question,
        "course": request.course_id
    })
    
    # Get streaming generator
    stream = rag_service.answer_question_stream(
        user_id,
        request.course_id,
        request.question,
        request.use_eli12
    )
    
    return StreamingResponse(stream, media_type="text/event-stream")
```

**Streaming Implementation**:
- **Server-Sent Events**: Uses standard SSE protocol
- **Real-time Response**: Streams tokens as they're generated
- **Activity Logging**: Records question before streaming starts
- **Media Type**: Proper content type for SSE

### Middleware Layer

#### 1. auth_middleware.py - Request Authentication
**Location**: `backend/middleware/auth_middleware.py`
**Purpose**: Automatic authentication for protected routes

```python
class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, protected_paths: list = None):
        super().__init__(app)
        self.protected_paths = protected_paths or [
            "/api/documents", "/api/chat", "/api/quiz",
            "/api/flashcards", "/api/summary", "/api/planner", "/api/stats"
        ]
        
        self.public_paths = [
            "/", "/health", "/docs", "/openapi.json", "/api/auth"
        ]
```

**Route Classification**:
- **Protected Paths**: Require authentication (all main features)
- **Public Paths**: No authentication needed (health checks, docs, auth endpoints)
- **Default Behavior**: Unknown paths are protected by default (secure by default)

```python
async def dispatch(self, request: Request, call_next: Callable):
    if self.is_protected_route(request.url.path):
        token = self.extract_token(request)
        
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
        
        user = auth_service.get_current_user(token)
        
        if not user:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
        
        # Inject user context
        request.state.user = user
        request.state.user_id = user.id
    
    return await call_next(request)
```

**Middleware Flow**:
1. **Route Check**: Determines if endpoint requires authentication
2. **Token Extraction**: Gets token from Authorization header
3. **Token Validation**: Verifies token with auth service
4. **Context Injection**: Adds user info to request state
5. **Request Forwarding**: Passes control to actual endpoint
6. **Error Handling**: Returns 401 for authentication failures

```python
def extract_token(self, request: Request) -> str:
    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]  # Remove "Bearer " prefix
    
    # Try X-Auth-Token header
    token_header = request.headers.get("X-Auth-Token")
    if token_header:
        return token_header
    
    # Try query parameter (for development/testing)
    token_param = request.query_params.get("token")
    if token_param:
        return token_param
    
    return None
```

**Token Extraction Strategy**:
- **Primary**: Standard Authorization header with Bearer token
- **Alternative**: Custom X-Auth-Token header
- **Development**: Query parameter for testing (not recommended for production)
- **Flexibility**: Multiple methods ensure compatibility

---

*Continuing with Frontend Architecture...*
## Frontend Architecture - Complete Analysis

### Core Application Structure

#### 1. app.py - Main Application Entry Point
**Location**: `frontend/app.py`
**Purpose**: Streamlit application initialization and routing

```python
# Page Configuration
st.set_page_config(
    page_title="InStudy 2.0",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)
```
**Configuration Impact**:
- **Wide Layout**: Maximizes screen real estate for charts and content
- **Expanded Sidebar**: Navigation always visible for better UX
- **Custom Icon**: Branding and visual identity
- **Page Title**: Shows in browser tab

```python
# Authentication Guard
if not require_authentication():
    st.stop()
```
**Security First**:
- **Authentication Check**: First thing that runs, before any content
- **Stop Execution**: Prevents unauthorized access to any functionality
- **Clean Separation**: Auth logic separated from main app logic

```python
# Dynamic Navigation
menu_options = ["Dashboard", "Courses", "AI Tutor", "Flashcards", "Quiz", "Summary", "Study Planner"]
menu_icons = ["house", "book", "chat", "card-list", "question-circle", "file-text", "calendar"]

# Add admin option if user is admin
if current_user and current_user.get("is_admin"):
    menu_options.append("Admin Panel")
    menu_icons.append("shield-lock")

selected = option_menu(
    menu_title=None,
    options=menu_options,
    icons=menu_icons,
    default_index=0,
    orientation="horizontal"
)
```

**Navigation Features**:
- **Role-based Menu**: Admin panel only shown to administrators
- **Horizontal Layout**: Clean, modern navigation at bottom
- **Icon Integration**: Visual cues for each section
- **Dynamic Options**: Menu adapts based on user permissions

#### 2. Authentication System Frontend

##### auth_utils.py - Authentication Manager
**Location**: `frontend/utils/auth_utils.py`
**Purpose**: Handles all authentication operations and state management

```python
class AuthManager:
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url
        self.session_key = "auth_session"
        self.user_key = "auth_user"
```

**Session Management**:
- **Persistent Storage**: Uses Streamlit session state for persistence
- **Key Management**: Separate keys for token and user data
- **Backend Integration**: Configurable backend URL

```python
def login(self, email: str, password: str) -> tuple[bool, str]:
    try:
        response = requests.post(
            f"{self.backend_url}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30  # Extended timeout for reliability
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                # Store session token and user info
                st.session_state[self.session_key] = data["session_token"]
                st.session_state[self.user_key] = data["user"]
                return True, "Login successful"
```

**Login Process**:
1. **API Call**: POST request to backend auth endpoint
2. **Extended Timeout**: 30 seconds to handle slow connections
3. **Response Validation**: Checks both HTTP status and success flag
4. **State Storage**: Saves token and user data in session state
5. **Error Handling**: Returns clear success/failure status

```python
def get_auth_headers(self) -> Dict[str, str]:
    token = self.get_session_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}
```

**API Integration**:
- **Header Generation**: Creates proper Authorization headers
- **Token Management**: Automatically includes current session token
- **Fallback**: Returns empty dict if no token (for public endpoints)

##### auth_guard.py - Authentication UI Components
**Location**: `frontend/components/auth_guard.py`
**Purpose**: Login/signup forms and authentication enforcement

```python
def require_authentication():
    # Check if user is authenticated
    if auth_manager.is_authenticated():
        # Verify token is still valid
        if auth_manager.verify_token():
            return True
        else:
            # Try to recover session first
            if auth_manager.recover_session():
                return True
            else:
                auth_manager.clear_session()
                st.error("Your session has expired or there was a connection issue.")
    
    # Show authentication forms
    show_login_or_signup_forms()
    return False
```

**Authentication Flow**:
1. **Session Check**: Verifies user has active session
2. **Token Validation**: Confirms token is still valid with backend
3. **Session Recovery**: Attempts to recover from temporary connection issues
4. **Graceful Degradation**: Shows appropriate error messages
5. *