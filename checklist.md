# InStudy 2.0 Project Checklist

## ✅ Completed Security Updates
- [x] **Use server-only cookies to hold and store auth tokens**
  - Implemented `session_token` as an HttpOnly cookie in `auth.py`.
  - Updated `auth_middleware.py` to extract tokens from cookies.
  - Updated frontend `api.js` and `fetch` calls to include credentials.
- [x] **Keep the Groq API keys in the .env file only**
  - Updated `auth_middleware.py` to prioritize `settings.GROQ_API_KEY` from environment variables.
  - Backend now ignores `X-Groq-API-Key` headers for security.
- [x] **All sensitive Information (auth tokens, API keys) removed from local storage**
  - Removed `auth_token` and `groq_api_key` caching from `api.js`, `Settings.jsx`, and `WelcomeModal.jsx`.
  - Protected routes now use `user_info` for logic instead of the secret token.

---

## ✅ Completed Improvements & Features
- [x] **Dashboard shortcuts**: All items on the dashboard should be a shortcut to that item.
- [x] **Last Course Interaction**: Add a "Last course the user was interacting with" section. Clicking it should take the user directly to that course.
- [x] **Sidebar Update**: Add "InSpace" directly below "Knowledge Base" in the navigation.
- [x] **Tab Hover Effect**: Fix tabs in Knowledge Base so they darken (or have a visible effect) when hovered.
- [x] **Course Card UX**: Make the whole course card clickable, not just the "Launch" button.
- [x] **Workspace Upload**: Add a way for the user to upload new material directly from the workspace.
- [x] **Text Size**: Increase the global size of text for better readability.
- [x] **Button Styling**: Reduce button shadows (currently "too much").
- [x] **API Key Privacy**: Hide/Mask the Groq API key in the UI (Settings) and secure the backend route.
- [x] **Remove NeuralControlDeck**: Completely remove the annotations display section (NeuralControlDeck) and its styles.

---

## ⏳ Pending Improvements & Features

### Feature Enhancements
- [ ] **Multi-step Summary Form**: Create a multi-step form for the summary generation process.
- [ ] **Mastery Page**: Display mastery data on a dedicated page.
- [ ] **Precise Mastery Tracking**: Show daily percentage progress when clicking on a course to check mastery.
