# Offline Browser Chatbot - Architecture & Implementation

## Executive Summary

A **fully offline-capable AI chatbot** that runs entirely in the browser after initial download. Showcases modern web capabilities (WebGPU, Service Workers, IndexedDB) combined with on-device ML inference using transformers.js.

**Key Features:**

- 100% private - all inference runs locally
- Works offline after first load
- Multiple model support with side-by-side comparison (planned)
- Persistent chat history
- PWA installable

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌─────────────────────────────────┐  │
│  │   Vanilla JS UI  │     │      Service Worker              │  │
│  │  (app.js, ui.js) │◄───►│  - Cache app shell              │  │
│  │                  │     │  - Cache model files (1GB+)     │  │
│  │  - Message List  │     │  - Offline-first strategy       │  │
│  │  - Input Area    │     └─────────────────────────────────┘  │
│  │  - Sidebar       │                                          │
│  │  - Settings      │     ┌─────────────────────────────────┐  │
│  │  - Model Compare │     │      Web Worker (Blob URL)       │  │
│  └────────┬─────────┘     │  - Embedded in model-manager.js │  │
│           │               │  - transformers.js pipeline      │  │
│           │               │  - Model inference (WebGPU)      │  │
│           └──────────────►│  - Streaming tokens back         │  │
│                           └─────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  IndexedDB (Dexie.js)                    │   │
│  │  - Conversations (id, title, createdAt, updatedAt)       │   │
│  │  - Messages (id, conversationId, role, content, model)   │   │
│  │  - Settings (theme, temperature, maxTokens, systemPrompt)│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Cache Storage                         │   │
│  │  - ONNX model files (~1.5GB for Phi-3, ~400MB for Qwen) │   │
│  │  - WASM runtime files                                    │   │
│  │  - App shell (HTML, CSS, JS)                            │   │
│  │  - CDN resources (transformers.js, Dexie, marked)       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **UI** | Vanilla JS + CSS | Zero dependencies, fastest load, simpler caching |
| **ML Runtime** | transformers.js v3.8.0 | Best-in-class browser ML, WebGPU support |
| **Storage** | IndexedDB (Dexie.js v3.2.4) | Structured chat storage, simple API |
| **Offline** | Service Worker + Cache API | Cache-first strategy, PWA support |
| **Styling** | CSS Custom Properties | Dark/light themes, no build step |
| **Markdown** | marked.js v12 | Lightweight markdown rendering |

---

## Supported Models

| Model | Size | Use Case |
|-------|------|----------|
| `HuggingFaceTB/SmolLM2-1.7B-Instruct` | ~1.7GB | Balanced performance |
| `onnx-community/granite-3.0-2b-instruct` | ~2GB | High quality instruction following |
| `onnx-community/Qwen2.5-1.5B-Instruct` | ~1.5GB | Fast and capable |
| `onnx-community/Phi-3.5-mini-instruct-onnx-web` | ~2.2GB | Best reasoning capabilities |

---

## File Structure

```text
in-browser-chatbot/
├── frontend/
│   ├── index.html              # Main app shell
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   │
│   ├── css/
│   │   └── styles.css          # All styles (~1100 lines)
│   │
│   ├── js/
│   │   ├── app.js              # Main controller (~400 lines)
│   │   ├── ui.js               # DOM manipulation (~400 lines)
│   │   ├── chat-store.js       # IndexedDB wrapper (~150 lines)
│   │   ├── model-manager.js    # Worker management + embedded worker (~350 lines)
│   │   ├── export.js           # JSON/Markdown export (~80 lines)
│   │   └── utils.js            # Helpers and constants (~200 lines)
│   │
│   └── icons/
│       ├── favicon.svg
│       ├── icon-192.svg
│       └── icon-512.svg
│
├── docs/
│   ├── architecture.md         # This document
│   └── PROJECT_PLAN.md         # Progress tracking
│
└── .github/
    └── instructions/
        └── frontend.instructions.md  # AI assistant guidelines
```

---

## Key Technical Decisions

### 1. Blob URL Workers

**Problem:** ES Module workers with dynamic `import()` from CDN fail silently in browsers due to CORS and module resolution issues.

**Solution:** Embed worker code as a string in `model-manager.js` and create the worker via Blob URL:

```javascript
const WORKER_CODE = `
  // Worker code here...
  const module = await import('https://cdn.jsdelivr.net/...');
`;

const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
const url = URL.createObjectURL(blob);
const worker = new Worker(url, { type: 'module' });
```

This approach:

- Avoids file path issues
- Works with dynamic imports from CDN
- Keeps worker code colocated with manager

### 2. No Build Step

The app uses native ES modules with import maps:

```html
<script type="importmap">
{
    "imports": {
        "dexie": "https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.mjs",
        "marked": "https://cdn.jsdelivr.net/npm/marked@12.0.0/lib/marked.esm.js"
    }
}
</script>
```

