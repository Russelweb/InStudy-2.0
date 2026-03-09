# Testing InStudy 2.0

## Manual Testing Checklist

### 1. Document Upload
- [ ] Upload PDF file
- [ ] Upload TXT file
- [ ] Upload DOCX file
- [ ] Verify processing completes
- [ ] Check chunk count displayed
- [ ] Try uploading invalid file type (should fail)

### 2. AI Tutor
- [ ] Ask question about uploaded document
- [ ] Verify sources are shown
- [ ] Ask question not in document (general knowledge)
- [ ] Toggle ELI12 mode
- [ ] Verify simplified explanation
- [ ] Check chat history persists

### 3. Flashcards
- [ ] Generate 10 flashcards
- [ ] Navigate forward/backward
- [ ] Flip cards
- [ ] Shuffle cards
- [ ] Verify content quality

### 4. Quiz
- [ ] Generate 5 question quiz
- [ ] Try each difficulty level
- [ ] Try each question type
- [ ] Answer questions
- [ ] Check explanations
- [ ] Submit and verify score

### 5. Summary
- [ ] Generate short summary
- [ ] Generate bullet point summary
- [ ] Generate detailed summary
- [ ] Generate exam revision summary
- [ ] Download summary as TXT

### 6. Study Planner
- [ ] Create study plan
- [ ] Verify weekly breakdown
- [ ] Check daily tasks
- [ ] Review revision tips
- [ ] Review exam tips

### 7. Courses
- [ ] Create new course
- [ ] Switch between courses
- [ ] Verify course isolation (documents don't mix)

### 8. Dashboard
- [ ] View statistics
- [ ] Check recent activity
- [ ] View progress chart

## API Testing

### Using curl

**Health Check:**
```bash
curl http://localhost:8000/health
```

**Upload Document:**
```bash
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@test.pdf" \
  -F "user_id=test_user" \
  -F "course_id=test_course"
```

**Ask Question:**
```bash
curl -X POST http://localhost:8000/api/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "course_id": "test_course",
    "question": "What is machine learning?",
    "use_eli12": false
  }'
```

**Generate Quiz:**
```bash
curl -X POST http://localhost:8000/api/quiz/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "course_id": "test_course",
    "num_questions": 5,
    "difficulty": "Medium",
    "quiz_type": "mixed"
  }'
```

## Performance Testing

### Response Time Targets
- Document upload: < 5 seconds
- AI question: 1-2 seconds
- Quiz generation: 2-3 seconds
- Flashcard generation: 2-3 seconds
- Summary generation: 2-4 seconds

### Load Testing
```bash
# Install Apache Bench
# Test concurrent requests
ab -n 100 -c 10 http://localhost:8000/health
```

## Common Issues

### Issue: "No documents found"
**Solution:** Upload documents first, wait for processing

### Issue: Slow responses
**Solution:** Check OpenAI API status, verify internet connection

### Issue: Poor quiz quality
**Solution:** Upload more comprehensive materials

### Issue: Import errors
**Solution:** Reinstall dependencies: `pip install -r requirements.txt`

## Test Data

Create a test document `test_ml.txt`:
```
Machine Learning is a subset of artificial intelligence that enables systems to learn from data.

Supervised Learning uses labeled data to train models. Examples include classification and regression.

Neural Networks are computing systems inspired by biological neural networks. They consist of layers of interconnected nodes.

Gradient Descent is an optimization algorithm used to minimize the loss function by iteratively adjusting parameters.
```

Use this for testing all features.
