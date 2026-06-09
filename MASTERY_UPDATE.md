# InStudy 2.0 — Mastery System Overhaul
> Full implementation plan compiled from design session — June 2026
> Follow phases in order. Do not skip ahead.

---

## OVERVIEW

The goal is to replace the current flat, tool-siloed mastery tracking with a hierarchical, cross-tool, XP-driven mastery system that:
- Accurately reflects a student's real understanding of course material
- Tracks progress toward genuine course completion (100% is reachable and meaningful)
- Links all study tools (Flashcards, Quiz, AI Tutor) into one unified mastery engine
- Displays granular daily progress so students can feel and see their growth
- Lays the foundation for future gamification (leaderboards, streaks, unlocks)

**Start fresh** — new tables, new schema, clean data. Existing mastery data is not migrated.

---

## ARCHITECTURE OVERVIEW

### 4-Tier Concept Hierarchy

Each course can have multiple documents. Each document contributes its own concept graph. Mastery rolls upward through all four tiers.

```
Course (e.g. "Organic Chemistry")                  ← Tier 0
│
├── Document (e.g. "lecture_1.pdf")                ← Tier 1
│   ├── Concept (e.g. "Reaction Mechanisms")       ← Tier 2
│   │   ├── Subtopic (e.g. "SN1 Reactions")        ← Tier 3
│   │   ├── Subtopic (e.g. "SN2 Reactions")        ← Tier 3
│   │   └── Subtopic (e.g. "E1 vs E2 Elimination") ← Tier 3
│   └── Concept (e.g. "Stereochemistry")           ← Tier 2
│       ├── Subtopic (e.g. "Chirality")             ← Tier 3
│       └── Subtopic (e.g. "R/S Configuration")    ← Tier 3
│
├── Document (e.g. "lecture_2.pdf")                ← Tier 1
│   └── Concept (e.g. "Functional Groups")         ← Tier 2
│       ├── Subtopic (e.g. "Alkenes and Alkynes")  ← Tier 3
│       └── Subtopic (e.g. "Carbonyl Compounds")   ← Tier 3
│
└── Document (e.g. "textbook_ch3.pdf")             ← Tier 1
    └── Concept (e.g. "Reaction Mechanisms")       ← Tier 2 (same concept, different doc)
        └── Subtopic (e.g. "Carbocation Stability") ← Tier 3 (new subtopic merged in)
```

**Mastery rolls upward through all 4 tiers:**
- Subtopic XP → Subtopic Mastery %
- Subtopic Mastery % (weighted avg) → Concept Mastery %
- Concept Mastery % (weighted avg) → Document Mastery %
- Document Mastery % (weighted avg by document density) → Course Mastery %

**Why this matters:**
- A student who uploads 4 documents but only studies 2 will see a realistic course mastery that reflects the untouched material
- Adding a new document to a course correctly dilutes the overall mastery % — there is now more to learn
- Students can clearly see per-document progress: *"lecture_1.pdf: 80% · lecture_2.pdf: 20% · textbook_ch3.pdf: 5%"*
- Document weight is proportional to the total weighted concept points extracted from it — a dense textbook chapter contributes more than a one-page handout

**Concept Overlap Across Documents:**
- The same concept name (e.g. "Reaction Mechanisms") can appear in multiple documents
- Each document gets its own instance of that concept in the concept graph — they are NOT merged
- This is intentional: the student must demonstrate mastery of "Reaction Mechanisms" as covered in EACH document separately
- However, the mastery UI groups them visually under the concept name to avoid confusion

### XP vs Mastery % — Two Parallel Metrics

| Metric | What It Measures | Who Sees It |
|--------|-----------------|-------------|
| XP Points (integer) | Effort + engagement | Student (motivational, visible on every action) |
| Mastery % (0–100) | Demonstrated understanding | Student + Dashboard (course completion signal) |

These are related but not the same. A student can earn XP for effort but still have a low mastery % if they keep failing quiz questions on the same concept.

---

## MASTERY SCORE FORMULA

