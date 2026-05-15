# InStudy 2.0 — Game Changer Upgrade Roadmap

> Everything we identified in our design, accessibility, UX, and feature audit.
> Structured from quickest wins to biggest transformations.
> Read this before any sprint planning session.

---

## QUICK REFERENCE CHECKLIST

- [x] **#8** Redesign config pages (Flashcards, Quiz, Summary) — horizontal flow, no more panels
- [x] **#1** Fix hardcoded avatar in Sidebar
- [x] **#2** Replace all `prompt()` / `alert()` dialogs with proper modals
- [x] **#3** Fix "All Circuits" label → "All Courses"
- [x] **#4** Fix "Research A/B" course labels on Mastery page
- [x] **#5** Fix hardcoded "OPTIMAL" / "ACTIVE" stat card labels
- [x] **#6** Clean up Login page copy (Register(SignUp), dead Forgot Password link)
- [ ] **#7** Wire up or remove the "Upgrade to Ultra" CTA
- [x] **#9** Add onboarding checklist for new users
- [x] **#10** Add contextual empty states with next-action guidance
- [x] **#11** Warn users about quiz timer before it starts
- [x] **#12** Add first-use tutorial overlay for Flashcard controls
- [ ] **#13** Surface API key requirement before users hit an error
- [x] **#14** Simplify action button copy across all pages
- [ ] **#15** Design a logomark
- [x] **#16** Lift base color palette (elevated dark)
- [ ] **#17** Add Light Mode toggle
- [x] **#18** Fix WCAG contrast ratios
- [x] **#19** Improve Workspace transition animation
- [x] **#20** Make Study Planner mastery-aware
- [x] **#21** Build the Aura Mascot
- [ ] **#22** Mobile PWA / App
- [ ] **#23** Collaborative / Social layer
- [ ] **#24** Streak and Habit System

---


## TIER 1 — IMMEDIATE FIXES (1–2 hours each, no excuses)

These are broken things or embarrassing details that should not ship to real users.
Fix these first, no debate.

---

### 1. Remove the hardcoded profile avatar
**What's wrong:** Every user in the sidebar sees the same random Google image URL hardcoded into the component. It will eventually break and every user looks identical.
**Fix:** Show the user's initials in a styled circle (e.g. "JD" for john@domain.com) using their email. Add a color based on their username hash so each user gets a unique color. No external image dependency needed.
**File:** `frontend-v2/src/components/Sidebar.jsx`

---

### 2. Replace all `prompt()` and `alert()` dialogs
**What's wrong:** Saving a flashcard deck or quiz uses the browser's native `prompt()` for naming and `alert()` for confirmation. This pops a plain OS dialog box that completely breaks the visual language of the app. It looks unfinished and unprofessional.
**Fix:** Build a small reusable `<InputModal>` component with a text field and confirm/cancel buttons styled to match the existing glass UI. Use it everywhere `prompt()` and `alert()` are called.
**Files:** `frontend-v2/src/pages/Flashcards.jsx`, `frontend-v2/src/pages/Quiz.jsx`

---

### 3. Fix the "All Circuits" filter label
**What's wrong:** The filter tab on the Knowledge Base page says "All Circuits" instead of "All Courses." Students scanning for their courses will not connect "Circuits" to what they're looking for. It's a design term that leaked into the UI.
**Fix:** Rename to "All Courses."
**File:** `frontend-v2/src/pages/KnowledgeBase.jsx`

---

### 4. Fix the "Research A / Research B" course labels on Mastery page
**What's wrong:** The Mastery page labels every course as "Research A", "Research B", "Research C" using `String.fromCharCode(65 + index)`. A student's course named "Organic Chemistry" shows up as "Research A." This is confusing and undermines the whole page.
**Fix:** Remove the hardcoded label entirely. Just show the course name.
**File:** `frontend-v2/src/pages/Mastery.jsx`

---

### 5. Fix the stat card change labels
**What's wrong:** The four stat cards on the Dashboard show "OPTIMAL" and "ACTIVE" as their change/trend labels, hardcoded based on index parity (`i % 2 === 0`). These labels are meaningless.
**Fix:** Either remove the change label entirely, or replace with something real like "This week" or a calculated delta (e.g. "+2 since last week").
**File:** `frontend-v2/src/pages/Dashboard.jsx`

---

