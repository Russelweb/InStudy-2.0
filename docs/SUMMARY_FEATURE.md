# AI Summary Feature - Documentation

## Overview
The AI Summary feature (Neural Distillation) transforms large document archives into refined, digestible summaries with conceptual mind maps. It leverages the backend's LLM integration to provide intelligent, context-aware summaries.

## Features

### 1. Multi-Style Summaries
- **Short**: Concise 2-3 paragraph overview
- **Detailed**: Comprehensive 4-6 paragraph analysis
- **Exam**: Focused on testable concepts and key points

### 2. Document Selection
- Summarize entire course materials (all documents)
- Target specific documents for focused summaries
- Automatic document discovery per course

### 3. Conceptual Mind Maps
- Generates Graphviz DOT format mind maps
- Visual representation of concept relationships
- Exportable for use with external visualization tools

### 4. Rich Markdown Support
- Full markdown rendering with react-markdown
- Mathematical equations support (KaTeX)
- GitHub Flavored Markdown (tables, task lists, etc.)
- Syntax highlighting for code blocks

### 5. Save & Export
- Save summaries to Saved Assets for later access
- Export as formatted text files
- Share via native share API or clipboard
- Download mind maps separately

### 6. Smart Navigation
- Direct links to generate flashcards from summary
- Quick access to quiz generation
- AI Tutor integration for deeper exploration

### 7. Mastery Integration
- Backend adapts summaries based on user's mastery profile
- Focuses on weak areas and concepts needing reinforcement
- Personalized learning experience

## User Flow

1. **Select Course**: Choose from available courses with document counts
2. **Configure Settings**:
   - Select specific document or use all materials
   - Choose summary style (short/detailed/exam)
3. **Generate**: Click "Synthesize Summary" to start AI processing
4. **Review**: Read the generated summary with markdown formatting
5. **Actions**:
   - Save to assets for future reference
   - Export as text file
   - Share with others
   - Regenerate with different settings
   - Navigate to related study tools

## Technical Implementation

### Frontend Components
- **Summary.jsx**: Main page component
- Uses Framer Motion for smooth animations
- React Router for navigation
- React Markdown for content rendering

### API Integration
```javascript
summaryService.generate(courseId, documentName, style)
```

### Backend Endpoint
```
POST /api/summary/generate
{
  "course_id": "string",
  "document_name": "string | null",
  "style": "short | detailed | exam"
}
```

### Response Format
```json
{
  "summary": "Markdown formatted summary text",
  "mind_map": "Graphviz DOT format string (optional)"
}
```

## Improvements Over Streamlit Version

1. **Better UX**: Modern, responsive design with smooth animations
2. **Markdown Support**: Rich text formatting with math equations
3. **Navigation**: Integrated with other study tools
4. **Save System**: Persistent storage in Saved Assets
5. **Share Functionality**: Native sharing and clipboard support
6. **Regeneration**: Keep previous summaries while generating new ones
7. **Progress Tracking**: Visual feedback during generation
8. **Mobile Responsive**: Works seamlessly on all devices
9. **Error Handling**: Clear error messages and recovery options
10. **Performance**: Optimized loading and rendering

## Usage Tips

- Use "short" style for quick reviews before exams
- Use "detailed" style for comprehensive understanding
- Use "exam" style when preparing for tests
- Export mind maps to visualize concept relationships
- Save important summaries to Saved Assets
- Regenerate with different styles to get varied perspectives

## Future Enhancements

- [ ] Interactive mind map visualization (D3.js or similar)
- [ ] Summary comparison (side-by-side view)
- [ ] Highlight key terms automatically
- [ ] Generate study questions from summary
- [ ] Audio narration of summaries
- [ ] Multi-language support
- [ ] Summary history and versioning
- [ ] Collaborative annotations
- [ ] PDF export with formatting
- [ ] Integration with note-taking apps

## Dependencies

- react-markdown: Markdown rendering
- remark-gfm: GitHub Flavored Markdown
- remark-math: Math equation parsing
- rehype-katex: Math equation rendering
- katex: LaTeX math rendering
- framer-motion: Animations
- axios: API requests

## Error Handling

The feature handles common errors gracefully:
- No documents in course → Prompts to upload materials
- Missing API key → Directs to Settings
- Network errors → Clear error messages
- Invalid responses → Fallback to plain text

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast text
- Responsive font sizes
