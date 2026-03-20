# Get Started with InStudy 2.0 in 3 Steps

## Step 1: Install Ollama (2 minutes)

### Windows
Download and install from: https://ollama.ai/download

### Linux/Mac
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Pull Llama 3
```bash
ollama pull llama3
```

## Step 2: Install Dependencies (2 minutes)

### Install Backend
```bash
cd backend
pip install -r requirements.txt
```

### Install Frontend
```bash
cd frontend
pip install -r requirements.txt
```

## Step 3: Run (1 minute)

### Windows
```bash
start.bat
```

### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

### Access
Open browser: http://localhost:8501

## 🎉 You're Ready!

### Try These First:

1. **Create a Course**
   - Click "Courses" → Create "Machine Learning"

2. **Upload Test Document**
   - Go to "AI Tutor"
   - Upload `backend/test_ml.txt`

3. **Ask a Question**
   - Type: "What is machine learning?"
   - See AI response with sources

4. **Generate Flashcards**
   - Go to "Flashcards"
   - Click "Generate Flashcards"

5. **Take a Quiz**
   - Go to "Quiz"
   - Generate 5 questions
   - Test your knowledge

## 📚 Next Steps

- Read [USAGE.md](USAGE.md) for detailed feature guide
- Check [FEATURES.md](FEATURES.md) for all capabilities
- See [INDEX.md](INDEX.md) for complete documentation

## ❓ Problems?

Run verification:
```bash
python verify_setup.py
```

Check [SETUP_GUIDE.md](SETUP_GUIDE.md) troubleshooting section.

---

**That's it! You're ready to study smarter with InStudy 2.0** 🚀