```
subtopic_mastery (%)   = min(subtopic_xp / subtopic_xp_cap, 1.0) × 100

concept_mastery (%)    = Σ(subtopic_mastery × subtopic_weight) / Σ(subtopic_weight)
                         for all subtopics under that concept in that document

document_mastery (%)   = Σ(concept_mastery × concept_weight) / Σ(concept_weight)
                         for all concepts extracted from that document

document_weight        = Σ(concept_weight × subtopic_count) for that document
                         (denser documents carry more weight in the course total)

course_mastery (%)     = Σ(document_mastery × document_weight) / Σ(document_weight)
                         for all documents in the course
```

**Example:**
- Course has 3 documents: lecture_1 (dense, 60 weighted points), lecture_2 (medium, 40 points), handout (light, 15 points)
- Document weights: lecture_1 = 0.52, lecture_2 = 0.35, handout = 0.13
- If student has mastered lecture_1 fully (100%), lecture_2 partially (50%), handout untouched (0%):
  - Course mastery = (100 × 0.52) + (50 × 0.35) + (0 × 0.13) = 52 + 17.5 + 0 = **69.5%**
- This is honest — they haven't finished the course, and the number reflects that

### Concept/Subtopic Weights
| Classification | Weight Multiplier |
|---------------|------------------|
| core          | 3×               |
| supporting    | 2×               |
| peripheral    | 1×               |

### Per-Subtopic XP Cap (100 XP max per subtopic)
| Source        | Max XP Contribution |
|---------------|-------------------|
| Flashcards    | 30 XP             |
| Quiz          | 40 XP             |
| AI Tutor      | 30 XP             |
| **Total cap** | **100 XP**        |

This forces multi-tool engagement. No single tool can fully master a subtopic alone.

### Forgetting Curve (Ebbinghaus — retained from current system)
- Subtopic mastery scores decay over time using exponential decay: `R(t) = R(0) × e^(-t/S)`
- Memory strength `S` is proportional to mastery level (well-mastered concepts decay slower)
- Decay is applied lazily (on next interaction) or via a nightly batch job

---

## XP EARN RATES BY TOOL

### Quiz
| Action | XP | Notes |
|--------|----|-------|
| Correct answer (easy) | 10 XP | |
| Correct answer (medium) | 15 XP | |
| Correct answer (hard) | 25 XP | |
| Incorrect answer | 0 XP | Mastery score on that subtopic drops |

### Flashcards
| Action | XP | Notes |
|--------|----|-------|
| Rated "Mastered" | 10 XP | |
| Rated "Familiar" | 5 XP | |
| Rated "Unfamiliar" | 0 XP | |

### AI Tutor (via Micro-Assessment)
| Outcome | XP | Notes |
|---------|----|-------|
| Micro-assessment correct | 12 XP | Full credit — understanding confirmed |
| Micro-assessment skipped | 5 XP | Engagement credit only |
| Micro-assessment incorrect | 0 XP | Concept flagged for reinforcement |

### Document Reading
| Action | XP | Notes |
|--------|----|-------|
| Page confirmed read (heartbeat) | 2 XP | Low — engagement only, not understanding |

---

## AI TUTOR MASTERY LOGIC (detailed)

### Conversation Trajectory Classification
At the end of a concept thread in the tutor, the LLM classifies the conversation:

| Trajectory | Description | Outcome |
|------------|-------------|---------|
| Converging | Each follow-up narrows in, builds on previous answer. Student is integrating the concept. | Solid understanding → full XP pending |
| Diverging | Student keeps re-asking variations of the same basic question. Explanation not landing. | Partial understanding → reduced XP pending |
| Off-concept | Conversation drifts away from the original concept entirely. | No XP pending |

### Pending XP System
- Tutor sessions generate **pending XP** — unconfirmed credit
- Pending XP is confirmed or denied by the **micro-assessment**
- Pending XP expires after 24 hours if no micro-assessment is taken

### Micro-Assessment (Option C: Orb pulse + chat checkpoint)
Triggered when a concept thread ends with `partial` or `solid` classification:

1. Aura orb pulses to draw attention
2. A "checkpoint" card appears at the bottom of the AI Tutor chat thread
3. Card contains one targeted question about the specific subtopic just discussed
4. Student answers inline

**Results:**
- Correct → pending XP awarded in full, subtopic mastery score increases
- Incorrect → pending XP halved, subtopic flagged for reinforcement
- Skipped → 40% of pending XP awarded (engagement credit, no understanding confirmation)

