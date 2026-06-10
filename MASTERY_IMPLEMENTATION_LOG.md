# InStudy 2.0 — Mastery System Overhaul: Implementation Log
> Session date: June 2026
> Documents all changes made, bugs found and fixed, and the current state of the platform.

---

## OVERVIEW

This document records the complete implementation of the new mastery system — from initial design through all 6 phases, including bugs encountered during testing and how each was resolved. It is intended as a reference for anyone continuing work on this platform.

---

## WHAT WAS BUILT (Summary)

A new 4-tier hierarchical mastery tracking system that:

| Before | After |
|--------|-------|
| Flat list of concept strings with rough familiarity scores | 4-tier hierarchy: Course → Document → Concept → Subtopic |
| Mastery score based on one tool alone | XP accumulates from Flashcards + Quiz + AI Tutor, each capped per tool |
| No concept of "100% completion" | 100% is reachable — defined as mastery of all subtopics across all documents |
| Study time = time-on-page (meaningless) | Productive time = heartbeat only when active interaction occurs |
| AI Tutor gains unverified | Trajectory classifier + micro-assessment confirms understanding |
| Mastery page: one long scroll | Mastery page: 4-tab layout (Overview / Course Detail / Review Queue / Progress) |
| Dashboard mastery % = crude formula | Dashboard mastery % = V2 weighted 4-tier calculation |

---

## PHASE-BY-PHASE IMPLEMENTATION

### Phase 1 — Database & Concept Extraction ✅

**New files created:**
- `backend/database/mastery_v2_db.py` — 7 new SQLite tables: `course_documents`, `course_concepts`, `concept_xp`, `concept_mastery_scores`, `mastery_events`, `pending_tutor_xp`, `study_sessions`
- `backend/services/concept_extraction.py` — async LLM-based concept extractor. Parses document text → structured JSON hierarchy (Tier 2: Concept, Tier 3: Subtopic). Computes `document_weight` from concept density.
- `backend/services/mastery_engine.py` — central event processor. All tools call `mastery_engine.log_event()`. No tool writes to mastery tables directly. XP table, immediate negative delta for quiz failures, course mastery snapshot on every event.
- `backend/api/routes/mastery_v2.py` — 15 endpoints at `/api/mastery/v2/...`

**Modified files:**
- `backend/api/routes/documents.py` — registers each upload in `course_documents`, triggers concept extraction as async background task. Skips image files (`.png`, `.jpg` etc.) — they have no extractable concept text.
- `backend/main.py` — registers `mastery_v2` router.

**Key design decisions:**
- Extraction is fully async — upload response returns in milliseconds.
- Each document gets its own concept graph (not merged across documents).
- Document weight = `Σ(concept_weight × subtopic_count)` — denser documents contribute more to course mastery %.
- Mastery % formula: `subtopic → concept → document → course` all use weighted averages.

---

### Phase 2 — Flashcard + Quiz Tool Integration ✅

**Modified files:**
- `backend/services/flashcard_service.py` — adaptive subtopic ordering (weakest first), each generated card tagged with `subtopic_id` and `doc_id` via fuzzy name match.
- `backend/services/quiz_service.py` — adaptive quiz composition (never-quizzed subtopics guaranteed), each question tagged with `subtopic_id` and `doc_id`.
- `backend/api/routes/flashcards.py` — new `POST /flashcards/rate` endpoint. Routes through mastery engine when `subtopic_id` present. Returns `{ xp_earned, mastery_delta, course_mastery_pct, concept_name }`.
- `backend/api/routes/quiz.py` — quiz evaluate fires `mastery_engine.log_quiz_batch()`. Quiz incorrect → `-5.0` immediate mastery delta. Returns `mastery_update` in response.
- `backend/models/schemas.py` — **critical fix**: added `concept`, `subtopic_id`, `doc_id` fields to `QuizQuestion` and `Flashcard` Pydantic models. Without this, Pydantic silently stripped these fields and the frontend never received them.
- `frontend-v2/src/pages/Flashcards.jsx` — `useHeartbeat` hook, upgraded rating to `masteryService.v2.rateFlashcard`, XP toast.
- `frontend-v2/src/pages/Quiz.jsx` — `useHeartbeat` hook, stores `currentDifficulty`, passes it to submit, XP toast.

