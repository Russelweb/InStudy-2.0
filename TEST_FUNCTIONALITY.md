# Test InStudy 2.0 Functionality

## Prerequisites
- Backend running on http://localhost:8000
- Frontend running on http://localhost:8501
- OPENAI_API_KEY set in backend/.env

## Step-by-Step Test

### 1. Test Backend (2 minutes)

Open terminal and run:
```bash
cd frontend
python test_backend.py
```

Expected output:
```
✅ Backend is running: {'status': 'healthy'}
✅ API docs available at http://localhost:8000/docs
```

### 2. Create Course (30 seconds)

1. Open http://localhost:8501
2. Click "Courses" in sidebar
3. Expand "Create New Course"
4. Enter: "Machine Learning"
5. Click "Create Course"
6. Click "Open" button

Expected: "Opened Machine Learning" message

### 3. Upload Document (1 minute)

1. Click "AI Tutor" in sidebar
2. Expand "Upload Study Material"
3. Click "Browse files"
4. Select: `backend/test_ml.txt`
5. Click "Process Document"

Expected: ✅ test_ml.txt processed (X chunks)

**If it fails:**
- Check backend terminal for error messages
- Verify OPENAI_API_KEY is set
- Make sure you selected a course first

### 4. Ask Question (30 seconds)

1. Still in "AI Tutor" page
2. Type in chat: "What is machine learning?"
3. Press Enter

Expected: 
- AI response with explanation
- Sources shown: test_ml.txt

**If it fails:**
- Check backend terminal
- Verify document was uploaded successfully

### 5. Generate Flashcards (1 minute)

1. Click "Flashcards" in sidebar
2. Set slider to 5 cards
3. Click "Generate Flashcards"

Expected:
- "Generated 5 flashcards!" message
- Card 1/5 displayed
- Can flip and navigate

**If it fails:**
- Make sure document was uploaded
- Check backend terminal for errors

### 6. Generate Quiz (1 minute)

1. Click "Quiz" in sidebar
2. Select: 3 questions, Medium, Mixed
3. Click "Generate Quiz"

Expected:
- "Quiz generated with 3 questions!" message
- Questions displayed
- Can expand to see answers

**If it fails:**
- Make sure document was uploaded
- Check backend terminal for errors

### 7. Generate Summary (30 seconds)

1. Click "Summary" in sidebar
2. Select: "Short"
3. Click "Generate Summary"

Expected:
- Summary displayed
- Can download as TXT

**If it fails:**
- Make sure document was uploaded
- Check backend terminal for errors

## Common Issues & Solutions

### Issue: All features show "Failed"

**Solution:**
1. Restart backend: `uvicorn main:app --reload`
2. Check backend terminal for errors
3. Verify OPENAI_API_KEY in backend/.env

### Issue: "No documents found"

**Solution:**
1. Make sure you created a course
2. Upload a document first
3. Wait for "processed" message

### Issue: "Cannot connect to backend"

**Solution:**
1. Check backend is running: http://localhost:8000/docs
2. Restart backend if needed
3. Check API_URL in frontend/.env

### Issue: OpenAI API errors

**Solution:**
1. Verify API key is correct
2. Check you have credits: https://platform.openai.com/usage
3. Try a different API key

## Success Criteria

✅ Backend health check passes
✅ Can create course
✅ Can upload document
✅ Can ask questions and get answers
✅ Can generate flashcards
✅ Can generate quizzes
✅ Can generate summaries

If all tests pass, InStudy 2.0 is working correctly!

## Getting Help

1. Check backend terminal for detailed error messages
2. See TROUBLESHOOTING_QUICK.md
3. Verify all prerequisites are met
4. Try with the test document first
