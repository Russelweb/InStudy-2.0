# Saved Assets System - Implementation Complete

## ✅ What's Been Implemented

### Backend (Complete)
1. **New Database** (`backend/database/assets_db.py`)
   - SQLite table `saved_assets` with fields: id, user_id, course_id, asset_type, title, data (JSON), created_at, updated_at, metadata
   - Full CRUD operations: save, get, list, update, delete
   - Asset statistics tracking

2. **New API Routes** (`backend/api/routes/assets.py`)
   - `POST /api/assets/save` - Save new asset
   - `GET /api/assets/list` - List all user assets (filterable by type/course)
   - `GET /api/assets/get/{id}` - Get specific asset
   - `PUT /api/assets/update/{id}` - Update asset
   - `DELETE /api/assets/delete/{id}` - Delete asset
   - `GET /api/assets/stats` - Get user statistics

3. **Integration** (`backend/main.py`)
   - Assets router registered at `/api/assets`

### Frontend (Complete)
1. **API Service** (`frontend-v2/src/services/api.js`)
   - `assetService.save()` - Save asset
   - `assetService.list()` - List assets
   - `assetService.get()` - Get asset
   - `assetService.update()` - Update asset
   - `assetService.delete()` - Delete asset
   - `assetService.getStats()` - Get stats

2. **Saved Assets Page** (`frontend-v2/src/pages/SavedAssets.jsx`)
   - Beautiful grid view of all saved assets
   - Filter by type (flashcards, quiz, study_plan, summary)
   - Statistics cards showing count per type
   - Click to load asset back into its page
   - Delete functionality with confirmation

3. **Navigation** (`frontend-v2/src/App.jsx` + `Sidebar.jsx`)
   - New route `/saved-assets`
   - Sidebar link with folder icon

## 🔧 What Still Needs to Be Done

### 1. Add "Save" Buttons to Generation Pages

#### Flashcards (`frontend-v2/src/pages/Flashcards.jsx`)
Add after line 260 (in the HUD stats section):
```jsx
import { assetService } from '../services/api';

// Add state
const [isSaving, setIsSaving] = useState(false);

// Add save handler
const handleSave = async () => {
  if (cards.length === 0) return;
  
  const title = prompt('Name this flashcard deck:');
  if (!title) return;
  
  setIsSaving(true);
  try {
    await assetService.save(
      currentDeckId,
      'flashcards',
      title,
      { cards, settings },
      { card_count: cards.length }
    );
    alert('✅ Flashcard deck saved!');
  } catch (error) {
    alert('Failed to save deck');
  } finally {
    setIsSaving(false);
  }
};

// Add button in the HUD stats section (after the stats cards):
<button
  onClick={handleSave}
  disabled={cards.length === 0 || isSaving}
  className="px-4 py-2 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all disabled:opacity-50"
>
  <span className="material-symbols-outlined text-sm mr-1">save</span>
  {isSaving ? 'Saving...' : 'Save Deck'}
</button>
```

#### Quiz (`frontend-v2/src/pages/Quiz.jsx`)
Add in the `QuizEvaluation` component (after the results display):
```jsx
import { assetService } from '../services/api';

const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  const title = prompt('Name this quiz:');
  if (!title) return;
  
  setIsSaving(true);
  try {
    await assetService.save(
      selectedCourse,
      'quiz',
      title,
      { questions: currentQuestions, results: evaluationResults },
      { score: evaluationResults.score_percentage, total_questions: evaluationResults.total_questions }
    );
    alert('✅ Quiz saved!');
  } catch (error) {
    alert('Failed to save quiz');
  } finally {
    setIsSaving(false);
  }
};

// Add button in the evaluation view (after the restart buttons):
<button
  onClick={handleSave}
  disabled={isSaving}
  className="flex-1 py-4 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold shadow-lg hover:bg-secondary/20 transition-all text-xs uppercase tracking-widest"
>
  {isSaving ? 'Saving...' : 'Save Quiz'}
</button>
```

#### Study Planner (`frontend-v2/src/pages/Planner.jsx`)
Add in the timeline view (in the header section):
```jsx
import { assetService } from '../services/api';

const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  const title = prompt('Name this study plan:');
  if (!title) return;
  
  setIsSaving(true);
  try {
    await assetService.save(
      selectedCourse,
      'study_plan',
      title,
      { plan, examDate, topics, completedTasks },
      { exam_date: examDate, topic_count: topics.length }
    );
    alert('✅ Study plan saved!');
  } catch (error) {
    alert('Failed to save plan');
  } finally {
    setIsSaving(false);
  }
};

// Add button in the timeline header (after the print button):
<button
  onClick={handleSave}
  disabled={isSaving}
  className="px-5 py-3 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all"
>
  {isSaving ? 'Saving...' : 'Save Plan'}
</button>
```

### 2. Load Saved Assets Back Into Pages

Each page needs to check for `load_asset_{type}` in localStorage on mount:

#### Flashcards
```jsx
useEffect(() => {
  const loadedAsset = localStorage.getItem('load_asset_flashcards');
  if (loadedAsset) {
    try {
      const asset = JSON.parse(loadedAsset);
      setCards(asset.data.cards || []);
      setSettings(asset.data.settings || settings);
      setCurrentDeckId(asset.course_id);
      setShowSettings(false);
      localStorage.removeItem('load_asset_flashcards');
    } catch (e) {
      console.error('Failed to load asset:', e);
    }
  }
}, []);
```

