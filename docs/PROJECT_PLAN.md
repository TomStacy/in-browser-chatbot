# Offline Browser Chatbot - Project Plan & Progress

## Project Overview

Building a **fully offline-capable AI chatbot** that runs entirely in the browser after initial download. Uses WebGPU acceleration, Service Workers for offline support, and IndexedDB for persistent storage.

**Repository:** `E:\Repos\in-browser-chatbot`

---

## Progress Tracker

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Core Infrastructure |
| Phase 2 | ✅ Complete | Chat Persistence |
| Phase 3 | ✅ Complete | Multi-Model Support |
| Phase 4 | ✅ Complete | Polish & UX |
| Phase 5 | 🔄 In Progress | PWA & Final Polish |

---

## Phase 1: Core Infrastructure ✅ COMPLETE

**Goal:** Basic working chat with model inference

### Phase 1 Tasks

- [x] Project structure setup
- [x] HTML shell with full UI layout
- [x] CSS styling (dark/light themes, responsive)
- [x] Service Worker for offline caching
- [x] Web Worker for model inference (Blob URL approach)
- [x] Model manager for worker coordination
- [x] Basic chat UI (input + messages)
- [x] Model selection and loading
- [x] Streaming token display
- [x] IndexedDB setup with Dexie.js
- [x] Settings modal UI
- [x] Export modal UI
- [x] Toast notifications
- [x] PWA manifest and icons

### Phase 1 Technical Notes

- **Worker Loading Issue Solved:** Module workers with dynamic imports from CDN fail silently. Solution: Embed worker code as string in `model-manager.js` and create via Blob URL.
- **Supported Models:**
  - `HuggingFaceTB/SmolLM2-1.7B-Instruct` (~1.7GB)
  - `onnx-community/granite-3.0-2b-instruct` (~2GB)
  - `onnx-community/Qwen2.5-1.5B-Instruct` (~1.5GB)
  - `onnx-community/Phi-3.5-mini-instruct-onnx-web` (~2.2GB)

### Phase 1 Files Created

```text
frontend/
├── index.html              ✅
├── manifest.json           ✅
├── sw.js                   ✅
├── css/
│   └── styles.css          ✅
├── js/
│   ├── app.js              ✅
│   ├── ui.js               ✅
│   ├── utils.js            ✅
│   ├── chat-store.js       ✅
│   ├── model-manager.js    ✅ (includes embedded worker code)
│   └── export.js           ✅
└── icons/
    ├── favicon.svg         ✅
    ├── icon-192.svg        ✅
    └── icon-512.svg        ✅
```

---

## Phase 2: Chat Persistence ✅ COMPLETE

**Goal:** Conversations persist across sessions

### Phase 2 Tasks

- [x] Load conversation list on startup
- [x] Save messages to IndexedDB after each exchange
- [x] Load conversation history when selecting from sidebar
- [x] Auto-generate titles from first user message
- [x] Update conversation title in sidebar after generation
- [x] Delete conversation functionality (with confirmation)
- [x] Clear messages when starting new chat
- [x] Persist selected model per conversation
- [x] Handle empty state (no conversations)

### Phase 2 Implementation Notes

- Conversation CRUD already implemented in `chat-store.js`
- Need to wire up UI events to storage functions
- Auto-title generation uses `generateTitle()` from `utils.js`

---

## Phase 3: Multi-Model Support ✅ COMPLETE

**Goal:** Multiple models with side-by-side comparison

### Phase 3 Tasks

- [x] Model download status indicators (per model)
- [x] Allow loading multiple models simultaneously
- [x] Side-by-side comparison view toggle
- [x] Split message display for comparison mode
- [x] Send same prompt to both models
- [x] Independent streaming for each model
- [x] Model badges on messages
- [x] Persist comparison mode setting
- [x] Cache status display per model

### Phase 3 Implementation Notes

- `modelManager` already supports multiple workers
- Need UI for comparison view (CSS grid split)
- Messages need `model` field (already in schema)

---

## Phase 4: Polish & UX ✅ COMPLETE

**Goal:** Production-quality experience

### Phase 4 Tasks

- [x] Markdown rendering improvements (code highlighting)
- [x] Copy message button
- [x] Copy code block button
- [x] Regenerate response button
- [x] Edit user message
- [x] Keyboard shortcuts help modal
- [x] Smooth animations for message appearance
- [x] System theme detection and auto-switch
- [x] Better error messages with retry
- [x] Mobile touch improvements
- [x] Accessibility audit (ARIA labels, focus management)
- [~] Loading skeleton for messages (Skipped - fast local load)

### Phase 4 Implementation Notes

- Consider adding Prism.js or highlight.js for code
- Use `prefers-color-scheme` media query for system theme

---

## Phase 5: PWA & Final Polish 🔄 IN PROGRESS

**Goal:** Installable, offline-first PWA

### Phase 5 Tasks

- [x] PWA install prompt handling
- [x] "Add to Home Screen" button
- [x] Offline status indicator in UI
- [x] Update available notification
- [x] Service worker update flow
- [ ] App version display in settings
- [ ] Performance optimization audit
- [ ] Lighthouse PWA audit fixes
- [ ] Final testing on mobile devices
- [ ] README.md for repository

### Phase 5 Implementation Notes

- Service Worker already handles caching
- Need `beforeinstallprompt` event handler
- Consider cache versioning strategy

---

## Future Enhancements (Post-MVP)

- [ ] Voice input (Web Speech API)
- [ ] Image understanding (vision models)
- [ ] RAG with local documents
- [ ] Conversation search
- [ ] Prompt templates library
- [ ] Import conversations from JSON
- [ ] Share conversations (export link)
- [ ] Custom model support (user-provided HF models)

---

## Development Setup

### Running Locally

```bash
cd E:\Repos\in-browser-chatbot\frontend

# Option 1: Python
python -m http.server 8080

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server extension
# Right-click index.html -> Open with Live Server
```

### Browser Requirements

- **Recommended:** Chrome/Edge 113+ (WebGPU support)
- **Fallback:** Any modern browser (WASM backend)

### Testing Offline Mode

1. Load the app and download a model
2. Open DevTools → Network → Check "Offline"
3. Refresh page - should still work!

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2024 | Vanilla JS (no framework) | Simpler caching, no build step |
| Dec 2024 | Blob URL for worker | Module workers + CDN imports fail silently |
| Dec 2024 | Dexie.js for IndexedDB | Simpler API than raw IndexedDB |
| Dec 2024 | transformers.js v2.17.2 | Stable version with WebGPU support |
| Dec 2024 | SVG icons | Scalable, no PNG generation needed |

---

## Resources

- [transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Dexie.js Documentation](https://dexie.org/docs/)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Documentation (web.dev)](https://web.dev/progressive-web-apps/)

---

**Last Updated:** December 2024
