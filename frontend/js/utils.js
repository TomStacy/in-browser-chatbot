/**
 * Utility functions for the chatbot application
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
export function uuid() {
    return crypto.randomUUID?.() ??
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}

/**
 * Format a timestamp for display
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function}
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string}
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Sanitize filename for export
 * @param {string} name - Original filename
 * @returns {string}
 */
export function sanitizeFilename(name) {
    return name
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 50) || 'conversation';
}

/**
 * Download a file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Generate a title from the first message
 * @param {string} content - Message content
 * @param {number} maxLength - Maximum title length
 * @returns {string}
 */
export function generateTitle(content, maxLength = 50) {
    // Remove markdown, code blocks, etc.
    const cleaned = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/[#*_~\[\]()]/g, '')
        .replace(/\n+/g, ' ')
        .trim();

    if (cleaned.length <= maxLength) {
        return cleaned || 'New Chat';
    }

    // Try to cut at a word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.6) {
        return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
}

/**
 * Check if WebGPU is supported
 * @returns {Promise<boolean>}
 */
export async function isWebGPUSupported() {
    if (!navigator.gpu) {
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Parse model name for display
 * @param {string} modelId - Full model ID (e.g., "Xenova/Phi-3-mini-4k-instruct_q4")
 * @returns {string}
 */
export function getModelDisplayName(modelId) {
    if (!modelId) return 'Unknown';

    const parts = modelId.split('/');
    const name = parts[parts.length - 1];

    // Clean up common suffixes
    return name
        .replace(/_q\d+/g, '')
        .replace(/-Instruct/gi, '')
        .replace(/-instruct/gi, '')
        .replace(/_/g, ' ');
}

/**
 * Default system prompt
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful, harmless, and honest AI assistant running entirely in the user's browser. You provide clear, accurate, and thoughtful responses. You can help with a wide variety of tasks including answering questions, writing, coding, analysis, and creative projects. Be concise but thorough.`;

/**
 * Supported models configuration
 */
export const SUPPORTED_MODELS = [
    {
        id: 'onnx-community/Qwen2.5-0.5B-Instruct',
        name: 'Qwen 2.5 0.5B (Instruct)',
        description: 'Lite model, faster download (~400MB)',
        size: '400MB'
    },
    {
        id: 'Xenova/Phi-3-mini-4k-instruct_q4',
        name: 'Phi-3 Mini 4K',
        description: 'Full capability model (~1.5GB)',
        size: '1.5GB'
    }
];