### 6. Clean up the Login page copy
**What's wrong:** Several copy issues on the login screen:
- "Register(SignUp)" — the parenthetical looks like a dev note
- "Forgot Password?" links to `#` — dead link with no feedback
- The overall tone is inconsistent (mixes "InStudent" branding with generic labels)
**Fix:** Change "Register(SignUp)" to just "Sign Up". Either implement forgot password or hide the link until it's built. Keep the "InStudent" branding but make it consistent.
**File:** `frontend-v2/src/pages/Login.jsx`

---

### 7. Wire up or remove the "Upgrade to Ultra" CTA
**What's wrong:** The Dashboard has a purple "Upgrade to Ultra" card with a "Go Ultra" button that does absolutely nothing. A non-functional CTA on a live product looks unfinished and erodes trust.
**Fix:** Either link it to a pricing/waitlist page, open a modal explaining what Ultra includes, or remove it entirely until it's real. Do not leave a dead button.
**File:** `frontend-v2/src/pages/Dashboard.jsx`

---

## TIER 2 — UX IMPROVEMENTS (half a day to a full day each)

### 8. Redesign the Configuration Pages (Flashcards, Quiz, Summary)
**What's wrong:** All three config pages share the same broken pattern — a glass panel sitting in the center of the screen with form fields stacked inside it. It feels like a settings dialog that accidentally became a full page. The layout uses maybe 40% of the available canvas and puts everything in a box. The Summary page tries a two-column split (config left, status panel right) but the right panel is mostly empty space with decorative binary numbers — which makes the emptiness more obvious, not less.

**The core problem:** The layout is vertical and contained when the page itself is wide and open. It's a "modal-in-a-page" pattern. Configuration pages should feel like *choosing*, not *filling out a form*.

**The fix — replace the panel pattern with a full-width horizontal flow:**

Each configuration choice becomes its own horizontal band across the full page width, separated by a step number and subtle divider. Options within each step sit side by side rather than stacked. The page feels like a flow you move through top to bottom, not a form inside a box.

**Target layout for all three pages:**
```
── Step 1: Choose your course ──────────────────────
  [Card] [Card] [Card]  ← horizontal card row, full width

── Step 2: Configure ───────────────────────────────
  Deck Size          Detail Level       Focus Topic
  [5] [10] [20]      [Brief] [Detailed] [_________]

── Step 3: Generate ────────────────────────────────
  [Full-width generate button]
```

**Page-specific notes:**
- **Flashcards:** Pull the "Deck Configuration" content out of the glass box entirely. Course selector becomes a full-width horizontal card row. Deck size, detail level, and topic sit in a clean horizontal row. Generate button spans full width.
- **Quiz:** The course card grid is already good — keep it. But difficulty, question count, and format each need their own full-width row with options spread horizontally instead of compressed into a narrow two-column grid.
- **Summary:** Remove the two-column split with the "Awaiting Input" status panel — it's wasted space. Go full-width for config, full-width for output below it. The numbered steps (01, 02) already exist — just follow through on the pattern instead of collapsing back into a panel.

**The principle:** When options are spread horizontally as cards or button groups across the full width, the user feels like they're making selections. When stacked vertically inside a panel, it feels like paperwork.

**Files:** `frontend-v2/src/pages/Flashcards.jsx`, `frontend-v2/src/pages/Quiz.jsx`, `frontend-v2/src/pages/Summary.jsx`

---

These don't break anything but they create friction, confusion, or missed opportunities.
Fix these in the next sprint.

---

### 9. Add a proper onboarding flow for new users
**What's wrong:** A brand new user lands on the Dashboard, sees all zeros, and has no idea what to do first. The Welcome modal exists but doesn't guide them to the actual first step. The intended flow (Create Course → Upload Document → Use Features) is never communicated.
**Fix:** After the Welcome modal, show a 3-step checklist pinned to the Dashboard:
- Step 1: Create your first course (links to Knowledge Base)
- Step 2: Upload a document
- Step 3: Generate your first flashcards or quiz
Each step checks off automatically when completed. Disappears once all three are done. Store completion state in localStorage.

---

### 10. Add contextual empty states that direct users to the next action
**What's wrong:** When a user visits Flashcards, AI Tutor, Quiz, or Summary without any courses set up, they see generic empty messages like "Initialization required" or "No Courses available." These tell the user what's missing but not what to do about it.
**Fix:** Every empty state should have:
- A clear explanation of why it's empty
- A direct action button (e.g. "Go to Knowledge Base to create a course")
- Ideally, the Aura mascot (see Tier 3) pointing at the button

---

