# InStudy 2.0 - Complete File Structure

## 📁 Root Directory

```
instudy/
├── backend/                    # FastAPI backend application
├── frontend/                   # Streamlit frontend application
├── .gitignore                  # Git ignore patterns
├── .vscode/                    # VS Code settings (optional)
├── LICENSE                     # MIT License
├── README.md                   # Main project documentation
├── start.bat                   # Windows startup script
├── start.sh                    # Linux/Mac startup script
├── verify_setup.py             # Setup verification script
│
├── ARCHITECTURE.md             # System architecture documentation
├── API_REFERENCE.md            # Complete API documentation
├── DEPLOYMENT.md               # Production deployment guide
├── FEATURES.md                 # Feature list and capabilities
├── FILE_STRUCTURE.md           # This file
├── PROJECT_OVERVIEW.md         # Comprehensive project overview
├── QUICKSTART.md               # 5-minute quick start guide
├── SETUP_GUIDE.md              # Detailed setup instructions
├── SYSTEM_DIAGRAM.md           # Visual system diagrams
├── TESTING.md                  # Testing guide and checklist
├── TODO.md                     # Future enhancements roadmap
└── USAGE.md                    # User guide and best practices
```

## 🔧 Backend Structure

```
backend/
├── api/                        # API layer
│   ├── __init__.py
│   └── routes/                 # API route handlers
│       ├── __init__.py
│       ├── chat.py             # AI tutor chat endpoints
│       ├── documents.py        # Document upload/list endpoints
│       ├── flashcards.py       # Flashcard generation endpoints
│       ├── planner.py          # Study planner endpoints
│       ├── quiz.py             # Quiz generation endpoints
│       └── summary.py          # Summary generation endpoints
│
├── models/                     # Data models
│   ├── __init__.py
│   └── schemas.py              # Pydantic schemas for API
│
├── services/                   # Business logic layer
│   ├── __init__.py
│   ├── auth_service.py         # Authentication (simplified)
│   ├── document_processor.py  # Document processing & RAG
│   ├── flashcard_service.py   # Flashcard generation logic
│   ├── planner_service.py     # Study plan generation
│   ├── quiz_service.py        # Quiz generation logic
│   ├── rag_service.py         # Hybrid RAG Q&A system
│   └── summary_service.py     # Summary generation logic
│
├── .env                        # Environment variables (create from .env.example)
├── .env.example                # Environment template
├── config.py                   # Configuration settings
├── main.py                     # FastAPI application entry point
├── render.yaml                 # Render deployment config
├── requirements.txt            # Python dependencies
└── test_ml.txt                 # Sample test document
```

### Backend File Purposes

**main.py**
- FastAPI application initialization
- CORS middleware configuration
- Route registration
- Health check endpoints

**config.py**
- Settings management using Pydantic
- Environment variable loading
- Directory creation
- Configuration constants

**services/document_processor.py**
- Document loading (PDF, TXT, DOCX)
- Text chunking with overlap
- Embedding generation
- FAISS vector store management
- Metadata handling

**services/rag_service.py**
- Hybrid RAG implementation
- Vector similarity search
- Context-aware answering
- General knowledge fallback
- ELI12 mode support
- Structured response formatting

**services/quiz_service.py**
- Quiz generation from materials
- Multiple question types
- Difficulty adjustment
- JSON response parsing
- Fallback handling

**services/flashcard_service.py**
- Flashcard generation
- Key concept extraction
- Q&A pair creation
- Batch processing

**services/summary_service.py**
- Multiple summary styles
- Document filtering
- Length control
- Style-specific prompts

**services/planner_service.py**
- Study schedule generation
- Date-aware planning
- Topic distribution
- Revision strategies

**api/routes/documents.py**
- File upload handling
- Document processing trigger
- Document listing
- File validation

**api/routes/chat.py**
- Question handling
- RAG service integration
- Response formatting

**api/routes/quiz.py**
- Quiz request handling
- Parameter validation
- Response formatting

**api/routes/flashcards.py**
- Flashcard request handling
- Generation coordination

**api/routes/summary.py**
- Summary request handling
- Style selection

**api/routes/planner.py**
- Study plan creation
- Date validation

**models/schemas.py**
- Request/response models
- Data validation
- Type definitions

## 🎨 Frontend Structure

```
frontend/
├── pages/                      # Streamlit pages
│   ├── __init__.py
│   ├── ai_tutor.py            # AI tutor chat interface
│   ├── courses.py             # Course management
│   ├── dashboard.py           # Statistics dashboard
│   ├── flashcards.py          # Flashcard viewer
│   ├── planner.py             # Study planner interface
│   ├── quiz.py                # Quiz interface
│   └── summary.py             # Summary generator
│
├── .streamlit/                 # Streamlit configuration
│   └── config.toml            # Theme and settings
│
├── .env                        # Environment variables (optional)
├── .env.example                # Environment template
├── app.py                      # Main Streamlit application
└── requirements.txt            # Python dependencies
```

### Frontend File Purposes

**app.py**
- Main application entry point
- Sidebar navigation
- Session state initialization
- Page routing
- User context management

**pages/dashboard.py**
- Study statistics display
- Progress visualization
- Recent activity
- Metrics cards

**pages/courses.py**
- Course creation
- Course selection
- Course listing
- Course management

**pages/ai_tutor.py**
- Document upload interface
- Chat interface
- ELI12 toggle
- Chat history display
- Source attribution

**pages/flashcards.py**
- Flashcard generation
- Card display
- Flip animation
- Navigation controls
- Shuffle functionality

**pages/quiz.py**
- Quiz configuration
- Question display
- Answer input
- Score calculation
- Explanation display

