# InStudy 2.0 - System Diagrams

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
│                    (Web Browser)                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  STREAMLIT FRONTEND                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Dashboard │ Courses  │AI Tutor  │Flashcards│  Quiz    │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────┬──────────┐                                    │
│  │ Summary  │ Planner  │                                    │
│  └──────────┴──────────┘                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  API ROUTES                           │  │
│  │  /documents  /chat  /quiz  /flashcards  /summary     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │                   SERVICES                            │  │
│  │  • RAGService      • QuizService                      │  │
│  │  • FlashcardService • SummaryService                  │  │
│  │  • PlannerService  • DocumentProcessor                │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   FAISS     │  │  LangChain  │  │  OpenAI     │
│   Vector    │  │  Framework  │  │  GPT-4o     │
│   Database  │  │             │  │  Mini API   │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Document Processing Flow

```
┌──────────────┐
│ User Uploads │
│   Document   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  File Validation │
│  (PDF/TXT/DOCX)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Text Extraction │
│  (PyPDF/docx)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Text Chunking   │
│  (1000 chars)    │
│  (200 overlap)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│    Embedding     │
│   Generation     │
│ (OpenAI API)     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Store in FAISS  │
│  Vector Database │
│  + Metadata      │
└──────────────────┘
```

## Hybrid RAG Question Answering

```
┌──────────────┐
│ User Question│
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Vector Similarity   │
│      Search          │
│   (FAISS Query)      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Check Similarity    │
│      Score           │
└──────┬───────────────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌─────────────────┐    ┌─────────────────┐
│ Score < 0.7     │    │ Score >= 0.7    │
│ (RELEVANT)      │    │ (NOT RELEVANT)  │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Use Document    │    │ Use General     │
│ Context + LLM   │    │ Knowledge Only  │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────┐
         │   GPT-4o Mini    │
         │   Processing     │
         └──────────┬───────┘
                    │
                    ▼
         ┌──────────────────┐
         │   Structured     │
         │    Response      │
         │  + Sources       │
         └──────────────────┘
```

## Quiz Generation Flow

```
┌──────────────┐
│ User Request │
│ (5 questions)│
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Retrieve Diverse │
│ Document Chunks  │
│   (k=10)         │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Build Prompt    │
│  with Context    │
│  + Instructions  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  GPT-4o Mini     │
│  Generation      │
│  (JSON format)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Parse JSON      │
│  Response        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Return Quiz     │
│  Questions +     │
│  Answers +       │
│  Explanations    │
└──────────────────┘
```

## Data Storage Structure

```
instudy/
├── uploads/                    # User documents
│   └── {user_id}/
│       └── {course_id}/
│           ├── lecture1.pdf
│           ├── notes.txt
│           └── slides.docx
│
├── vector_store/               # FAISS indices
│   └── {user_id}_{course_id}/
│       ├── index.faiss         # Vector index
│       └── index.pkl           # Metadata
│
└── backend/
    └── .env                    # API keys
```

## API Request Flow

```
Frontend (Streamlit)
    │
    │ HTTP POST /api/chat/ask
    │ {
    │   "user_id": "demo_user",
    │   "course_id": "machine_learning",
    │   "question": "What is gradient descent?"
    │ }
    │
    ▼
Backend (FastAPI)
    │
    ├─► Route Handler (chat.py)
    │       │
    │       ▼
    ├─► RAGService
    │       │
    │       ├─► DocumentProcessor.get_vector_store()
    │       │       │
    │       │       ▼
    │       │   FAISS Vector Store
    │       │       │
    │       │       ▼
    │       │   Similarity Search
    │       │
    │       ├─► Build Prompt
    │       │
    │       ▼
    ├─► OpenAI API
    │       │
    │       ▼
    │   GPT-4o Mini
    │       │
    │       ▼
    │   Generated Response
    │
    ▼
Response to Frontend
{
  "answer": "Gradient descent is...",
  "sources": ["lecture1.pdf"],
  "has_context": true
}
```

## User Journey Map

```
┌─────────────┐
│   Sign Up   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Create Course│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Upload    │
│  Documents  │
└──────┬──────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Ask       │  │Generate  │  │Generate  │  │Generate  │
│Questions │  │Flashcards│  │Quizzes   │  │Summary   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Study & Learn│
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Take Exam   │
              └──────────────┘
```

## Component Interaction