### 11. Warn users about the quiz timer before it starts
**What's wrong:** The quiz starts a countdown timer immediately with no warning on the setup screen. Students who pause to think or re-read questions suddenly see a red pulsing timer counting down. This is a stress-inducing surprise.
**Fix:** Add a visible "This quiz is timed — X minutes total" notice on the QuizSetup screen. Give users the option to disable the timer (or make it optional). The timer should be a feature, not a trap.
**File:** `frontend-v2/src/pages/Quiz.jsx`

---

### 12. Add a first-use tooltip/guide to the Flashcard controls
**What's wrong:** The five flashcard buttons (Prev, Unfamiliar, Familiar, Mastered, Skip) are the core interaction of the feature. A first-time user doesn't know that clicking these advances the card AND updates their mastery score. There's no explanation anywhere.
**Fix:** On the very first flashcard session, show a one-time overlay or tooltip that explains what each button does. Store "has_seen_flashcard_tutorial" in localStorage so it only shows once.
**File:** `frontend-v2/src/pages/Flashcards.jsx`

---

### 13. Surface the API key requirement before users hit an error
**What's wrong:** Users discover they need a Groq API key only after trying to generate flashcards or a quiz and hitting an error alert. At that point they have to dismiss the alert, find Settings, figure out what Groq is, go get a key, come back, and try again. Many will just leave.
**Fix:** On first login (or when no API key is detected), show a non-blocking banner at the top of the app: "To use AI features, add your free Groq API key in Settings." Link directly to Settings. This turns a surprise error into an expected setup step.

---

### 14. Audit and simplify the platform vocabulary on action buttons
**What's wrong:** The platform uses creative vocabulary that fits the brand but creates hesitation on action buttons — the moments where clarity matters most.
**Specific changes needed:**
- "Synthesize Deck" → "Generate Flashcards"
- "Synthesize Assessment" → "Generate Quiz"
- "Initialization required" → "Configure your deck to get started"
- "Terminate Session" (logout tooltip) → "Log Out"
- "Forging Smart Assessment..." (loading) → "Generating your quiz..."
- "Flashcard assimilation Complete" → "Session Complete" or keep it, it's fine on the completion screen
- "Deck Configuration" → "Flashcard Settings"
The rule: creative names are fine for page titles and headings. Action buttons and error states need plain language.

---

### 15. Add a logo / logomark
**What's wrong:** The brand is currently just the text "InStudy 2.0" rendered in purple. The sidebar, login page, and browser tab all use text only. For a platform with this level of visual polish, the absence of a logomark is noticeable and makes it harder to build brand recognition.
**Fix:** Design a simple logomark — an abstract symbol that works at 16px (favicon) and 64px (splash screen). It should incorporate the purple/emerald palette and feel native to the dark aesthetic. Even a stylized "I" or an abstract neural/spark shape would work. This is a design task, not a code task, but it has high impact.

---

## TIER 3 — SIGNIFICANT UPGRADES (2–5 days each)

These require real planning and build time but will meaningfully differentiate the platform.

---

### 15. Lift the base color palette (Elevated Dark Theme)
**What's wrong:** The current background is `#060d08` — near pure black. While it looks dramatic, it causes two problems:
1. Very high contrast between background and text creates halation (text appears to glow/bleed) during long study sessions
2. Students in bright environments (classrooms, libraries) find near-black screens hard to read due to ambient light reflection
**Fix:** Lift the base background by ~15 lightness points:
- `#060d08` → `#111a13` (body background)
- `#0d1410` → `#182019` (surface)
- All other surface tokens shift proportionally
The accent colors (purple, emerald) stay identical — they actually pop more on a slightly lifted dark base. The identity stays dark-first, just more comfortable for extended use.
**File:** `frontend-v2/src/index.css`, `frontend-v2/tailwind.config.js`

---

### 16. Add a Light Mode toggle
**What's wrong:** Some students genuinely cannot study on dark backgrounds — it's not preference, it's how their eyes work. Currently there is no option. NotebookLM, Notion, and Obsidian all offer this. Locking users into dark-only mode excludes a real segment of your audience.
**Fix:** Implement a CSS variable-based theming system. Add a toggle in Settings (and optionally in the TopBar). The light theme should use warm off-whites and muted versions of the purple/emerald accents — not a clinical white. Store preference in localStorage. The dark theme remains the default and the identity of the platform.
**Implementation approach:** Replace hardcoded color values with CSS custom properties (`--color-background`, `--color-surface`, etc.) and swap them via a `data-theme` attribute on the `<html>` element.

---

