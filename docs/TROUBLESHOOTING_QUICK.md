# Quick Troubleshooting Guide

## Issue: "Failed" errors when uploading or generating content

### Solution Steps:

1. **Restart the Backend**
   ```bash
   # Stop the current backend (Ctrl+C in the terminal)
   # Then restart:
   cd backend
   uvicorn main:app --reload
   ```

2. **Check Backend Logs**
   Look at the terminal where the backend is running. You should see detailed error messages now.

3. **Verify API Key**
   ```bash
   # Check if OPENAI_API_KEY is set
   cd backend
   type .env  # Windows
   cat .env   # Linux/Mac
   ```
   
   Make sure it shows: `OPENAI_API_KEY=sk-...`

4. **Test Backend Connection**
   ```bash
   cd frontend
   python test_backend.py
   ```
   
   Should show: ✅ Backend is running

5. **Common Issues:**

   **Issue: "Cannot connect to backend"**
   - Solution: Make sure backend is running on port 8000
   - Check: http://localhost:8000/docs should open

   **Issue: "OpenAI API error"**
   - Solution: Check your API key is valid
   - Check: You have credits in your OpenAI account

   **Issue: "No documents found"**
   - Solution: Upload a document first before generating quizzes/flashcards
   - Go to: AI Tutor → Upload Study Material

6. **Step-by-Step Test:**
   
   a. Create a course:
      - Go to "Courses"
      - Create "Test Course"
   
   b. Upload test document:
      - Go to "AI Tutor"
      - Upload `backend/test_ml.txt`
      - Click "Process Document"
      - Should see: ✅ test_ml.txt processed (X chunks)
   
   c. Ask a question:
      - Type: "What is machine learning?"
      - Should get an answer with sources
   
   d. Generate flashcards:
      - Go to "Flashcards"
      - Click "Generate Flashcards"
      - Should see cards appear

7. **If Still Failing:**
   
   Check the backend terminal for error messages. Common errors:
   
   - `OpenAI API error`: Check API key and credits
   - `No documents found`: Upload documents first
   - `Connection refused`: Backend not running
   - `Module not found`: Run `pip install -r requirements.txt`

8. **Get Detailed Errors:**
   
   The backend now prints detailed error messages. Look for lines starting with:
   - `Error in upload_document:`
   - `Error in generate_quiz:`
   - `Error in generate_flashcards:`

## Quick Fix Commands:

```bash
# Restart everything
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload

# Terminal 2 - Frontend  
cd frontend
streamlit run app.py
```

## Still Having Issues?

1. Check backend terminal for errors
2. Try uploading the test document: `backend/test_ml.txt`
3. Make sure you created a course first
4. Verify your OpenAI API key has credits

The system should now show much better error messages!