**pages/summary.py**
- Style selection
- Document filtering
- Summary display
- Export functionality

**pages/planner.py**
- Plan creation form
- Schedule display
- Weekly breakdown
- Revision tips

**.streamlit/config.toml**
- Theme colors
- Font settings
- Upload size limits
- Server configuration

## 📚 Documentation Files

**README.md**
- Project overview
- Quick start guide
- Feature highlights
- Tech stack
- Installation steps
- Links to other docs

**QUICKSTART.md**
- 5-minute setup guide
- Prerequisites
- Installation steps
- First-time usage
- Troubleshooting

**SETUP_GUIDE.md**
- Detailed setup instructions
- Step-by-step walkthrough
- Configuration details
- Verification steps
- Best practices

**USAGE.md**
- Feature usage guide
- Best practices
- Study strategies
- Troubleshooting
- Tips and tricks

**ARCHITECTURE.md**
- System design
- Component overview
- Data flow
- Technology choices
- Performance characteristics

**API_REFERENCE.md**
- Complete API documentation
- Endpoint descriptions
- Request/response examples
- Error codes
- Testing examples

**DEPLOYMENT.md**
- Production deployment
- Render setup
- Streamlit Cloud setup
- Environment configuration
- Domain setup

**FEATURES.md**
- Complete feature list
- Implementation status
- Technical details
- Future enhancements

**PROJECT_OVERVIEW.md**
- Vision and goals
- Architecture highlights
- Component details
- Use cases
- Success metrics

**SYSTEM_DIAGRAM.md**
- Visual diagrams
- Data flows
- Component interactions
- Architecture views

**TESTING.md**
- Testing checklist
- API testing
- Performance testing
- Common issues

**TODO.md**
- Future enhancements
- Roadmap
- Priority levels
- Feature ideas

**FILE_STRUCTURE.md**
- This file
- Complete file listing
- File purposes
- Directory organization

## 🔨 Utility Files

**start.bat** (Windows)
- Automated startup script
- Environment check
- Backend startup
- Frontend startup
- Status messages

**start.sh** (Linux/Mac)
- Automated startup script
- Environment check
- Process management
- Graceful shutdown

**verify_setup.py**
- Python version check
- Dependency verification
- Environment file check
- Directory structure check
- Setup report

## 🔐 Configuration Files

**.env.example** (Backend)
```
OPENAI_API_KEY=your_key_here
FIREBASE_PROJECT_ID=optional
FIREBASE_PRIVATE_KEY=optional
FIREBASE_CLIENT_EMAIL=optional
```

**.env.example** (Frontend)
```
API_URL=http://localhost:8000
```

**render.yaml**
- Render deployment configuration
- Build commands
- Start commands
- Environment variables

**.gitignore**
- Python cache files
- Environment files
- Vector stores
- Uploads directory
- IDE settings

## 📦 Dependency Files

**backend/requirements.txt**
- FastAPI and Uvicorn
- LangChain ecosystem
- OpenAI SDK
- FAISS vector database
- Document processors
- Pydantic models
- Firebase admin (optional)

**frontend/requirements.txt**
- Streamlit framework
- Requests library
- Plotly charts
- Pandas data handling
- Streamlit extensions

## 🗂️ Generated Directories (Runtime)

```
uploads/                        # Created at runtime
└── {user_id}/
    └── {course_id}/
        ├── document1.pdf
        ├── document2.txt
        └── document3.docx

vector_store/                   # Created at runtime
└── {user_id}_{course_id}/
    ├── index.faiss            # Vector index
    └── index.pkl              # Metadata
```

## 📊 File Count Summary

```
Total Files: 50+
├── Python Files: 25
├── Markdown Docs: 15
├── Config Files: 6
├── Scripts: 3
└── Other: 1
```

## 🎯 Key Files for Development

**Must Edit:**
1. `backend/.env` - Add OpenAI API key
2. `backend/config.py` - Adjust settings if needed
3. `frontend/app.py` - Customize UI if needed

**Core Logic:**
1. `backend/services/rag_service.py` - RAG implementation
2. `backend/services/document_processor.py` - Document handling
3. `backend/main.py` - API setup

**UI Components:**
1. `frontend/app.py` - Main navigation
2. `frontend/pages/ai_tutor.py` - Chat interface
3. `frontend/pages/quiz.py` - Quiz interface

## 🔍 Finding Specific Functionality

**Document Upload:** 
- Backend: `backend/api/routes/documents.py`
- Frontend: `frontend/pages/ai_tutor.py`

**Question Answering:**
- Backend: `backend/services/rag_service.py`
- Frontend: `frontend/pages/ai_tutor.py`

**Quiz Generation:**
- Backend: `backend/services/quiz_service.py`
- Frontend: `frontend/pages/quiz.py`

**Flashcards:**
- Backend: `backend/services/flashcard_service.py`
- Frontend: `frontend/pages/flashcards.py`

**Summaries:**
- Backend: `backend/services/summary_service.py`
- Frontend: `frontend/pages/summary.py`

**Study Planning:**
- Backend: `backend/services/planner_service.py`
- Frontend: `frontend/pages/planner.py`

## 📝 Notes

- All `__init__.py` files are empty module markers
- `.env` files are created from `.env.example` templates
- `uploads/` and `vector_store/` are created automatically
- Documentation files are in Markdown format
- Python files follow PEP 8 style guidelines
- All services are modular and independent
- Frontend pages are self-contained components

This structure supports:
- Easy navigation
- Clear separation of concerns
- Modular development
- Simple testing
- Straightforward deployment
- Future scalability