Benefits:

- No bundler configuration
- Instant development refresh
- Simpler caching strategy
- Easier debugging

### 3. Service Worker Caching Strategy

| Resource Type | Strategy | Rationale |
|---------------|----------|-----------|
| App shell (HTML, CSS, JS) | Network-first | Dev friendly, ensures latest version |
| Model files (ONNX) | Cache-first | Huge files (~1GB), immutable |
| CDN resources | Cache-first | Versioned URLs, stable |
| HuggingFace API | Cache-first | Model weights don't change |

---

## Data Models

### Conversation

```javascript
{
  id: number,              // Auto-increment
  title: string,           // Auto-generated or user-edited
  model: string,           // Primary model used
  systemPrompt: string,    // Optional custom prompt
  compareMode: boolean,    // Side-by-side enabled
  createdAt: number,       // Unix timestamp
  updatedAt: number        // Unix timestamp
}
```

### Message

```javascript
{
  id: number,              // Auto-increment
  conversationId: number,  // Foreign key
  role: 'user' | 'assistant',
  content: string,
  model: string,           // Which model generated (for compare mode)
  createdAt: number        // Unix timestamp
}
```

### Settings

```javascript
{
  theme: 'dark' | 'light' | 'system',
  temperature: number,     // 0.0 - 2.0
  maxTokens: number,       // 64 - 2048
  systemPrompt: string,
  defaultModel: string,
  compareMode: boolean,
  sidebarCollapsed: boolean
}
```

---

## Web Worker Communication Protocol

### Main Thread → Worker

```javascript
// Initialize model
{ type: 'init', model: 'Xenova/Phi-3-mini-4k-instruct_q4' }

// Generate response
{ type: 'generate', messages: [...], temperature: 0.7, maxTokens: 512, systemPrompt: '...' }

// Control
{ type: 'abort' }
{ type: 'unload' }
{ type: 'ping' }
```

### Worker → Main Thread

```javascript
// Lifecycle
{ type: 'worker-ready' }
{ type: 'ready', model: '...', device: 'webgpu' }
{ type: 'unloaded' }

// Progress
{ type: 'status', status: 'loading', message: '...' }
{ type: 'progress', file: '...', progress: 45 }

// Generation
{ type: 'generating', started: true }
{ type: 'token', token: '...', fullResponse: '...' }
{ type: 'complete', content: '...', model: '...' }
{ type: 'aborted' }

// Errors
{ type: 'error', message: '...' }
```

---

## Default System Prompt

```text
You are a helpful, harmless, and honest AI assistant running entirely in the user's browser. You provide clear, accurate, and thoughtful responses. You can help with a wide variety of tasks including answering questions, writing, coding, analysis, and creative projects. Be concise but thorough.
```

---

## Browser Requirements

### Required

- ES2022+ support (async/await, optional chaining)
- ES Modules support
- IndexedDB support
- Web Workers support

### Recommended (for best performance)

- WebGPU support (Chrome 113+, Edge 113+)
- Service Worker support

### WebGPU Browser Support (2024)

| Browser | Status |
|---------|--------|
| Chrome 113+ (desktop) | ✅ Full support |
| Edge 113+ (desktop) | ✅ Full support |
| Chrome Android 121+ | ✅ Full support |
| Safari 18+ | ⚠️ Partial support |
| Firefox | ❌ Behind flag |

**Fallback:** WASM backend (slower but universal)

---

## Performance Considerations

1. **Model Loading**
   - Show detailed progress during download
   - Models cached in browser Cache API
   - Subsequent loads are instant

2. **Inference**
   - Runs in dedicated Web Worker
   - UI remains responsive during generation
   - Streaming tokens for perceived speed

3. **Memory**
   - Models require 2-4GB RAM
   - Browser may limit worker memory
   - Consider warning for low-memory devices

4. **Storage Quotas**
   - IndexedDB: Usually 50% of disk space
   - Cache API: Similar limits
   - Models stored separately from chat data

---

## Security & Privacy

- **Zero data transmission:** All inference is local
- **No tracking:** No analytics, telemetry, or external requests (except model download)
- **User control:** Clear all data option in settings
- **HTTPS required:** Service Workers require secure context
- **CSP compatible:** No inline scripts, external resources from trusted CDNs only

---

## Future Architecture Considerations

### Multi-Model Comparison

- Spawn separate worker per model
- Parallel generation with independent streams
- Merge results in UI layer

### RAG Support (Future)

- Local vector store (likely in IndexedDB)
- Embedding model in separate worker
- Document chunking in main thread

### Voice Input (Future)

- Web Speech API for recognition
- Audio context for voice activity detection
- Stream transcription to chat input

---

**Last Updated:** December 2024