---

### Phase 3 — AI Tutor Mastery + Micro-Assessment ✅

**New file:**
- `backend/services/tutor_mastery_service.py` — three LLM classifiers:
  1. `_detect_subtopic()` — matches current conversation to a course subtopic by name.
  2. `_classify_trajectory()` — `converging | diverging | off_concept`. Asks multiple questions = NOT automatically diverging; it depends on whether questions build depth or repeat confusion.
  3. `_generate_micro_assessment()` — generates one targeted Q&A pair about the subtopic just discussed.

**Modified files:**
- `backend/api/routes/chat.py` — `ask-stream` now `async`, passes `session_id`, strips RAG generator's `done` event and sends one clean terminal event (`assessment_check` with full data OR plain `done`).
- `backend/services/rag_service.py` — accepts `session_id` parameter.
- `frontend-v2/src/components/AITutorChat.jsx` — `MicroAssessmentCard` component, session UUID management, `assessment_check` SSE handler, `onMessageSent` heartbeat prop.
- `frontend-v2/src/services/api.js` — `chatService.streamMessage` passes `session_id`; `masteryService.v2` namespace added with all V2 endpoints.

---

### Phase 4 — Study Time Heartbeat ✅

**New file:**
- `frontend-v2/src/hooks/useHeartbeat.js` — fires every 30 seconds ONLY if a qualifying interaction occurred in the last 30 seconds. 2-minute idle timeout. Errors silently swallowed.

**Qualifying interactions per tool:**
| Tool | Trigger |
|------|---------|
| Flashcard | Card rated |
| Quiz | Quiz submitted for evaluation |
| AI Tutor | Message sent |
| Document Reader | PDF page image loads |

**Modified files:**
- `frontend-v2/src/pages/Flashcards.jsx` — `useHeartbeat('flashcard')`
- `frontend-v2/src/pages/Quiz.jsx` — `useHeartbeat('quiz')`
- `frontend-v2/src/pages/Workspace.jsx` — `useHeartbeat('tutor')` + `useHeartbeat('reading')`
- `frontend-v2/src/components/DocumentViewer.jsx` — `onPageChange` prop wired to reading heartbeat.

---

### Phase 5 — Daily Mastery Dashboard + New Mastery Page ✅

**`frontend-v2/src/pages/Mastery.jsx` — complete rewrite:**

4-tab layout replacing the old single-scroll page:

| Tab | Content |
|-----|---------|
| **Overview** | Course mastery cards with ring + per-doc mini bars + today's XP banner. First-visit explanation strip (dismissible). |
| **Course Detail** | Full 4-tier tree: Document → Concept → Subtopic with mastery bars + tool XP dots. Re-index button triggers concept extraction. Attention panel shows 5 weakest subtopics. |
| **Review Queue** | Urgency-bucketed stale subtopics (Urgent / Soon / Later) based on forgetting curve. Each item shows decay preview. One-click "Study" links. |
| **Progress** | XP stacked bar chart (30 days), today's activity feed, productive time by tool. |

**`frontend-v2/src/pages/Dashboard.jsx`:**
- Added today's XP strip (shows only when XP > 0, links to Progress tab).
- Aura stale nudge upgraded to use V2 stale subtopics first (more precise).

**`backend/api/routes/stats.py`:**
- Course `mastery` field now reads from `mastery_v2_db.compute_course_mastery()` first. Falls back to legacy formula if V2 has no data.

---

### Phase 6 — Forgetting Curve ✅

All core forgetting curve logic was already in `mastery_v2_db.py` from Phase 1. Phase 6 added the wiring:

