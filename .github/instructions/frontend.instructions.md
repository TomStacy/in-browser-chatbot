---
description: Frontend development guidelines for In-Browser Chatbot application
applyTo: 'frontend/**'
---

# Frontend Guidelines - In-Browser Chatbot

Guidelines for AI assistants working on the In-Browser Chatbot vanilla JavaScript frontend.

## Overview

Lightweight vanilla JavaScript application with zero framework dependencies. Uses modern ES modules, CSS custom properties for theming, and Web Workers for ML inference. Designed for offline-first operation as a Progressive Web App.

**Runtime**: Browser (ES2022+)
**Framework**: None (Vanilla JS)
**Build Tool**: None (native ES modules)
**Styling**: CSS Custom Properties + Modern CSS
**Storage**: IndexedDB (Dexie.js) + Cache API
**ML Runtime**: transformers.js v2 (WebGPU/WASM)

## File Structure

```
frontend/
├── index.html              # Main app shell (single page)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline support
│
├── css/
│   └── styles.css          # All styles (themes, components, layout)
│
├── js/
│   ├── app.js              # Main entry point, app controller
│   ├── ui.js               # DOM manipulation, rendering functions
│   ├── chat-store.js       # IndexedDB wrapper using Dexie.js
│   ├── model-worker.js     # Web Worker for ML inference
│   ├── model-manager.js    # Model loading, worker lifecycle
│   ├── export.js           # JSON/Markdown export functions
│   └── utils.js            # Helpers (markdown, uuid, formatting)
│
└── icons/
    ├── icon-192.png        # PWA icon
    ├── icon-512.png        # PWA icon (large)
    └── favicon.ico
```

## Core Principles

### 1. No Build Step
- Use native ES modules (`type="module"`)
- Import external libraries via CDN with import maps
- No bundling, transpilation, or minification required for development
- Keep it simple - if you can do it with vanilla JS, do it

```html
<!-- index.html -->
<script type="importmap">
{
    "imports": {
        "@xenova/transformers": "https://cdn.jsdelivr.net/npm/@xenova/transformers@2/dist/transformers.min.js",
        "dexie": "https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.mjs",
        "marked": "https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js"
    }
}
</script>
<script type="module" src="js/app.js"></script>
```

### 2. Modern JavaScript Patterns
- Use ES modules for code organization
- Prefer `const` and `let` over `var`
- Use async/await for asynchronous operations
- Use template literals for HTML generation
- Use optional chaining (`?.`) and nullish coalescing (`??`)

```javascript
// Good - Modern patterns
export async function loadConversation(id) {
    const conversation = await db.conversations.get(id);
    const messages = await db.messages
        .where('conversationId')
        .equals(id)
        .toArray();
    
    return { conversation, messages };
}

// Good - Template literals for HTML
function renderMessage(message) {
    return `
        <div class="message message--${message.role}" data-id="${message.id}">
            <div class="message__content">${renderMarkdown(message.content)}</div>
            <time class="message__time">${formatTime(message.createdAt)}</time>
        </div>
    `;
}
```

### 3. DOM Manipulation
- Cache DOM references at module level
- Use `insertAdjacentHTML` for performance
- Prefer event delegation on parent elements
- Use `data-*` attributes for component state

```javascript
// js/ui.js
const elements = {
    messageList: document.getElementById('message-list'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    sidebar: document.getElementById('sidebar'),
};

// Event delegation
elements.messageList.addEventListener('click', (e) => {
    const messageEl = e.target.closest('.message');
    if (!messageEl) return;
    
    if (e.target.matches('.message__copy-btn')) {
        copyToClipboard(messageEl.dataset.id);
    }
});

// Efficient DOM updates
export function appendMessage(message) {
    elements.messageList.insertAdjacentHTML('beforeend', renderMessage(message));
    scrollToBottom();
}
```

### 4. State Management
- Use a simple state object for UI state
- Persist to IndexedDB for data that survives sessions
- Use CustomEvents for cross-module communication

```javascript
// js/app.js
const state = {
    currentConversationId: null,
    isGenerating: false,
    compareMode: false,
    sidebarOpen: true,
    theme: 'system',
};

// State changes trigger events
function setState(updates) {
    Object.assign(state, updates);
    window.dispatchEvent(new CustomEvent('statechange', { detail: updates }));
}

// Other modules listen
window.addEventListener('statechange', (e) => {
    if ('isGenerating' in e.detail) {
        updateGeneratingUI(e.detail.isGenerating);
    }
});
```

