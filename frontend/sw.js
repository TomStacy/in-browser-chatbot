/**
 * Service Worker for offline support
 * Caches app shell and model files for offline use
 */

const CACHE_VERSION = 'v8';
const CACHE_NAME = `local-ai-chat-${CACHE_VERSION}`;

// App shell files to cache immediately
const APP_SHELL = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/ui.js',
    '/js/utils.js',
    '/js/chat-store.js',
    '/js/model-manager.js',
    '/js/export.js',
    '/manifest.json'
];

// CDN resources to cache
const CDN_RESOURCES = [
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0/dist/transformers.min.js',
    'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.mjs',
    'https://cdn.jsdelivr.net/npm/marked@12.0.0/lib/marked.esm.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css'
];

// ============================================
// Install Event
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('[SW] Caching app shell...');

                // Cache app shell
                try {
                    await cache.addAll(APP_SHELL);
                } catch (error) {
                    console.warn('[SW] Failed to cache some app shell files:', error);
                }

                // Cache CDN resources (don't fail if these fail)
                for (const url of CDN_RESOURCES) {
                    try {
                        await cache.add(url);
                    } catch (error) {
                        console.warn(`[SW] Failed to cache ${url}:`, error);
                    }
                }

                console.log('[SW] App shell cached');
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================
// Activate Event
// ============================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete old versions of our cache
                            return name.startsWith('local-ai-chat-') && name !== CACHE_NAME;
                        })
                        .map((name) => {
                            console.log(`[SW] Deleting old cache: ${name}`);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// ============================================
// Fetch Event
// ============================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Strategy based on request type
    if (isModelRequest(url)) {
        // Model files: Cache-first (they're huge and don't change)
        event.respondWith(cacheFirst(event.request));
    } else if (isCDNRequest(url)) {
        // CDN resources: Cache-first
        event.respondWith(cacheFirst(event.request));
    } else if (isAppShellRequest(url)) {
        // App shell: Network-first for development friendliness
        event.respondWith(networkFirst(event.request));
    } else {
        // Everything else: Network-first with cache fallback
        event.respondWith(networkFirst(event.request));
    }
});

// ============================================
// Caching Strategies
// ============================================

/**
 * Cache-first strategy
 * Try cache, fall back to network, update cache
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);

        // Return offline page if available
        const offlineResponse = await caches.match('/index.html');
        if (offlineResponse) {
            return offlineResponse;
        }

        throw error;
    }
}

/**
 * Network-first strategy
 * Try network, fall back to cache
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        throw error;
    }
}

// ============================================
// Request Type Detection
// ============================================

function isModelRequest(url) {
    return url.hostname.includes('huggingface.co') ||
        url.pathname.includes('.onnx') ||
        url.pathname.includes('.safetensors') ||
        url.pathname.includes('model') ||
        url.pathname.includes('tokenizer');
}

function isCDNRequest(url) {
    return url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdnjs.cloudflare.com');
}

function isAppShellRequest(url) {
    return url.origin === self.location.origin &&
        (url.pathname === '/' ||
            url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.json') ||
            url.pathname.includes('/icons/'));
}

// ============================================
// Message Handling
// ============================================

self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'GET_CACHE_SIZE') {
        getCacheSize().then((size) => {
            event.ports[0].postMessage({ size });
        });
    }

    if (event.data.type === 'CLEAR_MODEL_CACHE') {
        clearModelCache().then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

/**
 * Get total cache size
 */
async function getCacheSize() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();

    let totalSize = 0;
    for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
        }
    }

    return totalSize;
}

/**
 * Clear model-related cache entries
 */
async function clearModelCache() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();

    for (const request of keys) {
        const url = new URL(request.url);
        if (isModelRequest(url)) {
            await cache.delete(request);
        }
    }
}

console.log('[SW] Service worker loaded');