- **6.5 Aura nudge** — Dashboard checks V2 stale subtopics on login. Shows which specific subtopic is decaying and by how much.
- **6.6 Mastery-aware Planner** — `planner_service._build_mastery_context()` upgraded to use V2 data: subtopic weights (core/supporting/peripheral), days since last interaction, document-level mastery %, stale/decaying subtopics flagged as URGENT.
- **6.7 Proactive Aura in Workspace** — On workspace open, checks for weakest subtopics in active course. If found, Aura offers to work through it with a Quick Chat pre-filled question.

---

## BUGS FOUND DURING TESTING + RESOLUTIONS

### Bug 1 — `ModuleNotFoundError: No module named 'database.mastery_db'`

**When:** Backend startup crash.

**Cause:** `mastery_db.py` (the original legacy mastery database) was present in the worktree branch but missing from the main working directory. Multiple services still import it for the legacy fallback path.

**Fix:** Copied `mastery_db.py` from `.kilo/worktrees/puzzled-aura/backend/database/mastery_db.py` to `backend/database/mastery_db.py`.

---

### Bug 2 — ECONNRESET on all frontend API calls

**When:** Frontend immediately after backend startup.

**Cause:** Backend was still loading models (sentence-transformers takes 30–90 seconds). Frontend was hitting it before it finished binding to port 8000.

**Fix:** Not a code bug. Wait for backend terminal to show `✅ InStudy 2.0 API is ready!` before testing.

---

### Bug 3 — Mastery page showing nothing after quizzes/flashcards

**When:** Testing mastery after completing a quiz or rating flashcards on an existing course.