### 17. Fix contrast ratios for WCAG AA compliance
**What's wrong:** The `on-surface-variant` color (`#a7ada6`) on the dark background sits at approximately 3.8:1 contrast ratio. WCAG AA requires 4.5:1 for normal text. This color is used extensively for labels, descriptions, and secondary text throughout the app. Users with any degree of visual impairment will struggle to read these.
**Fix:** Audit all text colors against their backgrounds using a contrast checker. Bump `on-surface-variant` to approximately `#b8bfb7` to clear the 4.5:1 threshold. Pay special attention to the 10px uppercase tracking labels — small text requires even higher contrast.
**Also:** Users with deuteranopia (green-blind, affects ~8% of men) may struggle to distinguish purple from emerald in some contexts. Add shape/icon differentiation alongside color differentiation for critical status indicators (e.g. the Unfamiliar/Familiar/Mastered concept tags on the Mastery page).

---

### 18. Replace the Workspace transition with a proper context-aware navigation
**What's wrong:** The Workspace is a full-screen route that completely removes the sidebar. The transition between the main app and Workspace is abrupt — users can feel disoriented jumping in and out, especially when navigating back.
**Fix:** Add a smooth page transition animation (Framer Motion `AnimatePresence` is already in the project). Add a persistent "Back to Dashboard" breadcrumb inside the Workspace so users always know how to get back. Consider a slide-in animation for the Workspace entering and a slide-out for leaving.

---

### 19. Make the Study Planner mastery-aware
**What's wrong:** The Study Planner currently takes exam date + topics as input and generates a schedule. It does not look at the user's mastery data. This means a student who already knows 80% of Topic A and 10% of Topic B gets a plan that treats both equally. That's not adaptive — it's just a calendar generator.
**Fix:** When generating a study plan, pull the user's mastery profile for the selected course and weight the plan toward weak concepts. Topics with low familiarity scores get more days and earlier placement. Topics already mastered get brief review slots. This makes the planner genuinely intelligent and directly leverages the forgetting curve data you're already tracking.
**Files:** `backend/services/planner_service.py`, `backend/api/routes/planner.py`

---

## TIER 4 — GAME CHANGERS (1–3 weeks each)

These are the features that create a moat. Nothing on the market does all of these together.

---

### 20. The Aura Mascot
**What it is:** A small, ambient AI companion that lives in the bottom-right corner of the app. Not a cute animal — an abstract, glowing geometric entity that fits the InStudy dark aesthetic. Think a small floating orb or crystalline shape with a subtle face, rendered in the purple/emerald palette with a soft glow.

**What it does:**
- **Onboarding:** Guides new users through the first three steps (create course, upload document, generate first flashcard/quiz). Points at the relevant UI elements.
- **Empty states:** Replaces cold "No data" messages. The mascot appears and explains what's missing and what to do.
- **Errors:** Replaces `alert()` dialogs. The mascot slides in, explains the error in plain language, and offers a direct action to fix it (e.g. "Looks like no documents are in this course yet — want me to take you to Knowledge Base?")
- **Completion moments:** Celebrates when a quiz is finished, a deck is mastered, or a study streak is hit.
- **Stale nudges:** If a user hasn't studied in 3+ days, the mascot appears on login with a gentle reminder and shows which concepts are decaying on the forgetting curve.
- **Idle ambient presence:** When nothing is happening, it floats subtly. Users can click it to get contextual help for whatever page they're on.

**Animation states needed:** Idle (float), Pointing, Thinking (for loading), Celebrating, Concerned (for errors). Built with Lottie or CSS-animated SVG.

**The mascot's voice (copy rules):**
- Never say "Oops!" or "Something went wrong"
- Always explain what happened AND what to do next
- Brief, slightly witty, never corporate
- Example error: "That didn't go through — this course has no documents yet. Head to Knowledge Base to upload one."
- Example celebration: "Quiz complete. 87% — that's a strong result. Your mastery scores have been updated."

**Name suggestion:** "Aura" — already embedded in the platform vocabulary (Aura Momentum, Aura Insight). The mascot IS the Aura.

---

### 21. Light Mode (full implementation)
*(Listed in Tier 3 as a significant upgrade — elevates to game changer when combined with the mascot and the lifted dark theme, because together they make the platform accessible to every type of student regardless of environment or visual preference.)*

---

### 22. Mobile App (PWA first, then native)
**What's wrong:** Anki, Knowt, and Quizlet win on mobile. The forgetting curve only works if students can review on the go — between classes, on the bus, before bed. A platform that only works on desktop loses the battle for daily habit formation.
**Fix Phase 1:** Convert the existing React app to a Progressive Web App (PWA). Add a manifest, service worker, and offline support for flashcard review. This gives mobile users an "install" prompt and a near-native experience with minimal extra code.
**Fix Phase 2:** React Native app sharing the same backend. Flashcards and Quiz are the priority screens — those are the high-frequency mobile use cases.