```
┌────────────────────────────────────────────────────┐
│                  FRONTEND LAYER                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Pages   │  │Components│  │  State   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼───────────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      │ REST API
                      │
┌───────────────────┼─────────────────────────────────┐
│                   ▼          BACKEND LAYER          │
│  ┌────────────────────────────────────────┐        │
│  │           API Routes                    │        │
│  └────────────────┬───────────────────────┘        │
│                   │                                 │
│  ┌────────────────▼───────────────────────┐        │
│  │           Services Layer                │        │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │        │
│  │  │ RAG  │ │ Quiz │ │Flash │ │Plan  │  │        │
│  │  └───┬──┘ └───┬──┘ └───┬──┘ └───┬──┘  │        │
│  └──────┼────────┼────────┼────────┼──────┘        │
│         │        │        │        │                │
│  ┌──────▼────────▼────────▼────────▼──────┐        │
│  │      Document Processor                 │        │
│  └──────┬──────────────────────────────────┘        │
└─────────┼───────────────────────────────────────────┘
          │
          ├─────────────┬─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │  FAISS  │   │LangChain│   │ OpenAI  │
    │ Vector  │   │Framework│   │   API   │
    │   DB    │   │         │   │         │
    └─────────┘   └─────────┘   └─────────┘
```

## Security Architecture

```
┌──────────────┐
│    User      │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Firebase Auth   │ (Optional - Production)
│  (JWT Token)     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  API Gateway     │
│  (CORS, Auth)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  User Isolation  │
│  (user_id based) │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Vector Store    │
│  Per User/Course │
└──────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              PRODUCTION                      │
│                                              │
│  ┌────────────────┐    ┌─────────────────┐ │
│  │ Streamlit Cloud│    │  Render.com     │ │
│  │   (Frontend)   │───▶│   (Backend)     │ │
│  └────────────────┘    └────────┬────────┘ │
│                                  │          │
│                                  ▼          │
│                         ┌─────────────────┐ │
│                         │   OpenAI API    │ │
│                         └─────────────────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│             DEVELOPMENT                      │
│                                              │
│  ┌────────────────┐    ┌─────────────────┐ │
│  │   localhost    │    │   localhost     │ │
│  │     :8501      │───▶│     :8000       │ │
│  │  (Streamlit)   │    │   (FastAPI)     │ │
│  └────────────────┘    └────────┬────────┘ │
│                                  │          │
│                                  ▼          │
│                         ┌─────────────────┐ │
│                         │   OpenAI API    │ │
│                         └─────────────────┘ │
└─────────────────────────────────────────────┘
```

## RAG Pipeline Detail

```
┌─────────────────────────────────────────────────────┐
│                 DOCUMENT UPLOAD                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ Text Extract │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Chunking   │
              │  1000 chars  │
              │  200 overlap │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Embeddings  │
              │ (1536 dims)  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ FAISS Index  │
              │   + Metadata │
              └──────────────┘

┌─────────────────────────────────────────────────────┐
│                  QUESTION ANSWERING                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │   Question   │
              │  Embedding   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Similarity │
              │    Search    │
              │   (Top 4)    │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │Score < 0.7?  │
              └──┬────────┬──┘
                 │        │
            YES  │        │ NO
                 │        │
       ┌─────────▼──┐  ┌─▼──────────┐
       │Use Context │  │Use General │
       │+ Question  │  │Knowledge   │
       └─────────┬──┘  └─┬──────────┘
                 │        │
                 └────┬───┘
                      │
                      ▼
              ┌──────────────┐
              │  GPT-4o Mini │
              │  Processing  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Structured  │
              │   Response   │
              └──────────────┘
```

## State Management

```
┌─────────────────────────────────────┐
│      Streamlit Session State        │
├─────────────────────────────────────┤
│ • user_id                           │
│ • current_course                    │
│ • chat_history                      │
│ • flashcards                        │
│ • current_card                      │
│ • show_back                         │
│ • quiz_questions                    │
│ • quiz_answers                      │
│ • study_plan                        │
│ • current_summary                   │
└─────────────────────────────────────┘
```

## Technology Stack Layers

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│  Streamlit • Plotly • HTML/CSS          │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         APPLICATION LAYER               │
│  FastAPI • Pydantic • Python            │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         BUSINESS LOGIC LAYER            │
│  LangChain • Custom Services            │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         DATA LAYER                      │
│  FAISS • File System • Embeddings       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         EXTERNAL SERVICES               │
│  OpenAI API • Firebase (optional)       │
└─────────────────────────────────────────┘
```

## Scalability Model

```
Current (MVP):
┌──────────┐     ┌──────────┐
│ Frontend │────▶│ Backend  │
│ (Single) │     │ (Single) │
└──────────┘     └──────────┘

Future (Scale):
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend │────▶│   Load   │────▶│ Backend  │
│   CDN    │     │ Balancer │     │ Instance │
└──────────┘     └──────────┘     │    1     │
                                   ├──────────┤
                                   │ Backend  │
                                   │ Instance │
                                   │    2     │
                                   ├──────────┤
                                   │ Backend  │
                                   │ Instance │
                                   │    3     │
                                   └────┬─────┘
                                        │
                                   ┌────▼─────┐
                                   │PostgreSQL│
                                   │ Database │
                                   └──────────┘
```

These diagrams illustrate the complete system architecture, data flows, and component interactions in InStudy 2.0.
