# InStudy 2.0 — Student Readiness Test
> Run these tests before giving InStudy to real students.
> Each test has a clear PASS/FAIL verdict. No subjective judgment.
> The final verdict table at the bottom tells you what is and isn't ready.

---

## HOW TO USE THIS FILE

1. Run each numbered test exactly as described.
2. Record your result in the checkbox: `[ ]` → `[P]` for PASS or `[F]` for FAIL.
3. Add a one-line note if something unexpected happened.
4. Read the final verdict table at the bottom.

**What you need before starting:**
- InStudy running (backend on 8000, frontend on 5173).
- One course with at least one uploaded PDF that you know well enough to verify answers.
- The Mastery → Course Detail → Re-index button clicked for that course (wait for backend logs to confirm extraction).
- A clean quiz/flashcard session (no cached data from previous runs).

---

## BLOCK 1 — Content Fidelity
> Does InStudy generate content that actually comes from your document?

---

### Test 1.1 — Flashcard content is from the document

**Steps:**
1. Go to Flashcards → select your test course → Generate 10 cards.
2. For each card, check: can you find the answer in the original document?
3. Count how many cards are directly grounded (answer verifiable in the document).

**Pass condition:** 8 or more of 10 cards have answers verifiable in the document.
**Fail condition:** 5 or more cards contain information NOT in the document, or answers are factually wrong.

```
Result: [ ]
Cards verified correct: __ / 10
Notes:
```

---

### Test 1.2 — Quiz content is from the document

**Steps:**
1. Generate a 5-question mixed quiz on the same course.
2. For each question:
   - Is the correct_answer actually correct according to the document?
   - Are the wrong options plausible (not obviously silly)?
   - Does the explanation match the document?
3. Count how many questions pass all three checks.

**Pass condition:** 4 or 5 questions are fully verifiable and correct.
**Fail condition:** Any question has a wrong "correct_answer" (not just a bad explanation — the answer itself is wrong).

```
Result: [ ]
Questions fully correct: __ / 5
Any wrong correct_answers? Yes / No
Notes:
```

---

### Test 1.3 — Topic focus works

**Steps:**
1. In Flashcard settings, type a specific topic (e.g. "mitosis" or the name of a chapter section).
2. Generate 10 cards.
3. Count how many cards are actually about that topic.

**Pass condition:** 9 or 10 cards are about the specified topic.
**Fail condition:** 4 or more cards are clearly about something else from the same document.

```
Result: [ ]
Topic used: _______________
On-topic cards: __ / 10
Notes:
```

---

## BLOCK 2 — Answer Evaluation
> When InStudy marks something correct or incorrect, is it telling the truth?
> This is the most important block. A wrong evaluation misleads students about their own understanding.

---

### Test 2.1 — Multiple choice scoring is exact

**Steps:**
1. Generate a 10-question multiple choice quiz.
2. Intentionally answer:
   - Questions 1–5: pick the correct option (you can check what it is before submitting)
   - Questions 6–10: pick obviously wrong options
3. Submit.

**Pass condition:** Score shows exactly 5/10 (50%). Every correct answer marked green. Every wrong answer marked red. No exceptions.
**Fail condition:** Score shows anything other than 50%, OR any correct answer is marked wrong, OR any wrong answer is marked correct.

```
Result: [ ]
Score shown: __ / 10  (expected 5/10)
Any mismarked answers: Yes / No
Notes:
```

---

### Test 2.2 — Short answer evaluation catches wrong answers

**Steps:**
1. Generate a 5-question short answer quiz.
2. For question 1: Submit the exact model answer (you can see it in the explanation after).
3. For question 2: Submit something completely irrelevant (e.g. "I like pizza and football").
4. For question 3: Submit a reasonable paraphrase using different words but same meaning.

**Pass condition:**
- Question 1 (exact) → marked correct ✓
- Question 2 (nonsense) → marked incorrect ✓
- Question 3 (paraphrase) → marked correct ✓ (this one may vary — note what happened)

**Fail condition:** Nonsense answer marked correct. This is the critical failure — it means the evaluation cannot be trusted.

```
Result: [ ]
Q1 exact answer: Correct / Incorrect  (expected: Correct)
Q2 nonsense:     Correct / Incorrect  (expected: Incorrect)
Q3 paraphrase:   Correct / Incorrect  (expected: Correct)
Notes:
```

---

### Test 2.3 — True/False questions are evaluated correctly

**Steps:**
1. Generate a 5-question True/False quiz.
2. Answer all 5 correctly (select the right True or False for each).
3. Then generate another 5-question True/False quiz and answer all incorrectly.

**Pass condition:** First quiz = 5/5. Second quiz = 0/5. Exactly.
**Fail condition:** Any deviation.

```
Result: [ ]
All-correct quiz: __ / 5  (expected 5/5)
All-wrong quiz:   __ / 5  (expected 0/5)
Notes:
```