---

### 23. Collaborative / Social Layer
**What's wrong:** InStudy is entirely solo. Studyverse, Knowt, and Quizlet have shared decks, class sets, and leaderboards. Students study together — they share notes, quiz each other, and compete. There is currently no way to share a course, a flashcard deck, or a quiz result with anyone.
**Fix (phased):**
- Phase 1: Share a flashcard deck or quiz via a public link (read-only). No account required to view.
- Phase 2: Course sharing — invite a classmate to a course so you both upload documents and share the knowledge base.
- Phase 3: Study groups — shared mastery leaderboard within a group, group study sessions with synchronized flashcard review.
This is the feature that drives organic growth. Every shared deck is a referral.

---

### 24. Streak and Habit System
**What's wrong:** The platform tracks study hours and mastery but has no mechanism to build daily study habits. There's no streak counter, no daily goal, no reward for consistency. Duolingo's entire retention strategy is built on streaks. InStudy has the data to do this (daily_activity is already tracked) but surfaces none of it as motivation.
**Fix:** Add a daily study streak counter to the Dashboard and TopBar. Set a configurable daily goal (e.g. "Study for 20 minutes" or "Review 10 flashcards"). When the streak breaks, the Aura mascot appears with a recovery prompt. When a milestone is hit (7 days, 30 days), trigger a celebration moment. This is a retention mechanic, not just a feature — it changes how often users come back.

---

## SUMMARY TABLE

| # | Upgrade | Tier | Effort | Impact |
|---|---------|------|--------|--------|
| 1 | Fix hardcoded avatar | Immediate | 30 min | Medium |
| 2 | Replace prompt/alert dialogs | Immediate | 1–2 hrs | High |
| 3 | Fix "All Circuits" label | Immediate | 5 min | Low |
| 4 | Fix "Research A/B" labels | Immediate | 10 min | Medium |
| 5 | Fix stat card labels | Immediate | 15 min | Low |
| 6 | Clean up Login copy | Immediate | 30 min | Medium |
| 7 | Wire up or remove Ultra CTA | Immediate | 30 min | Medium |
| 8 | Redesign config pages (Flashcards, Quiz, Summary) | UX | 1–2 days | High |
| 9 | Add onboarding checklist | UX | Half day | High |
| 10 | Contextual empty states | UX | Half day | High |
| 11 | Quiz timer warning | UX | 1 hr | Medium |
| 12 | Flashcard tutorial overlay | UX | 2 hrs | Medium |
| 13 | API key setup banner | UX | 1 hr | High |
| 14 | Simplify action button copy | UX | 1 hr | High |
| 15 | Design a logomark | UX | Design task | High |
| 16 | Lift base color palette | Significant | Half day | Medium |
| 17 | Light mode toggle | Significant | 2–3 days | High |
| 18 | WCAG contrast fixes | Significant | 1 day | High |
| 19 | Workspace transition | Significant | 1 day | Medium |
| 20 | Mastery-aware planner | Significant | 2 days | High |
| 21 | Aura Mascot | Game Changer | 1–2 weeks | Very High |
| 22 | Mobile PWA / App | Game Changer | 2–3 weeks | Very High |
| 23 | Collaborative / Social layer | Game Changer | 3–4 weeks | Very High |
| 24 | Streak and Habit System | Game Changer | 1 week | Very High |

---

## THE CORE COMPETITIVE EDGE (don't lose sight of this)

Everything above is polish and growth. The actual moat — what no single competitor has all at once — is:

1. **Vision-aware document ingestion** — PDFs with diagrams, images, and charts are analyzed by a vision model and indexed. Students can ask questions about visual content.
2. **Multilingual RAG** — Upload and study in any language. The embeddings model supports cross-lingual retrieval natively.
3. **Automatic cross-feature mastery tracking with a real Ebbinghaus forgetting curve** — Every quiz answer and flashcard rating updates a per-concept mastery score. The score decays over time using the actual exponential decay formula. The planner, flashcards, and quiz all feed into and read from the same mastery model.
4. **Adaptive AI output** — Summaries, study plans, and AI tutor answers are shaped by what the user already knows and doesn't know.

These four things together, in one platform, is the pitch. Everything in this document is about making sure users actually discover and experience that pitch instead of bouncing before they get there.

---

*Last updated: May 2026 — compiled from full design, UX, accessibility, and feature audit of InStudy 2.0*