### 5. CSS Architecture
- Use CSS custom properties for theming
- BEM-like naming convention (block__element--modifier)
- Mobile-first responsive design
- Prefer CSS Grid and Flexbox for layout

```css
/* css/styles.css */

/* Theme variables */
:root {
    --color-bg: #ffffff;
    --color-bg-secondary: #f5f5f5;
    --color-text: #1a1a1a;
    --color-text-muted: #666666;
    --color-primary: #2563eb;
    --color-border: #e5e5e5;
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 16px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}

[data-theme="dark"] {
    --color-bg: #1a1a1a;
    --color-bg-secondary: #2d2d2d;
    --color-text: #f5f5f5;
    --color-text-muted: #a0a0a0;
    --color-border: #404040;
}

/* Component example */
.message {
    padding: 1rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
}

.message--user {
    background: var(--color-primary);
    color: white;
    margin-left: auto;
    max-width: 80%;
}

.message--assistant {
    margin-right: auto;
    max-width: 80%;
}

.message__content {
    line-height: 1.6;
}

.message__time {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}
```

## Web Worker Pattern

### Worker Setup (model-worker.js)
```javascript
// js/model-worker.js
import { pipeline, env, TextStreamer } from '@xenova/transformers';

env.allowRemoteModels = true;
env.useBrowserCache = true;

let generator = null;
let currentModel = null;

self.onmessage = async (e) => {
    const { type, ...data } = e.data;
    
    switch (type) {
        case 'init':
            await initModel(data.model);
            break;
        case 'generate':
            await generate(data);
            break;
        case 'abort':
            // Handle abort
            break;
    }
};

async function initModel(modelId) {
    try {
        self.postMessage({ type: 'status', status: 'loading' });
        
        generator = await pipeline('text-generation', modelId, {
            device: 'webgpu',
            dtype: 'q4',
            progress_callback: (progress) => {
                self.postMessage({ type: 'progress', data: progress });
            }
        });
        
        currentModel = modelId;
        self.postMessage({ type: 'ready', model: modelId });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
}

async function generate({ messages, temperature, maxTokens }) {
    const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        callback_function: (token) => {
            self.postMessage({ type: 'token', data: token });
        }
    });
    
    try {
        const result = await generator(messages, {
            max_new_tokens: maxTokens,
            temperature,
            do_sample: temperature > 0,
            streamer
        });
        
        self.postMessage({ type: 'complete', data: result });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
}
```

### Main Thread Usage (model-manager.js)
```javascript
// js/model-manager.js
class ModelManager {
    constructor() {
        this.workers = new Map();
        this.readyModels = new Set();
    }
    
    async initModel(modelId) {
        if (this.workers.has(modelId)) return;
        
        const worker = new Worker('js/model-worker.js', { type: 'module' });
        this.workers.set(modelId, worker);
        
        return new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                const { type, ...data } = e.data;
                
                switch (type) {
                    case 'ready':
                        this.readyModels.add(modelId);
                        resolve();
                        break;
                    case 'progress':
                        this.onProgress?.(modelId, data.data);
                        break;
                    case 'error':
                        reject(new Error(data.error));
                        break;
                }
            };
            
            worker.postMessage({ type: 'init', model: modelId });
        });
    }
    
    async generate(modelId, messages, options = {}) {
        const worker = this.workers.get(modelId);
        if (!worker) throw new Error(`Model ${modelId} not initialized`);
        
        worker.postMessage({
            type: 'generate',
            messages,
            temperature: options.temperature ?? 0.7,
            maxTokens: options.maxTokens ?? 512
        });
    }
}

export const modelManager = new ModelManager();
```

## IndexedDB with Dexie.js

```javascript
// js/chat-store.js
import Dexie from 'dexie';

const db = new Dexie('ChatbotDB');

db.version(1).stores({
    conversations: '++id, createdAt, updatedAt',
    messages: '++id, conversationId, createdAt',
    settings: 'key'
});

export async function createConversation(title = 'New Chat') {
    const now = Date.now();
    const id = await db.conversations.add({
        title,
        createdAt: now,
        updatedAt: now,
        systemPrompt: null,
        model: null,
        compareMode: false
    });
    return id;
}

export async function addMessage(conversationId, role, content, model = null) {
    const id = await db.messages.add({
        conversationId,
        role,
        content,
        model,
        createdAt: Date.now()
    });
    
    await db.conversations.update(conversationId, {
        updatedAt: Date.now()
    });
    
    return id;
}

export async function getConversations() {
    return db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function getMessages(conversationId) {
    return db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('createdAt');
}

export async function getSetting(key, defaultValue = null) {
    const record = await db.settings.get(key);
    return record?.value ?? defaultValue;
}

export async function setSetting(key, value) {
    await db.settings.put({ key, value });
}

export { db };
```