---

## BLOCK 3 — Mastery Accuracy
> Does the mastery % actually reflect the student's real understanding?
> If this is wrong, the entire mastery system is noise.

---

### Test 3.1 — XP is awarded after a quiz

**Steps:**
1. Go to Mastery → click Reset on the test course (start from 0%).
2. Take a 10-question quiz and answer ALL correctly.
3. Check: did an XP toast appear after submitting?
4. Go to Mastery → Progress tab → check today's XP shows a number > 0.

**Pass condition:** XP toast fires with a number > 0. Progress tab shows XP earned today.
**Fail condition:** No toast, or toast shows +0 XP, or Progress tab shows empty.

```
Result: [ ]
XP toast appeared: Yes / No
XP amount shown: ___
Progress tab shows activity: Yes / No
Notes:
```

---

### Test 3.2 — Quiz failure does NOT increase mastery (critical)

**Steps:**
1. Note the current mastery % for the test course (or reset to 0%).
2. Take a 10-question quiz and answer EVERY question wrong (0/10).
3. Go to Mastery → Course Detail. Check if any subtopic mastery % increased.

**Pass condition:** No subtopic mastery % increased. Either stayed the same or decreased.
**Fail condition:** ANY subtopic mastery % went up despite a 0/10 quiz score. This is the most dangerous failure mode — it means failing a quiz could trick the system into thinking you learned something.

```
Result: [ ]
Did any subtopic mastery increase after 0/10 quiz? Yes / No
Course mastery % before: __%
Course mastery % after:  __%
Notes:
```

---

### Test 3.3 — Cross-tool conflict: quiz failure overrides flashcard mastery

**Steps:**
1. Generate 10 flashcards on a specific subtopic. Rate ALL cards as "Mastered".
2. Note the mastery % for that subtopic in Mastery → Course Detail.
3. Generate a quiz focused on the same topic. Answer every question WRONG.
4. Check the same subtopic's mastery % again.

**Pass condition:** The subtopic mastery % DECREASED after the quiz failure, even though it was previously high from flashcards. Quiz failure is a stronger signal.
**Fail condition:** Mastery % stayed high or increased. This means the system can be gamed — just rating flashcards as Mastered would give 100% without ever proving understanding.

```
Result: [ ]
Subtopic mastery after flashcards (rated all Mastered): __%
Subtopic mastery after failed quiz: __%
Did it decrease? Yes / No
Notes:
```

---

### Test 3.4 — Mastery page shows accurate data

**Steps:**
1. After completing Tests 3.1–3.3, go to Mastery → Overview.
2. Check: does the course ring % reflect recent quiz/flashcard activity?
3. Go to Mastery → Course Detail → expand a document → expand a concept.
4. Check: do any subtopic bars show non-zero mastery with XP breakdown visible?
5. Go to Mastery → Progress tab. Check: does the XP chart show bars for today?

**Pass condition:** All three views show data that changed based on the study activity in Tests 3.1–3.3.
**Fail condition:** All views still show 0% or unchanged from before testing.

```
Result: [ ]
Overview ring shows non-zero %: Yes / No
Course Detail shows subtopic bars: Yes / No
Progress tab shows today's XP chart: Yes / No
Notes:
```

---

## BLOCK 4 — Concept Extraction Quality
> Are the subtopics InStudy extracted from your document actually meaningful?
> Flashcard and quiz adaptive ordering depends entirely on this being accurate.

---

### Test 4.1 — Extracted subtopics match the document

**Steps:**
1. Go to Mastery → Course Detail for the test course.
2. Expand the uploaded document's accordion.
3. Read through the list of extracted concepts and subtopics.
4. Compare them to the actual document content.
5. Count how many subtopics are genuine academic concepts from that document (not "Introduction", "Summary", "Page numbers", author names, etc.).

**Pass condition:** 80% or more of subtopics are meaningful academic concepts directly from the document content.
**Fail condition:** More than 30% are generic, administrative, or clearly wrong.

```
Result: [ ]
Total subtopics shown: ___
Meaningful subtopics: ___  (__%)
Any obviously wrong ones (list them):
Notes:
```

---

### Test 4.2 — Adaptive prioritization works

