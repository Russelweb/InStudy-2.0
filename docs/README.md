# InStudy 2.0 🧠

InStudy 2.0 is an advanced, AI-powered educational workspace built to supercharge the learning process through neural-assisted document analysis, active spaced repetition, and real-time tutoring.

This repository features a robust FastAPI backend combined with **two distinct frontend implementations**: a rapid-prototyping Streamlit legacy interface, and a brand-new, ultra-modern React + Tailwind CSS web application.

---

## 🏗️ System Architecture

### 1. The Core Engine (Backend)
- **Directory:** `/backend`
- **Stack:** Python, FastAPI, LlamaIndex / LangChain, LLM APIs
- **Features:** 
  - Centralized Authentication & Security
  - Document Parser Engine (handles `.pdf`, `.docx`, `.txt`)
  - Semantic RAG Pipeline (Retrieval-Augmented Generation) for the AI Tutor
  - Adaptive Quiz & Flashcard generation engines using LLMs
  - Neural Annotation persistence layer

### 2. Streamlit Interface (Legacy / Prototyping Frontend)
- **Directory:** `/frontend`
- **Stack:** Python, Streamlit
- **Description:** 
  The original interface for InStudy 2.0. Built in Streamlit, it was designed for rapid prototyping and testing of the core AI pathways. It includes modular pages for uploading documents, chatting with the AI Tutor, viewing extracted concepts, and taking short quizzes.
- **Run Instructions:**
  ```bash
  cd frontend
  streamlit run app.py
  ```

### 3. Neural Web Application (Next-Gen Frontend)
- **Directory:** `/frontend-v2`
- **Stack:** React, Vite, TailwindCSS, Framer Motion
- **Description:** 
  The Next-Generation UI for InStudy 2.0. Designed with a deep, dark glassmorphism aesthetic (the "Neural Workspace"), it provides a highly interactive and fluid user experience. 
- **Features Include:**
  - **Dynamic Workspace:** Side-by-side RAG AI chat and universal document rendering viewer.
  - **Inline Annotations:** natively highlight and tag PDFs, Word, and text documents with summaries and key points directly from the browser.
  - **Neural Control Deck:** A live, sticky global action bar tracking active insights.
  - **Adaptive Flashcards:** A swiping spaced-repetition UI that handles complex logic, mastery progression, and "skip" functionalities.
- **Run Instructions:**
  ```bash
  cd frontend-v2
  npm install
  npm run dev
  ```

---

## 🚀 Getting Started

To launch the full InStudy 2.0 ecosystem:

### Step 1: Configure Environment Credentials
The backend requires setting up an LLM provider (like Groq or local Ollama).
1. Navigate into the `backend/` folder.
2. Copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Open `.env` and set your preferred keys (e.g., `GROQ_API_KEY` or custom `OLLAMA` variables).

### Step 2: Start the Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Step 3: Choose Your Frontend

**Option A: The Next-Gen Neural Web App (React)**
Provides the complete, interactive experience with inline annotations and dynamic flashcards.
```bash
cd frontend-v2
npm install
npm run dev
```

**Option B: The Prototype Interface (Streamlit)**
Provides a fast, modular prototyping environment for testing core AI logic and workflows.
```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

### Alternatively: Launch via Quick Start Script
You can use the local bootstrap bat file to spin up environments:
```bash
start.bat
```

---

## 🛠️ Key Technical Details

### Neural Web App (React)
- **Universal Reader:** Replaces basic DOM reading with custom text parsers that support Word docs, Txt, and iframe streams natively.
- **Global Event Propagation:** Utilizes sophisticated React state to share annotation states globally across complex DOM trees like the Neural Deck.
- **AI Token Reliability:** Uses heavily typed prompts with strict JSON payload fallback parsing to keep external LLM APIs from breaking UI structures during dynamic quiz generation.

### Prototype Interface (Streamlit)
- **Session State Management:** Heavily relies on Streamlit's `st.session_state` to orchestrate multi-step chat logic and maintain context across page reruns.
- **Rapid Prototyping Modules:** Every feature (Flashcards, Quiz, Summary, Document Upload) is broken into isolated modular pages, allowing swift testing of backend service logic without dealing with asynchronous DOM reconciliation.
