# InStudy 2.0 — Visual AI Tutor: Implementation Plan
> Feature: AI Tutor responds with inline diagrams, illustrations, and images alongside text explanations
> Date: June 2026

---

## WHAT THE STUDENT EXPERIENCES

When a student asks about a concept that benefits from visual explanation:

```
STUDENT: Explain the digestive system to me

TUTOR RESPONSE:
────────────────────────────────────────────────────
The digestive system is responsible for breaking down food
into nutrients the body can absorb. It begins in the mouth...

  ┌──────────────────────────────┐
  │   [RENDERED DIAGRAM HERE]    │  ← Actual image in chat,
  │   Labeled organs visible     │    not a link, not code
  └──────────────────────────────┘

The process starts with mechanical digestion in the mouth,
where saliva begins breaking down carbohydrates...
────────────────────────────────────────────────────
```

The diagram appears inline between paragraphs of explanation. Clicking it expands it to full size.

---

## TWO RENDERING PATHS

### Path A — Wikimedia Educational Images
**When used:** Well-known scientific/academic topics (anatomy, chemistry, physics, biology)
**What renders:** Real labeled diagrams and photographs from Wikimedia Commons (CC licensed)
**Quality:** Publication-grade educational illustrations, often better than AI-generated
**Cost:** Free, no API key required
**Examples:** Digestive system, DNA structure, cell mitosis, periodic table, the solar system

### Path B — LLM-Generated SVG Diagrams
**When used:** Conceptual topics, comparisons, processes, flowcharts, custom course content
**What renders:** A vector diagram drawn by the LLM as SVG code, rendered as a real image in the browser
**Quality:** Clean labeled diagrams — accurate, readable, styled to match InStudy's dark theme
**Cost:** Free, uses the same Groq call as the text explanation
**Examples:** Comparison tables as visual cards, process flows, timeline diagrams, concept maps

### Decision Logic (how the backend picks)
```
Is the topic a well-known scientific concept?
    YES → Search Wikimedia → image found? → use it (Path A)
                          → not found?   → fall back to SVG (Path B)
    NO  → Generate SVG (Path B)

Is the topic abstract/conceptual (e.g. "compare X and Y")?
    → Always SVG (Path B) — Wikimedia won't have it
```

---

## IMPLEMENTATION CHECKLIST

---

### PHASE 1 — Backend: Diagram Service

**Goal:** Create a service that decides which path to use, fetches or generates the diagram, and returns a renderable payload.

- [ ] **1.1** Create `backend/services/diagram_service.py`
  - `should_include_diagram(question: str, answer: str) -> bool` — uses simple heuristics to decide if a diagram would help (topic contains body systems, processes, comparisons, structures, etc.)
  - `get_diagram(topic: str, context: str, api_key: str = None) -> DiagramResult` — orchestrates Path A vs Path B
  - Returns: `{ type: 'svg' | 'image', content: str, alt_text: str, caption: str }`