**Steps:**
1. Study only ONE subtopic heavily: generate flashcards focused on it, rate all as Mastered. Take a quiz on it and ace it.
2. Generate a new flashcard deck (10 cards, no topic filter).
3. Check: are the new cards about DIFFERENT subtopics (the ones you haven't studied) — NOT the one you just mastered?

**Pass condition:** 7 or more of 10 new cards are about subtopics other than the one you mastered.
**Fail condition:** 5 or more cards repeat the already-mastered content.

```
Result: [ ]
Mastered subtopic used for step 1: _______________
New cards about different subtopics: __ / 10
Notes:
```

---

## BLOCK 5 — AI Tutor Reliability
> Can students trust the tutor's answers to be accurate and grounded in their documents?

---

### Test 5.1 — Tutor answers questions from the document

**Steps:**
1. Open Workspace for the test course.
2. Ask a specific question whose answer is ONLY in your uploaded document — something that cannot be answered from general knowledge.
   Example: "What specific value does section 2.3 give for X?" or "According to this document, what are the three steps of Y?"
3. Verify the answer against the document manually.

**Pass condition:** Answer matches the document. The tutor cites or references the relevant section.
**Fail condition:** Answer is generic (not from the document) or factually wrong compared to the document.

```
Result: [ ]
Question asked: _______________________________________________
Answer matched document: Yes / No / Partially
Notes:
```

---

### Test 5.2 — Tutor does not hallucinate specific facts

**Steps:**
1. Ask the tutor a factual question with a definitive numerical or named answer in the document.
   Example: "What year was X founded according to this document?" or "What is the formula for Y as shown in the material?"
2. Write down the tutor's answer.
3. Find the exact answer in the document.
4. Compare.

**Pass condition:** The tutor's specific facts (numbers, names, formulas) match the document exactly.
**Fail condition:** The tutor states specific facts that are NOT in the document. Even one hallucinated fact that a student might copy into an exam answer is a readiness blocker.

```
Result: [ ]
Question asked: _______________________________________________
Tutor's answer: _______________________________________________
Document answer: ______________________________________________
Match: Yes / No
Notes:
```

---

## FINAL VERDICT

Fill in after completing all tests:

| Block | Tests | Your Results | Status |
|-------|-------|-------------|--------|
| Block 1 — Content Fidelity | 1.1, 1.2, 1.3 | __ pass, __ fail | |
| Block 2 — Answer Evaluation | 2.1, 2.2, 2.3 | __ pass, __ fail | |
| Block 3 — Mastery Accuracy | 3.1, 3.2, 3.3, 3.4 | __ pass, __ fail | |
| Block 4 — Concept Extraction | 4.1, 4.2 | __ pass, __ fail | |
| Block 5 — Tutor Reliability | 5.1, 5.2 | __ pass, __ fail | |

### Readiness Rules

**READY for students if:**
- Block 2: ALL pass (no mismarked answers)
- Block 3.2: PASS (quiz failure cannot increase mastery)
- Block 1: At least 2/3 pass
- Block 3: At least 3/4 pass

**NOT READY if any of these are true:**
- Block 2.1 FAIL → scoring is wrong (students get wrong feedback on understanding)
- Block 3.2 FAIL → mastery can be gamed (system is not honest about knowledge gaps)
- Block 5.2 FAIL → tutor hallucinates facts (students might copy wrong information into exams)
- Block 1.2 FAIL with wrong correct_answers → quiz content itself is unreliable

**CONDITIONALLY READY (core tools work, some features need improvement):**
- Block 4 fails but Blocks 1–3 pass → flashcards/quiz work but adaptive ordering is weaker
- Block 5.1 fails but 5.2 passes → tutor sometimes gives generic answers but doesn't hallucinate

---

## WHAT TO DO WITH EACH FAILURE

| Failing Test | Root Cause | What to Fix |
|-------------|-----------|------------|
| 1.1 or 1.2 (wrong content) | LLM ignoring document context or poor FAISS retrieval | Check that documents processed correctly; try re-uploading |
| 1.3 (topic focus broken) | Topic filter not passed to LLM prompt | Check quiz_service/flashcard_service topic handling |
| 2.1 (wrong score) | MCQ evaluation logic broken | Check `_exact_match_evaluation` in quiz_service.py |
| 2.2 (nonsense = correct) | Semantic similarity threshold too low (0.57) | Raise threshold in `_semantic_evaluation` |
| 3.1 (no XP) | Concept name-match failing; Pydantic schema stripping fields | Re-index course; check backend logs for "No match for concept" |
| 3.2 (fail = mastery up) | Immediate delta not being applied; wrong event type | Check `MASTERY_DELTA_TABLE` in mastery_engine.py |
| 3.3 (quiz can't override) | Per-tool XP caps preventing quiz events | Check quiz_xp cap in mastery_v2_db.py |
| 3.4 (page shows 0) | V2 events not being recorded; frontend reading wrong endpoint | Check mastery_events table directly in mastery_v2.db |
| 4.1 (bad subtopics) | LLM extraction prompt producing poor output | Check concept_extraction.py prompt; may need a better model |
| 5.2 (hallucination) | LLM using training data instead of document context | Check that FAISS retrieval is returning relevant chunks |

---

*File: READINESS_TEST.md*
*Created: June 2026 — InStudy 2.0 Pre-Launch Verification*
*Run this test suite every time a major change is made before releasing to students.*