#### Quiz
```jsx
useEffect(() => {
  const loadedAsset = localStorage.getItem('load_asset_quiz');
  if (loadedAsset) {
    try {
      const asset = JSON.parse(loadedAsset);
      setCurrentQuestions(asset.data.questions || []);
      setEvaluationResults(asset.data.results || null);
      setSelectedCourse(asset.course_id);
      setPhase(asset.data.results ? 'evaluation' : 'assessment');
      localStorage.removeItem('load_asset_quiz');
    } catch (e) {
      console.error('Failed to load asset:', e);
    }
  }
}, []);
```

#### Planner
```jsx
useEffect(() => {
  const loadedAsset = localStorage.getItem('load_asset_study_plan');
  if (loadedAsset) {
    try {
      const asset = JSON.parse(loadedAsset);
      setPlan(asset.data.plan || null);
      setExamDate(asset.data.examDate || examDate);
      setTopics(asset.data.topics || []);
      setCompletedTasks(asset.data.completedTasks || {});
      setSelectedCourse(asset.course_id);
      setStep('timeline');
      localStorage.removeItem('load_asset_study_plan');
    } catch (e) {
      console.error('Failed to load asset:', e);
    }
  }
}, []);
```

### 3. Auto-Save on Logout (10-Minute Timer)

Add to `frontend-v2/src/services/api.js`:

```jsx
// Auto-save timer - starts when user logs out
let autoSaveTimer = null;

export const startAutoSaveTimer = () => {
  // Clear any existing timer
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  
  // Set 10-minute timer
  autoSaveTimer = setTimeout(async () => {
    console.log('Auto-saving session data...');
    
    // Check for unsaved flashcards
    const flashcardCards = localStorage.getItem('flashcards_cards');
    const flashcardDeck = localStorage.getItem('flashcards_deck_id');
    if (flashcardCards && flashcardDeck) {
      try {
        const cards = JSON.parse(flashcardCards);
        if (cards.length > 0) {
          await assetService.save(
            flashcardDeck,
            'flashcards',
            `Auto-saved ${new Date().toLocaleString()}`,
            { cards, auto_saved: true },
            { card_count: cards.length }
          );
        }
      } catch (e) {
        console.error('Auto-save flashcards failed:', e);
      }
    }
    
    // Check for unsaved quiz
    const quizQuestions = localStorage.getItem('quiz_questions');
    const quizCourse = localStorage.getItem('quiz_selected_course');
    const quizResults = localStorage.getItem('quiz_results');
    if (quizQuestions && quizCourse) {
      try {
        const questions = JSON.parse(quizQuestions);
        const results = quizResults ? JSON.parse(quizResults) : null;
        if (questions.length > 0) {
          await assetService.save(
            quizCourse,
            'quiz',
            `Auto-saved ${new Date().toLocaleString()}`,
            { questions, results, auto_saved: true },
            { total_questions: questions.length }
          );
        }
      } catch (e) {
        console.error('Auto-save quiz failed:', e);
      }
    }
    
    // Check for unsaved study plan
    const planData = localStorage.getItem('planner_plan');
    const planCourse = localStorage.getItem('planner_course');
    if (planData && planCourse) {
      try {
        const plan = JSON.parse(planData);
        const examDate = localStorage.getItem('planner_date');
        const topics = JSON.parse(localStorage.getItem('planner_topics') || '[]');
        const completedTasks = JSON.parse(localStorage.getItem('planner_completed_tasks') || '{}');
        
        await assetService.save(
          planCourse,
          'study_plan',
          `Auto-saved ${new Date().toLocaleString()}`,
          { plan, examDate, topics, completedTasks, auto_saved: true },
          { exam_date: examDate }
        );
      } catch (e) {
        console.error('Auto-save plan failed:', e);
      }
    }
    
    console.log('Auto-save complete');
  }, 10 * 60 * 1000); // 10 minutes
};

// Update logout function
authService.logout = () => {
  startAutoSaveTimer(); // Start the timer
  API.post('/auth/logout').catch(() => {});
  // Don't clear localStorage immediately - let auto-save run first
  setTimeout(() => {
    localStorage.clear();
    window.location.href = '/login';
  }, 500);
};
```

## 📊 Database Schema

```sql
CREATE TABLE saved_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    asset_type TEXT NOT NULL,  -- 'flashcards', 'quiz', 'study_plan', 'summary'
    title TEXT NOT NULL,
    data TEXT NOT NULL,  -- JSON blob with the actual content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT  -- Optional JSON for quick stats (card_count, score, etc.)
);

CREATE INDEX idx_user_assets ON saved_assets(user_id, asset_type);
```

## 🎯 User Flow

1. **Generate Content**: User generates flashcards/quiz/study plan
2. **Save**: Click "Save" button → Enter title → Saved to database
3. **Browse**: Navigate to "Saved Assets" page → See all saved items
4. **Load**: Click on saved asset → Loads back into original page with all data
5. **Auto-Save**: On logout → 10-minute timer → Auto-saves any unsaved work

## 🚀 Next Steps

1. Add the save buttons to all 3 pages (copy code from above)
2. Add the load logic to all 3 pages (copy code from above)
3. Implement the auto-save timer in api.js
4. Test the full flow
5. Optional: Add "Edit Title" functionality to saved assets page

## 📝 Notes

- All saved data persists across sessions
- Users can have unlimited saved assets
- Auto-save prevents data loss on logout
- Assets are user-specific (verified by auth token)
- Metadata field allows quick filtering without parsing full JSON