**Important nuance:** Repeated questions in the tutor are NOT classified as negative by default.
- Asking deeper follow-up questions = converging = good
- The nature and trajectory of the conversation determines the outcome, not the question count

---

## DATABASE SCHEMA (new tables)

### `course_documents` — Document Registry Per Course
```sql
CREATE TABLE course_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,              -- UUID, unique per document
    filename TEXT NOT NULL,            -- original uploaded filename
    display_name TEXT,                 -- optional friendly name
    document_weight REAL DEFAULT 1.0,  -- computed from total weighted concept points
    extraction_status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'complete' | 'failed'
    extracted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id, doc_id)
);
```

### `course_concepts` — The Concept Graph (4-tier)
```sql
CREATE TABLE course_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,              -- which document this came from (Tier 1)
    concept_id TEXT NOT NULL,          -- UUID
    concept_name TEXT NOT NULL,        -- e.g. "Reaction Mechanisms"
    parent_concept_id TEXT,            -- NULL for Tier 2 concepts, concept_id for subtopics
    tier INTEGER NOT NULL,             -- 2 = Concept, 3 = Subtopic
    weight TEXT DEFAULT 'supporting',  -- 'core' | 'supporting' | 'peripheral'
    xp_cap INTEGER DEFAULT 100,        -- max XP for this node (subtopics only)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, user_id, doc_id, concept_id)
);
```

### `concept_xp` — XP Earned Per Subtopic
```sql
CREATE TABLE concept_xp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,              -- which document this subtopic belongs to
    concept_id TEXT NOT NULL,          -- references course_concepts.concept_id (subtopic)
    tool TEXT NOT NULL,                -- 'flashcard' | 'quiz' | 'tutor' | 'reading'
    xp_earned INTEGER NOT NULL,
    xp_source TEXT,                    -- e.g. 'correct_hard', 'micro_assessment', 'mastered'
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES course_concepts(concept_id)
);
```

### `concept_mastery_scores` — Computed Mastery Per Subtopic
```sql
CREATE TABLE concept_mastery_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    mastery_pct REAL DEFAULT 0.0,      -- 0.0 to 100.0
    total_xp INTEGER DEFAULT 0,
    flashcard_xp INTEGER DEFAULT 0,
    quiz_xp INTEGER DEFAULT 0,
    tutor_xp INTEGER DEFAULT 0,
    reading_xp INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id, doc_id, concept_id)
);
```