**Root cause:** Two-part:
1. Concept extraction hadn't run for existing courses (they existed before the V2 system was deployed). No subtopics in `mastery_v2.db` = no matching = no XP events.
2. Cards/questions generated before re-indexing had `subtopic_id = null` — the V2 path was skipped and only the legacy `mastery.db` was updated (which the new Mastery page doesn't read).

**Fixes:**
- Added `POST /mastery/v2/trigger-extraction/{course_id}` — manually queues concept extraction for all unindexed documents in a course.
- Added **Re-index button** in the Mastery → Course Detail tab header.
- Added **concept name-match fallback** in `flashcards.py /rate` and `quiz.py /evaluate` — when `subtopic_id` is null, matches the card's `concept` label against extracted subtopic names using exact → substring → word-overlap matching. This means cards generated before extraction still earn V2 XP.
- Fixed `thumbnail.png` being swept up by extraction — images are now skipped in both the upload trigger and the manual re-index endpoint.

---

### Bug 4 — Quiz concept labels arriving as `None`

**When:** Quiz evaluation — `concept='None'` for all questions.

**Root cause:** `QuizQuestion` and `Flashcard` Pydantic models in `schemas.py` did NOT include `concept`, `subtopic_id`, or `doc_id` fields. Pydantic silently strips unknown fields when serializing responses. The backend generated these fields correctly, but the frontend never received them. When submitted back for evaluation, the concept was Python `None` → string `'None'` → empty after sanitisation → no match possible.

**Fix:** Added all three fields to both `QuizQuestion` and `Flashcard` in `backend/models/schemas.py`:
```python
concept: Optional[str] = None
subtopic_id: Optional[str] = None
doc_id: Optional[str] = None
```
This was the **root cause of all XP/mastery not being awarded** for quiz and flashcard interactions.

---

### Bug 5 — Micro-assessment card showing but question empty

**When:** AI Tutor micro-assessment checkpoint card appeared in chat but had no visible question.

**Root cause:** Two issues combined:
1. The RAG generator sends a `done` SSE event, then the post-stream hook sends `assessment_check`. The frontend was receiving `done` → finalizing the message → then `assessment_check` (sometimes as a bare event with just `session_id` but no `micro_assessment`) → setting `pendingAssessment` with empty question → rendering the empty card.
2. The `assessment_check` event fired twice — once bare (no assessment data) and once full. The card rendered on the first (empty) event.

**Fix:**
- Chat route now strips the RAG generator's `done` event from the chunk list and sends exactly ONE terminal event: `assessment_check` (with full question data if assessment is ready) OR `done` (if not).
- Frontend handler now guards: `if (data.assessment_ready && data.micro_assessment?.question)` — only renders card when actual question text is present.
- `AnimatePresence` wrapper added — card only renders when `pendingAssessment && pendingAssessment.question`.

---

### Bug 6 — Micro-assessment "dismiss" (X button) awards partial XP

**When:** Closing the quick check notification from Aura orb.

**Root cause:** The Aura orb notification (`triggerAura('pointing', ...)`) has an `action` button. Dismissing the orb bubble called `handleSubmit('skipped')` on the `MicroAssessmentCard` — awarding 40% partial XP. This was because the orb dismiss and the card dismiss were conflated.

**Fix:** The card's close button only dismisses the card UI (`onDismiss`). The Aura notification is separate. Partial XP is only awarded when the student explicitly clicks Skip inside the card itself.

---

### Bug 7 — Course mastery showing old formula values on Dashboard

**When:** Dashboard showing mastery % based on old formula (document count × quiz score).

**Fix:** `backend/api/routes/stats.py` — `get_user_stats()` now calls `mastery_v2_db.compute_course_mastery()` for each course. If V2 returns a non-zero %, uses that. Otherwise falls back to legacy formula (so new/empty courses don't show blank).

---

### Bug 8 — Progress tab data loading before tab is selected

**When:** Progress tab showed empty charts even after earning XP.

**Root cause:** `loadProgress` only fired when the user switched to the Progress tab. If the user went directly to Overview first, the XP banner showed 0.

**Fix:** Progress data also loads when Overview tab is active (non-blocking, updates the daily XP banner asynchronously).

---

## CURRENT STATE OF THE PLATFORM

### ✅ Fully Working

| Feature | Status |
|---------|--------|
| Document upload → async concept extraction | ✅ Working. Backend logs show `[ConceptExtraction] ✅ Complete` |
| Flashcard generation with adaptive subtopic ordering | ✅ Working. Weakest subtopics prioritized |
| Flashcard rating → XP awarded + toast | ✅ Working (requires concept extraction to have run) |
| Quiz generation with adaptive composition | ✅ Working. Never-quizzed subtopics guaranteed |
| Quiz evaluation → XP awarded + toast | ✅ Working (requires schemas.py fix — done) |
| AI Tutor trajectory classification | ✅ Working. `converging | diverging | off_concept` |
| Micro-assessment card in chat | ✅ Working. Shows after 2+ exchanges on a concept |
| XP toasts on all interactions | ✅ Working |
| Heartbeat productive study time | ✅ Working on Flashcards, Quiz, Workspace |
| Mastery page — 4-tab layout | ✅ Working |
| Mastery Overview — course cards with document bars | ✅ Working |
| Mastery Course Detail — 4-tier tree | ✅ Working |
| Mastery Review Queue — urgency-sorted stale subtopics | ✅ Working |
| Mastery Progress tab — XP chart + activity feed | ✅ Working (data merged fix applied) |
| Re-index button for existing courses | ✅ Working |
| Dashboard mastery % from V2 | ✅ Working |
| Dashboard today's XP strip | ✅ Working |
| Forgetting curve — lazy decay on interaction | ✅ Working |
| Forgetting curve — stale subtopic detection | ✅ Working |
| Aura stale nudge on login | ✅ Working (V2 + legacy fallback) |
| Mastery-aware Study Planner | ✅ Working (V2 weighted context) |
| Proactive Aura suggestion in Workspace | ✅ Working |

### ⏳ Pending / Known Limitations

| Item | Notes |
|------|-------|
| Existing courses need manual Re-index | One-time action per course. After clicking Re-index in Course Detail, extraction runs and XP flows automatically on next quiz/flashcard session. |
| `thumbnail.png` in course folders | Extraction correctly skips it now. No action needed. |
| Nightly decay batch | `POST /mastery/v2/apply-decay/{course_id}` exists but no scheduler. Can be triggered manually or via a cron job on the server. |
| Micro-assessment only fires after 2+ exchanges | By design. Single-question sessions don't generate enough signal for trajectory classification. |
| `concept` field quality | The LLM sometimes returns generic concept labels ("Machine Learning" instead of "Support Vector Machines"). Name-match fallback handles this but exact subtopic matches are best — more specific topic labels in prompts would improve matching rate. |

---

## FILES CHANGED IN THIS SESSION

### Backend — New Files
```
backend/database/mastery_v2_db.py
backend/services/mastery_engine.py
backend/services/concept_extraction.py
backend/services/tutor_mastery_service.py
```

### Backend — Restored
```
backend/database/mastery_db.py   ← was missing, copied from worktree
```

### Backend — Modified
```
backend/main.py
backend/models/schemas.py              ← CRITICAL: added concept/subtopic_id/doc_id to Pydantic models
backend/api/routes/documents.py        ← extraction trigger on upload, image skip
backend/api/routes/flashcards.py       ← /rate endpoint, name-match fallback, logging
backend/api/routes/quiz.py             ← /evaluate V2 path, concept name-match, difficulty field
backend/api/routes/mastery_v2.py       ← trigger-extraction endpoint, image file skip
backend/api/routes/chat.py             ← session_id, assessment_check SSE, done event strip
backend/api/routes/stats.py            ← course mastery from V2 db
backend/services/flashcard_service.py  ← adaptive subtopics, subtopic tagging
backend/services/quiz_service.py       ← adaptive composition, subtopic tagging, concept logging
backend/services/rag_service.py        ← session_id parameter
backend/services/planner_service.py    ← V2 mastery context (subtopic weights + decay)
```

### Frontend — New Files
```
frontend-v2/src/hooks/useHeartbeat.js
```

### Frontend — Modified
```
frontend-v2/src/pages/Mastery.jsx           ← complete rewrite, 4-tab layout
frontend-v2/src/pages/Dashboard.jsx         ← today's XP strip, V2 stale nudge
frontend-v2/src/pages/Flashcards.jsx        ← useHeartbeat, V2 rating, concept fix
frontend-v2/src/pages/Quiz.jsx              ← useHeartbeat, difficulty state, XP toast
frontend-v2/src/pages/Workspace.jsx         ← useHeartbeat, proactive Aura, masteryService import
frontend-v2/src/components/AITutorChat.jsx  ← MicroAssessmentCard, session UUID, assessment_check handler
frontend-v2/src/components/DocumentViewer.jsx ← onPageChange prop
frontend-v2/src/services/api.js             ← masteryService.v2 namespace, session_id in streamMessage
```

---

## HOW TO TEST THE FULL FLOW

1. **Start the platform** — `start.bat` → [1] React. Wait for `✅ InStudy 2.0 API is ready!`
2. **For existing courses** — Go to Mastery → Course Detail → click **Re-index**. Wait 30s for backend logs to show `✅ Complete`.
3. **For new courses** — Upload a document. Extraction runs automatically in the background.
4. **Generate flashcards** → rate cards → watch for `+10 XP · [concept name]` toast.
5. **Take a quiz** → complete it → watch for `+[total] XP earned this quiz` toast.
6. **Go to Mastery → Progress tab** → XP bar chart shows today's activity by tool.
7. **Go to Mastery → Course Detail** → document accordion with concept tree and mastery bars.
8. **Go to Dashboard** → course mastery % now reflects real V2 data.
9. **Open Workspace** → Aura will suggest a weak subtopic to study after 3 seconds.

---

*Document compiled: June 2026 — InStudy 2.0 Mastery System Overhaul*
*Status: Phases 1–6 complete. All known bugs resolved.*
