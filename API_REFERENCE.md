# InStudy 2.0 API Reference

Base URL: `http://localhost:8000` (development)

## Authentication
Currently using simplified auth. Add `Authorization: Bearer <token>` header for production.

## Endpoints

### Documents

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

Parameters:
- file: File (PDF, TXT, DOCX)
- user_id: string
- course_id: string

Response:
{
  "message": "Document uploaded successfully",
  "filename": "lecture_notes.pdf",
  "chunks": 42
}
```

#### List Documents
```http
GET /api/documents/list/{user_id}/{course_id}

Response:
{
  "documents": ["lecture1.pdf", "notes.txt"]
}
```

### Chat

#### Ask Question
```http
POST /api/chat/ask
Content-Type: application/json

Body:
{
  "user_id": "string",
  "course_id": "string",
  "question": "string",
  "use_eli12": false
}

Response:
{
  "answer": "Detailed explanation...",
  "sources": ["lecture1.pdf", "notes.txt"],
  "has_context": true
}
```

### Quiz

#### Generate Quiz
```http
POST /api/quiz/generate
Content-Type: application/json

Body:
{
  "user_id": "string",
  "course_id": "string",
  "num_questions": 5,
  "difficulty": "Medium",
  "quiz_type": "mixed"
}

Response:
{
  "questions": [
    {
      "question": "What is gradient descent?",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "Gradient descent is..."
    }
  ]
}
```

**Quiz Types:**
- `multiple_choice`
- `true_false`
- `short_answer`
- `mixed`

**Difficulty Levels:**
- `Easy`
- `Medium`
- `Hard`

### Flashcards

#### Generate Flashcards
```http
POST /api/flashcards/generate
Content-Type: application/json

Body:
{
  "user_id": "string",
  "course_id": "string",
  "num_cards": 10
}

Response:
{
  "flashcards": [
    {
      "front": "What is machine learning?",
      "back": "A subset of AI that enables systems to learn from data..."
    }
  ]
}
```

### Summary

#### Generate Summary
```http
POST /api/summary/generate
Content-Type: application/json

Body:
{
  "user_id": "string",
  "course_id": "string",
  "document_name": "lecture1.pdf",  // optional
  "style": "short"
}

Response:
{
  "summary": "This document covers..."
}
```

**Summary Styles:**
- `short` - 3-5 sentences
- `bullet` - Bullet points
- `detailed` - Comprehensive
- `exam` - Exam-focused

### Study Planner

#### Create Study Plan
```http
POST /api/planner/create
Content-Type: application/json

Body:
{
  "user_id": "string",
  "course_name": "Machine Learning",
  "exam_date": "2024-12-15",
  "topics": ["Neural Networks", "Gradient Descent"]
}

Response:
{
  "plan": {
    "weeks": [
      {
        "week_number": 1,
        "focus": "Neural Networks",
        "days": [
          {
            "day": "Monday",
            "tasks": ["Read chapter 1", "Watch lecture"],
            "duration": "2 hours"
          }
        ]
      }
    ],
    "revision_plan": ["Review notes daily"],
    "exam_tips": ["Practice past papers"]
  }
}
```

## Error Responses

All endpoints return errors in this format:
```json
{
  "detail": "Error message"
}
```

**Common Status Codes:**
- `200` - Success
- `400` - Bad request (invalid input)
- `404` - Not found
- `500` - Server error

## Rate Limits

No rate limits in development. Production should implement:
- 100 requests per minute per user
- 10 document uploads per hour per user

## Data Models

### Document Metadata
```python
{
  "user_id": str,
  "course_id": str,
  "document_name": str,
  "source": str,
  "page": int
}
```

### Vector Store Structure
```
vector_store/
  {user_id}_{course_id}/
    index.faiss
    index.pkl
```

## Testing with Python

```python
import requests

API_URL = "http://localhost:8000"

# Upload document
with open("test.pdf", "rb") as f:
    response = requests.post(
        f"{API_URL}/api/documents/upload",
        files={"file": f},
        data={"user_id": "test", "course_id": "ml"}
    )
    print(response.json())

# Ask question
response = requests.post(
    f"{API_URL}/api/chat/ask",
    json={
        "user_id": "test",
        "course_id": "ml",
        "question": "What is machine learning?",
        "use_eli12": False
    }
)
print(response.json())
```