### `mastery_events` — Full Event Log (audit trail + daily breakdown)
```sql
CREATE TABLE mastery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,          -- subtopic level
    event_type TEXT NOT NULL,          -- 'quiz_correct' | 'quiz_incorrect' | 'flashcard_mastered' etc.
    xp_delta INTEGER DEFAULT 0,        -- XP change (positive or zero)
    mastery_delta REAL DEFAULT 0.0,    -- Mastery % change on this subtopic (can be negative)
    course_mastery_after REAL,         -- snapshot of course mastery % after this event
    tool TEXT NOT NULL,
    difficulty TEXT,                   -- for quiz events
    metadata TEXT,                     -- JSON blob for extra context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `pending_tutor_xp` — Unconfirmed Tutor Session Credit
```sql
CREATE TABLE pending_tutor_xp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    session_id TEXT NOT NULL,          -- groups a tutor conversation thread
    pending_xp INTEGER NOT NULL,
    trajectory TEXT NOT NULL,          -- 'converging' | 'diverging'
    assessment_question TEXT,          -- the micro-assessment question
    assessment_answer TEXT,            -- correct answer
    status TEXT DEFAULT 'pending',     -- 'pending' | 'confirmed' | 'denied' | 'expired'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP               -- 24 hours after creation
);
```

### `study_sessions` — Productive Time Tracking
```sql
CREATE TABLE study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    doc_id TEXT,                       -- NULL if not document-specific (e.g. quiz)
    tool TEXT NOT NULL,                -- 'flashcard' | 'quiz' | 'tutor' | 'reading' | 'inspace'
    productive_seconds INTEGER DEFAULT 0,
    session_date DATE DEFAULT (DATE('now')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## CONCEPT EXTRACTION PIPELINE

### Trigger
- Fires automatically when a document is uploaded to a course
- Runs **async** (does not block the upload response)
- Creates a `course_documents` entry with `extraction_status = 'processing'`
- On completion, sets `extraction_status = 'complete'` and computes `document_weight`
- Re-runs when new documents are added — each document gets its own concept graph entry
- Concepts from different documents are NEVER merged — each document owns its own concept nodes
- The UI groups same-named concepts across documents visually, but the data stays separate

### Extraction Prompt Output Format (per document)
```json
{
  "document": "lecture_1.pdf",
  "concepts": [
    {
      "name": "Reaction Mechanisms",
      "weight": "core",
      "subtopics": [
        { "name": "SN1 Reactions", "weight": "core" },
        { "name": "SN2 Reactions", "weight": "core" },
        { "name": "E1 vs E2 Elimination", "weight": "supporting" }
      ]
    },
    {
      "name": "Stereochemistry",
      "weight": "supporting",
      "subtopics": [
        { "name": "Chirality", "weight": "core" },
        { "name": "R/S Configuration", "weight": "supporting" }
      ]
    }
  ]
}
```

### Document Weight Calculation (after extraction)
```
document_weight = Σ(concept_weight_value × subtopic_count_in_concept)
                  for all concepts in the document

where: core = 3, supporting = 2, peripheral = 1
```
A document with 3 core concepts (avg 4 subtopics each) and 2 supporting concepts (avg 3 subtopics each) scores: `(3×3×4) + (2×2×3) = 36 + 12 = 48 weight points`. This is its proportional share of the course mastery.

### Expected Scale Per Document
- 5–15 top-level concepts per document
- 3–8 subtopics per concept
- A full course (3 documents) → ~150–200 subtopics total
- 100% mastery requires engagement with all subtopics in all documents across all tools

---

## STUDY TIME ACCURACY

### Frontend Heartbeat System
- Heartbeat fires every **30 seconds** — but ONLY if a qualifying interaction occurred in the last 30 seconds
- Idle tab with no interaction = no heartbeat = no time logged

### Qualifying Interactions (what counts as productive study)
| Interaction | Counts? |
|-------------|---------|
| Quiz answer submitted | ✅ |
| Flashcard rated | ✅ |
| AI Tutor message sent + response received | ✅ |
| Document page changed (scroll confirmed) | ✅ |
| Tab open, no interaction for 2+ minutes | ❌ |
| Just hovering/reading without page change | ❌ |

### Backend
- Receives: `{ course_id, tool, duration_seconds: 30 }`
- Logs to `study_sessions` table
- Daily productive time = sum of all heartbeat durations for that day

---

## DAILY MASTERY DASHBOARD (new API + UI)

### New API Endpoints Required
```
GET  /mastery/daily/{course_id}              — Today's XP + mastery delta per concept
GET  /mastery/daily-breakdown/{course_id}    — Per-subtopic breakdown for today
GET  /mastery/course-graph/{course_id}       — Full 4-tier hierarchy with mastery scores per node
GET  /mastery/document-graph/{course_id}/{doc_id} — Single document's concept tree + mastery
GET  /mastery/xp-summary/{course_id}         — Total XP by tool, by day
POST /mastery/heartbeat                      — Log productive study time
POST /mastery/micro-assessment/{session_id}  — Submit micro-assessment answer
```

### What the Daily View Shows Per Course
- Total XP earned today (big number, prominent)
- Mastery % change today (+X.X%) at the course level
- **Per-document progress** — each document shown as its own bar: `lecture_1.pdf 80% · lecture_2.pdf 20%`
- Per-concept progress within each document: which concepts moved today and by how much
- Per-subtopic detail: which subtopics earned XP today and from which tool
- Which tool contributed most today
- Flagged subtopics (quiz failures, repeated tutor confusion)

### Frontend XP Toast (motivational layer)
- Every mastery event response includes: `{ xp_earned: 12, concept: "SN1 Reactions", course_mastery_delta: +0.3 }`
- Frontend shows a floating "+12 XP" toast anchored near the interaction that caused it
- Not a generic notification — visually tied to the specific card/question/chat message
- This is the foundation for future social leaderboards and streaks

---

## IMPLEMENTATION PHASES

---

### PHASE 1 — Database & Concept Extraction
**Goal:** Build the foundation. Nothing else works without this.

**Tasks:**
- [x] 1.1 — Create new `mastery_v2.db` with all 7 new tables (course_documents, course_concepts, concept_xp, concept_mastery_scores, mastery_events, pending_tutor_xp, study_sessions)
- [x] 1.2 — Write `ConceptExtractionService` — takes document chunks, calls LLM, returns structured 4-tier concept hierarchy JSON per document
- [x] 1.3 — Wire extraction to document upload pipeline (async background task, does not block upload response)
- [x] 1.4 — Write `course_documents` registration logic — each uploaded document gets a `doc_id` and `extraction_status`; weight computed post-extraction
- [x] 1.5 — Write `MasteryCalculator` — computes subtopic → concept → document → course mastery % from XP tables using weighted formula at all 4 tiers
- [x] 1.6 — Write `MasteryEngine` — central class all tools call to log events. No tool writes to mastery tables directly anymore. Every event carries `doc_id` and `concept_id`.
- [x] 1.7 — Add `GET /mastery/v2/course-graph/{course_id}` endpoint — returns full 4-tier hierarchy with current mastery scores per node
- [x] 1.8 — Add `GET /mastery/v2/document-graph/{course_id}/{doc_id}` endpoint — single document's concept tree with mastery scores

---

### PHASE 2 — Tool Integration (Flashcards + Quiz)
**Goal:** Connect the two highest-signal tools to the new mastery engine, with adaptive generation built in from day one.

**Tasks:**
- [x] 2.1 — Tag flashcard generation: each generated card is assigned to a subtopic from the course concept graph
- [x] 2.2 — **Adaptive flashcard ordering**: when generating a deck, sort subtopic selection by (1) lowest mastery % first, (2) longest time since last interaction, (3) core weight before peripheral. Students always work on their weakest material first.
- [x] 2.3 — Update flashcard rating endpoint to call `MasteryEngine.log_event('flashcard_mastered' | 'flashcard_familiar' | 'flashcard_unfamiliar', subtopic_id, xp)`
- [x] 2.4 — Tag quiz question generation: each question is assigned to a subtopic from the course concept graph
- [x] 2.5 — **Adaptive quiz composition**: weak subtopics (low mastery %, never quizzed, or recently failed) get more question slots. A subtopic with `quiz_xp = 0` is guaranteed at least one question. Difficulty scales with current mastery — low mastery subtopics get easier questions first.
- [x] 2.6 — Update quiz evaluation endpoint to call `MasteryEngine.log_event('quiz_correct' | 'quiz_incorrect', subtopic_id, xp, difficulty)`
- [x] 2.7 — Quiz incorrect answer → mastery score reduction on that subtopic (not just zero XP)
- [x] 2.8 — Implement per-tool XP caps per subtopic (30 flashcard / 40 quiz / 30 tutor max per subtopic)
- [x] 2.9 — Add XP delta to quiz evaluate and flashcard rate API responses (`{ xp_earned, concept_name, course_mastery_delta }`)
- [ ] 2.10 — **Adaptive surface in UI**: on Flashcards and Quiz config pages, show a "Focus on weak areas" toggle (on by default) that enables adaptive subtopic selection. Student can override to choose a specific concept or document if they prefer.

---

### PHASE 3 — AI Tutor Mastery + Micro-Assessment
**Goal:** Make tutor interactions contribute meaningfully to mastery without rewarding passive chat.

**Tasks:**
- [x] 3.1 — Add conversation trajectory classifier: at the end of a concept thread, LLM call classifies as `converging | diverging | off_concept`
- [x] 3.2 — Add subtopic detector: classify which subtopic from the course graph the current tutor thread is about
- [x] 3.3 — Implement `pending_tutor_xp` flow: on `converging` or `diverging` end-of-thread, write pending XP record + generate micro-assessment question
- [x] 3.4 — Add `POST /mastery/micro-assessment/{session_id}` endpoint — accepts student answer, evaluates, confirms/denies pending XP
- [x] 3.5 — Add pending XP expiry job (24-hour expiry → auto-expire to 0 XP)
- [x] 3.6 — Frontend: Aura orb pulses when micro-assessment is ready
- [x] 3.7 — Frontend: Checkpoint card appears at bottom of AI Tutor chat thread with inline answer input
- [x] 3.8 — Frontend: XP delta toast fires after micro-assessment result

---

### PHASE 4 — Study Time Heartbeat
**Goal:** Replace meaningless time-on-page with productive interaction time.

**Tasks:**
- [x] 4.1 — Frontend: implement heartbeat manager (fires every 30s if qualifying interaction in last 30s)
- [x] 4.2 — Frontend: define qualifying interactions per tool (quiz answer, flashcard rate, tutor message, doc page change)
- [x] 4.3 — Backend: `POST /mastery/heartbeat` endpoint — logs to `study_sessions`
- [x] 4.4 — Backend: daily productive time query per course
- [x] 4.5 — Remove old time-on-page tracking from stats/activity endpoint (demoted to legacy — V2 heartbeat is now the source of truth for productive time)

---

### PHASE 5 — Daily Mastery Dashboard
**Goal:** Surface the new mastery data in the UI so students can see and feel daily progress.

**Tasks:**
- [x] 5.1 — Backend: `GET /mastery/daily/{course_id}` — today's XP, mastery delta, top concepts moved
- [x] 5.2 — Backend: `GET /mastery/daily-breakdown/{course_id}` — per-subtopic breakdown for today
- [x] 5.3 — Backend: `GET /mastery/xp-summary/{course_id}` — XP by tool and by day (for chart)
- [x] 5.4 — Frontend Mastery page: complete 4-tab redesign (Overview / Course Detail / Review Queue / Progress) — daily XP banner on Overview, prominent XP strip on first load
- [x] 5.5 — Frontend Mastery page: per-document accordion — each document shows its own mastery bar and expands to show concept → subtopic breakdown with per-tool XP dots
- [x] 5.6 — Frontend Mastery page: today's activity feed (Progress tab — subtopics touched, tools used, XP + mastery delta per subtopic)
- [x] 5.7 — Frontend: XP toasts wired in Phases 2 + 4 (flashcard rate, quiz evaluate, micro-assessment all return xp_earned and call showToast)
- [x] 5.8 — Frontend Dashboard: today's mastery XP summary strip — shows per-course XP earned today + mastery % gained, links to Progress tab

---

### PHASE 6 — Forgetting Curve (applied to new system)
**Goal:** Re-apply Ebbinghaus decay logic to the new per-subtopic scores.

**Tasks:**
- [ ] 6.1 — Port forgetting curve formula to `MasteryCalculator` operating on subtopic scores
- [ ] 6.2 — Decay applied lazily on next interaction with a subtopic
- [ ] 6.3 — Add nightly batch endpoint `POST /mastery/apply-decay-all` (admin-triggered or cron)
- [ ] 6.4 — Stale subtopic detection: flag subtopics not touched in 14+ days
- [ ] 6.5 — Aura nudge: if a student has stale high-value (core weight) subtopics, Aura shows nudge on login
- [ ] 6.6 — **Adaptive planner integration**: Study Planner reads `concept_mastery_scores` and `course_documents` to weight the schedule toward weak documents and subtopics. Core subtopics below 40% mastery get priority slots. Documents with low overall mastery get earlier placement in the plan. Mastered subtopics (>85%) get brief review slots only, not full study blocks.
- [ ] 6.7 — **Proactive Aura suggestions**: when a student opens the AI Tutor without a specific question, Aura checks for the 3 most decayed or weakest subtopics in the active course and offers to work through one of them. "You haven't touched Stereochemistry in 11 days — want to review it?"

---

## CROSS-TOOL MASTERY INTERACTION RULES

| Scenario | Effect |
|----------|--------|
| Student aces quiz on concept X after tutor session on X | Tutor pending XP confirmed + quiz XP awarded. Mastery % jumps. |
| Student fails quiz on concept X despite flashcard mastery on X | Quiz failure reduces mastery % on X. Concept flagged. XP from flashcards not reversed but mastery score drops. |
| Student asks repeated questions on concept X in tutor | Trajectory analyzed. Converging = good. Diverging = reduced pending XP. No negative signal from question count alone. |
| Student opens tutor, asks 1 question, leaves without micro-assessment | Minimal pending XP expires after 24h. Study session time logged (1 interaction = ~30s productive). |
| Student reads document pages without any tool interaction | 2 XP per confirmed page read. Very low ceiling. Cannot master a concept by reading alone. |
| Student completes all subtopics in a concept across all tools | Concept mastery approaches 100%. Document and course mastery rise proportionally. |
| Student generates flashcards with "Focus on weak areas" ON (default) | Cards are drawn from lowest-mastery subtopics first, prioritizing core-weight concepts and those decaying fastest. |
| Student generates a quiz with adaptive mode ON (default) | Weak subtopics get more question slots. Subtopics with zero quiz XP are guaranteed to appear. Difficulty matches current mastery level. |
| Student opens AI Tutor without a question | Aura proactively surfaces the 3 weakest/most-decayed subtopics in the active course and offers to work through one. |
| Student adds a new document to a course | Course mastery % drops (new material added to the denominator). Flashcard and quiz generation immediately includes new subtopics. Planner re-weights schedule toward new material. |

---

## DEFINITION OF 100% COURSE MASTERY

A student reaches 100% course mastery when:
- Every document in the course has been fully processed (extraction complete)
- All subtopics in every document's concept graph have been engaged with across multiple tools
- Per-subtopic XP has reached the 100 XP cap for all subtopics across all documents
- No subtopics are critically decayed (forgetting curve has been managed)

**What 100% actually means at each tier:**
- 100% subtopic = that specific subtopic has been studied to its XP cap across tools
- 100% concept = all subtopics under that concept (in that document) are fully mastered
- 100% document = all concepts in that document are fully mastered
- 100% course = all documents in the course are fully mastered

**What 100% does NOT mean:**
- Only using one tool
- Only uploading documents without studying
- Passive AI Tutor sessions without micro-assessment confirmation
- High XP from grinding one document while ignoring others

---

## FILES TO CREATE / MODIFY

### New Backend Files
```
backend/database/mastery_v2_db.py          ← new DB class with all 7 tables
backend/services/mastery_engine.py          ← central event processor
backend/services/concept_extraction.py     ← LLM-based concept graph builder (per document)
backend/services/mastery_calculator.py     ← XP → mastery % formula engine (all 4 tiers)
backend/api/routes/mastery_v2.py           ← new API routes
```

### Modified Backend Files
```
backend/services/flashcard_service.py      ← tag cards to subtopics, call MasteryEngine
backend/services/quiz_service.py           ← tag questions to subtopics, call MasteryEngine
backend/services/rag_service.py            ← add trajectory classifier, pending XP logic
backend/services/document_processor.py    ← trigger concept extraction on upload
backend/main.py                            ← register new mastery_v2 router
```

### New Frontend Files
```
frontend-v2/src/components/XpToast.jsx              ← floating XP delta toast
frontend-v2/src/components/MicroAssessmentCard.jsx  ← checkpoint card in chat
frontend-v2/src/hooks/useHeartbeat.js               ← productive time tracker
frontend-v2/src/components/ConceptTree.jsx          ← 4-tier mastery tree UI (Course > Doc > Concept > Subtopic)
frontend-v2/src/components/DocumentMasteryBar.jsx   ← per-document mastery bar with expand/collapse
```

### Modified Frontend Files
```
frontend-v2/src/pages/Mastery.jsx          ← full redesign with new data
frontend-v2/src/pages/Dashboard.jsx        ← today's mastery summary card
frontend-v2/src/pages/AITutor.jsx          ← micro-assessment card + XP toast
frontend-v2/src/pages/Flashcards.jsx       ← XP delta on card rating
frontend-v2/src/pages/Quiz.jsx             ← XP delta on answer evaluation
frontend-v2/src/services/api.js            ← new mastery v2 service calls
```

---

## FUTURE FEATURES (not in this sprint — referenced for architecture awareness)

- **Social Leaderboards** — XP data is already per-user, per-course. Adding a leaderboard is a read query on `concept_xp` aggregated by user.
- **Streak System** — `study_sessions` table has per-day data. Streak = consecutive days with productive_seconds > 0.
- **Gamification (Aura skins, unlocks)** — XP milestones trigger events. Architecture supports it without changes.
- **Mastery-aware Study Planner** — Planner reads `concept_mastery_scores` to weight weak subtopics higher in the schedule. Data will be there after Phase 1.
- **Mastery Export** — Student can export their concept map + mastery scores as a study report.

---

*Document compiled: June 2026 — InStudy 2.0 Mastery Overhaul Design Session*
*Status: Ready for implementation — follow phases in order*