- [ ] **1.2** Implement Wikimedia search in `diagram_service.py`
  - `search_wikimedia(topic: str) -> Optional[WikimediaResult]`
  - Calls the Wikimedia Commons API: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={topic}&srnamespace=6`
  - Filters for SVG and PNG files tagged as educational
  - Returns the thumbnail URL (Wikimedia provides 300px, 500px, 800px thumbnails)
  - Fallback: if no result or low-confidence match → trigger Path B

- [ ] **1.3** Implement LLM SVG generation in `diagram_service.py`
  - `generate_svg_diagram(topic: str, context: str, llm) -> str`
  - Sends a targeted prompt to the LLM asking for a minimal, labeled SVG diagram
  - SVG prompt enforces: dark background (#141f16), purple/emerald color scheme matching InStudy, clean labels as text nodes (not embedded in paths)
  - Validates the returned SVG (must start with `<svg`, must have viewBox, must have at least one text label)
  - Returns the SVG string

- [ ] **1.4** Add `DiagramResult` dataclass
  ```python
  @dataclass
  class DiagramResult:
      type: str        # 'svg' | 'image_url'
      content: str     # SVG string OR image URL
      alt_text: str    # Screen reader description
      caption: str     # Short caption shown below diagram
      source: str      # 'wikimedia' | 'generated'
  ```

---

### PHASE 2 — Backend: RAG Service Integration

**Goal:** Wire the diagram service into the tutor response pipeline so diagrams accompany explanations automatically.

- [ ] **2.1** Add diagram detection to `rag_service.py`
  - After the LLM generates its text response, call `diagram_service.should_include_diagram(question, answer)`
  - If True: call `diagram_service.get_diagram(detected_topic, answer_context, api_key)`
  - Detected topic: extract from the question/answer using a short LLM call or keyword matching

- [ ] **2.2** Add diagram result to SSE stream
  - After streaming the text response, if a diagram was generated, send an additional SSE event:
    ```python
    yield f"data: {json.dumps({'type': 'diagram', 'diagram_type': result.type, 'content': result.content, 'alt_text': result.alt_text, 'caption': result.caption})}\n\n"
    ```
  - This event fires AFTER the text is complete — it never delays the text streaming

- [ ] **2.3** Handle diagram in non-streaming endpoint (`answer_question`)
  - Add `diagram` field to the response dict
  - Return: `{ answer: str, sources: [], has_context: bool, diagram: DiagramResult | None }`

- [ ] **2.4** Add `diagram_enabled` setting to RAG service
  - Default: True
  - Can be disabled per-request if the student is in a timed quiz or just wants text

---

### PHASE 3 — Frontend: Rendering Diagrams in Chat

**Goal:** AITutorChat renders SVG or image inline in the message thread.

- [ ] **3.1** Create `frontend-v2/src/components/TutorDiagram.jsx`
  - Receives `{ type, content, altText, caption }` props
  - If `type === 'svg'`: renders the SVG markup directly using `dangerouslySetInnerHTML`
    - Wrapped in a styled container with InStudy dark theme background
    - SVG is sanitized before render (strip any `<script>` tags)
  - If `type === 'image_url'`: renders `<img src={content} alt={altText} />`
  - Below the diagram: shows the caption text in small secondary color
  - Click to expand: clicking opens the diagram in a full-screen modal for closer inspection
  - Download button: allows saving the diagram

- [ ] **3.2** Add diagram expand modal
  - Reuse the existing `Modal` component or create a new `DiagramModal`
  - Full screen on mobile, 80% width on desktop
  - Shows caption and source attribution ("Source: Wikimedia Commons" or "Generated by Aura")

- [ ] **3.3** Update `AITutorChat.jsx` SSE parser
  - Add handler for `data.type === 'diagram'` event
  - Store diagram data in state: `const [pendingDiagram, setPendingDiagram] = useState(null)`
  - When diagram event arrives: set `pendingDiagram` with the diagram data
  - Append the diagram as a special message type to the messages array:
    ```js
    setMessages(prev => [...prev, { type: 'diagram', ...diagramData }])
    ```

- [ ] **3.4** Update message renderer in `AITutorChat.jsx`
  - Current: `if (msg.type === 'ai') render markdown`
  - Add: `if (msg.type === 'diagram') render <TutorDiagram />`
  - Diagrams appear as their own "message" between the text explanation and the next user message

- [ ] **3.5** Loading state for diagram
  - While diagram is being fetched/generated, show a subtle loading skeleton in the chat
  - "Generating visual..." placeholder with a pulsing animation matching InStudy's style
  - This appears after the text is done streaming, before the diagram arrives

---

### PHASE 4 — SVG Quality & Styling

**Goal:** Ensure generated SVGs look good inside InStudy's dark theme and are actually useful for studying.

- [ ] **4.1** Write the SVG generation prompt template in `diagram_service.py`
  - Constraints enforced in prompt:
    - `viewBox="0 0 600 400"` (consistent aspect ratio)
    - Background: `fill="#141f16"` (InStudy dark)
    - Primary labels: `fill="#d8e8d6"` (InStudy on-surface)
    - Accent/highlight: `fill="#bd9dff"` (InStudy primary purple)
    - Secondary accent: `fill="#69f6b8"` (InStudy emerald)
    - Font: use `font-family="Inter, sans-serif"`
    - Minimum 3 labeled elements
    - No external dependencies (no `<image href="...">` tags)
  - Prompt example format:
    ```
    Generate a minimal educational SVG diagram showing [topic].
    Requirements:
    - viewBox="0 0 600 400", no width/height attributes
    - Dark background rectangle fill="#141f16"
    - Labels as <text> nodes with fill="#d8e8d6"
    - Highlight key elements in fill="#bd9dff"
    - Clean, readable, labeled diagram
    - Return ONLY the SVG markup starting with <svg
    ```

- [ ] **4.2** SVG validation and sanitization
  - Strip `<script>`, `<foreignObject>`, `href="javascript:"`
  - Ensure `viewBox` is present
  - If validation fails → fall back to Wikimedia search or skip diagram

- [ ] **4.3** Test SVG generation for 5 common educational topics
  - Digestive system
  - Photosynthesis process
  - Cell structure
  - Water cycle
  - Newton's laws (force diagram)
  - Adjust prompt if any produce unusable output

---

### PHASE 5 — Controls & Settings

**Goal:** Give students control over whether diagrams appear.

- [ ] **5.1** Add "Show diagrams" toggle to AI Tutor interface
  - Small toggle in the tutor header bar (desktop) or settings menu (mobile)
  - Default: ON
  - Persisted in localStorage: `tutor_diagrams_enabled`
  - When OFF: tutor responds text-only, no diagram generation attempted

- [ ] **5.2** Add diagram preference to user settings page
  - Settings page already exists at `/settings`
  - Add a "Visual Explanations" section with the same toggle

---

## TECHNICAL DECISIONS

### Why SVG over raster images (PNG/JPEG from a generation model)?
- SVG renders perfectly at any size — no pixelation on high-DPI screens
- Labels are actual text — screen reader accessible, searchable
- LLMs can write SVG reliably for educational diagrams (they are essentially markup)
- No per-image cost — uses the same Groq call as the explanation
- SVG matches InStudy's dark theme without needing image post-processing

### Why Wikimedia for known topics?
- Pre-existing high-quality labeled educational diagrams
- Free, CC licensed, no API key needed
- Better than anything an LLM can generate for well-established science topics
- The digestive system diagram on Wikimedia is medically accurate and beautifully labeled

### Why not Stable Diffusion / DALL-E / Grok Imagine?
- Requires a separate API key and costs money per image
- Generated images often have garbled text labels (confirmed by arxiv research)
- Photos are not what you want for studying — labeled diagrams are
- Adds vendor dependency and cost to a platform that should work on a free Groq key

---

## WHAT A DIAGRAM-ENABLED RESPONSE LOOKS LIKE IN THE STREAM

```
SSE events sequence:
1. {type: 'metadata', sources: [...], has_context: true}
2. {type: 'content', text: 'The digestive system...'}
3. {type: 'content', text: ' consists of...'}
4. ... (text chunks)
5. {type: 'done'}
6. {type: 'diagram', diagram_type: 'image_url', content: 'https://upload.wikimedia.org/...', alt_text: 'Labeled diagram of the human digestive system', caption: 'Human Digestive System — Wikimedia Commons'}
```

The text completes first (event 5), then the diagram arrives (event 6). Students read the explanation, then the diagram reinforces it visually.

---

## FILES TO CREATE / MODIFY

### New Files
```
backend/services/diagram_service.py          ← diagram orchestration, Wikimedia, SVG gen
frontend-v2/src/components/TutorDiagram.jsx  ← diagram renderer (SVG + image, click to expand)
```

### Modified Files
```
backend/services/rag_service.py              ← call diagram_service, add to SSE stream
backend/api/routes/chat.py                   ← pass diagram in non-streaming response
frontend-v2/src/components/AITutorChat.jsx   ← handle diagram SSE event, render TutorDiagram
```

---

## ESTIMATED BUILD TIME

| Phase | Time |
|-------|------|
| Phase 1 — diagram_service.py | 3-4 hours |
| Phase 2 — RAG integration | 2-3 hours |
| Phase 3 — Frontend rendering | 3-4 hours |
| Phase 4 — SVG quality tuning | 2-3 hours |
| Phase 5 — Controls | 1 hour |
| **Total** | **~1.5 days** |

---

*Document: VISUAL_TUTOR_PLAN.md*
*Created: June 2026 — InStudy 2.0 Visual AI Tutor Feature*
