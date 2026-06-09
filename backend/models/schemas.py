from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentUpload(BaseModel):
    course_id: str
    user_id: str

class ChatRequest(BaseModel):
    user_id: str
    course_id: str
    question: str
    use_eli12: bool = False

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    has_context: bool

class QuizRequest(BaseModel):
    user_id: str
    course_id: str
    num_questions: int = 5
    difficulty: str = "Medium"
    quiz_type: str = "mixed"

class QuizQuestion(BaseModel):
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    type: str
    concept: Optional[str] = None       # topic label for mastery matching
    subtopic_id: Optional[str] = None   # V2 concept graph ID (if extraction ran)
    doc_id: Optional[str] = None        # V2 document ID

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]

class FlashcardRequest(BaseModel):
    user_id: str
    course_id: str
    num_cards: int = 10

class Flashcard(BaseModel):
    front: str
    back: str
    concept: Optional[str] = None       # topic label for mastery matching
    subtopic_id: Optional[str] = None   # V2 concept graph ID
    doc_id: Optional[str] = None        # V2 document ID
    image_url: Optional[str] = None
    image_type: Optional[str] = None
    alt_text: Optional[str] = None

class FlashcardResponse(BaseModel):
    flashcards: List[Flashcard]

class SummaryRequest(BaseModel):
    user_id: str
    course_id: str
    document_name: Optional[str] = None
    style: str = "short"

class SummaryResponse(BaseModel):
    summary: str
    mind_map: Optional[str] = None

class StudyPlanRequest(BaseModel):
    user_id: str
    course_id: str
    course_name: str
    exam_date: str
    topics: List[str]

class StudyPlanResponse(BaseModel):
    plan: dict