## Service Worker

```javascript
// sw.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `chatbot-${CACHE_VERSION}`;

const APP_SHELL = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/ui.js',
    '/js/chat-store.js',
    '/js/model-manager.js',
    '/js/model-worker.js',
    '/js/export.js',
    '/js/utils.js',
    '/manifest.json'
];

// Install - cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('chatbot-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch - cache-first for app shell and models
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Model files and CDN resources - cache first, then network
    if (url.hostname.includes('huggingface.co') || 
        url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                
                return fetch(event.request).then(response => {
                    if (!response.ok) return response;
                    
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                });
            })
        );
        return;
    }
    
    // App shell - cache first
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        })
    );
});
```

## Export Functions

```javascript
// js/export.js
import { getMessages } from './chat-store.js';

export async function exportToJSON(conversationId, conversation) {
    const messages = await getMessages(conversationId);
    
    const data = {
        title: conversation.title,
        exportedAt: new Date().toISOString(),
        model: conversation.model,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            model: m.model,
            timestamp: new Date(m.createdAt).toISOString()
        }))
    };
    
    downloadFile(
        JSON.stringify(data, null, 2),
        `${sanitizeFilename(conversation.title)}.json`,
        'application/json'
    );
}

export async function exportToMarkdown(conversationId, conversation) {
    const messages = await getMessages(conversationId);
    
    let md = `# ${conversation.title}\n\n`;
    md += `*Exported: ${new Date().toLocaleString()}*\n\n`;
    md += `---\n\n`;
    
    for (const msg of messages) {
        const role = msg.role === 'user' ? '**You**' : `**Assistant** (${msg.model || 'unknown'})`;
        md += `${role}:\n\n${msg.content}\n\n---\n\n`;
    }
    
    downloadFile(
        md,
        `${sanitizeFilename(conversation.title)}.md`,
        'text/markdown'
    );
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
}
```

## Accessibility

- Use semantic HTML (`<main>`, `<nav>`, `<article>`, `<button>`)
- Include ARIA labels for icon-only buttons
- Ensure keyboard navigation works (Tab, Enter, Escape)
- Maintain focus management when modals open/close
- Use `prefers-reduced-motion` for animations

```javascript
// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        sendMessage();
    }
    
    // Escape to close sidebar on mobile
    if (e.key === 'Escape' && state.sidebarOpen) {
        toggleSidebar();
    }
    
    // Ctrl/Cmd + N for new chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewChat();
    }
});
```

## Error Handling

```javascript
// Wrap async operations
async function safeAsync(fn, fallback = null) {
    try {
        return await fn();
    } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message}`, 'error');
        return fallback;
    }
}

// Usage
const conversations = await safeAsync(
    () => getConversations(),
    []
);
```

## Testing

Since there's no build step, test by:
1. Opening in browser with DevTools
2. Testing offline mode in DevTools > Network > Offline
3. Lighthouse PWA audit
4. Manual testing on mobile devices

## Common Tasks

### Adding a New Setting
1. Add to settings schema in `chat-store.js`
2. Add UI control in settings panel (in `ui.js`)
3. Wire up change handler in `app.js`
4. Use setting value where needed

### Adding a New Model
1. Add model ID to `SUPPORTED_MODELS` constant
2. Add to model selector UI
3. Test download and inference
4. Update any model-specific prompt formatting

### Updating Cache Version
1. Increment `CACHE_VERSION` in `sw.js`
2. Update `APP_SHELL` array if files changed
3. Test that old cache is properly cleaned up

## Important Notes

- **No framework dependencies** - Keep it vanilla for simplicity and caching
- **Progressive enhancement** - App should work without JS (show loading message)
- **Offline-first** - Assume no network; network is a bonus
- **Privacy by default** - All data stays local
- **Mobile-first CSS** - Base styles for mobile, enhance for larger screens

## Resources

- [transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Dexie.js Documentation](https://dexie.org/docs/)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Workers API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [PWA Documentation (web.dev)](https://web.dev/progressive-web-apps/)
