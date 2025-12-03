/**
 * UI Module - DOM manipulation and rendering
 */

import { marked } from 'marked';
import hljs from 'highlight.js';
import { formatTime, escapeHtml, getModelDisplayName, APP_VERSION } from './utils.js';

// Configure marked with highlight.js
const renderer = {
    code(code, infostring) {
        const language = hljs.getLanguage(infostring) ? infostring : 'plaintext';
        const highlighted = hljs.highlight(code, { language }).value;
        return `
            <div class="code-block">
                <div class="code-block__header">
                    <span class="code-block__lang">${language}</span>
                    <button class="btn-copy-code" aria-label="Copy code">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code class="hljs language-${language}">${highlighted}</code></pre>
            </div>
        `;
    }
};

marked.use({ 
    renderer,
    breaks: true,
    gfm: true
});

// ============================================
// DOM Element Cache
// ============================================

export const elements = {
    // App
    app: document.getElementById('app'),
    
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    newChatBtn: document.getElementById('new-chat-btn'),
    conversationList: document.getElementById('conversation-list'),
    installBtn: document.getElementById('install-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // Chat Header
    chatTitle: document.getElementById('chat-title'),
    modelBadge: document.getElementById('model-badge'),
    compareToggle: document.getElementById('compare-toggle'),
    exportBtn: document.getElementById('export-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    
    // Status Bar
    statusBar: document.getElementById('status-bar'),
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    
    // Messages
    messagesContainer: document.getElementById('messages-container'),
    messageList: document.getElementById('message-list'),
    scrollBottomBtn: document.getElementById('scroll-bottom-btn'),
    
    // Input
    modelSelect: document.getElementById('model-select'),
    loadModelBtn: document.getElementById('load-model-btn'),
    compareModelSelector: document.getElementById('compare-model-selector'),
    modelSelectCompare: document.getElementById('model-select-compare'),
    loadModelCompareBtn: document.getElementById('load-model-compare-btn'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    regenerateBtn: document.getElementById('regenerate-btn'),
    
    // Modals
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    exportModal: document.getElementById('export-modal'),
    closeExportBtn: document.getElementById('close-export-btn'),
    shortcutsModal: document.getElementById('shortcuts-modal'),
    closeShortcutsBtn: document.getElementById('close-shortcuts-btn'),
    
    // Settings Controls
    themeSelect: document.getElementById('theme-select'),
    temperatureSlider: document.getElementById('temperature-slider'),
    tempValue: document.getElementById('temp-value'),
    maxTokensSlider: document.getElementById('max-tokens-slider'),
    tokensValue: document.getElementById('tokens-value'),
    systemPrompt: document.getElementById('system-prompt'),
    resetPromptBtn: document.getElementById('reset-prompt-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    
    // Export Controls
    exportJsonBtn: document.getElementById('export-json-btn'),
    exportMdBtn: document.getElementById('export-md-btn'),
    
    // Toast
    toastContainer: document.getElementById('toast-container'),

    // App Info
    appVersion: document.getElementById('app-version')
};

// ============================================
// Theme Management
// ============================================

export function setTheme(theme) {
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
        document.body.dataset.theme = theme;
    }
}

export function getEffectiveTheme() {
    return document.body.dataset.theme;
}

// ============================================
// Sidebar
// ============================================

export function toggleSidebar(collapsed) {
    elements.sidebar.classList.toggle('collapsed', collapsed);
}

export function isSidebarCollapsed() {
    return elements.sidebar.classList.contains('collapsed');
}

export function renderConversationList(conversations, activeId = null) {
    if (conversations.length === 0) {
        elements.conversationList.innerHTML = `
            <div class="sidebar__empty">
                <p>No conversations yet</p>
                <p class="text-muted">Start a new chat to begin</p>
            </div>
        `;
        return;
    }
    
    elements.conversationList.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.id === activeId ? 'active' : ''}" 
             data-id="${conv.id}">
            <span class="conversation-item__title">${escapeHtml(conv.title)}</span>
            <button class="conversation-item__delete btn btn--ghost btn--icon" 
                    data-action="delete" 
                    data-id="${conv.id}"
                    aria-label="Delete conversation">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

export function setActiveConversation(id) {
    elements.conversationList.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === id);
    });
}

// ============================================
// Status Bar
// ============================================

export function setStatus(status, message) {
    elements.statusBar.className = `status-bar ${status}`;
    elements.statusText.textContent = message;
    
    // Update icon based on status
    if (status === 'ready') {
        elements.statusIcon.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    } else if (status === 'error') {
        elements.statusIcon.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `;
    } else {
        elements.statusIcon.innerHTML = '<div class="spinner"></div>';
    }
}

export function showProgress(visible) {
    elements.progressContainer.classList.toggle('hidden', !visible);
}

export function updateProgress(percent, text = null) {
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = text || `${percent}%`;
}

// ============================================
// Messages
// ============================================

export function clearMessages() {
    elements.messageList.innerHTML = '';
}

export function showWelcome() {
    elements.messageList.innerHTML = `
        <div class="welcome">
            <div class="welcome__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                </svg>
            </div>
            <h2>Welcome to Local AI Chat</h2>
            <p>Your 100% private, offline-capable AI assistant.</p>
            <ul class="welcome__features">
                <li>🔒 All processing happens on your device</li>
                <li>📴 Works offline after initial download</li>
                <li>💾 Conversations stored locally</li>
                <li>🚀 Powered by WebGPU acceleration</li>
            </ul>
            <p class="text-muted">Select a model below to get started.</p>
        </div>
    `;
}

export function renderMessage(message) {
    const timeStr = formatTime(message.createdAt);
    const modelName = message.model ? getModelDisplayName(message.model) : null;
    const contentHtml = message.role === 'assistant' 
        ? marked.parse(message.content)
        : escapeHtml(message.content).replace(/\n/g, '<br>');
    
    const editBtn = message.role === 'user' ? `
        <button class="btn-edit-message" aria-label="Edit message">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>
    ` : '';

    return `
        <article class="message message--${message.role}" data-id="${message.id || ''}">
            <div class="message__bubble">
                ${contentHtml}
            </div>
            <div class="message__meta">
                ${modelName ? `<span class="message__model">${modelName}</span>` : ''}
                <time class="message__time">${timeStr}</time>
                ${editBtn}
                <button class="btn-copy-message" aria-label="Copy message">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        </article>
    `;
}

export function appendMessage(message) {
    // Remove welcome if present
    const welcome = elements.messageList.querySelector('.welcome');
    if (welcome) {
        welcome.remove();
    }
    
    elements.messageList.insertAdjacentHTML('beforeend', renderMessage(message));
    scrollToBottom();
}

export function toggleCompareMode(enabled) {
    elements.compareModelSelector.classList.toggle('hidden', !enabled);
    elements.compareToggle.classList.toggle('active', enabled);
}

export function createComparisonRow(model1, model2) {
    const rowId = 'row-' + Date.now();
    const id1 = 'streaming-' + Date.now() + '-1';
    const id2 = 'streaming-' + Date.now() + '-2';
    
    const modelName1 = model1 ? getModelDisplayName(model1) : null;
    const modelName2 = model2 ? getModelDisplayName(model2) : null;

    const html = `
        <div class="message-group" id="${rowId}">
            <article class="message message--assistant" data-id="${id1}">
                <div class="message__bubble">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                <div class="message__meta">
                    ${modelName1 ? `<span class="message__model">${modelName1}</span>` : ''}
                    <time class="message__time">now</time>
                </div>
            </article>
            <article class="message message--assistant" data-id="${id2}">
                <div class="message__bubble">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                <div class="message__meta">
                    ${modelName2 ? `<span class="message__model">${modelName2}</span>` : ''}
                    <time class="message__time">now</time>
                </div>
            </article>
        </div>
    `;

    // Remove welcome if present
    const welcome = elements.messageList.querySelector('.welcome');
    if (welcome) {
        welcome.remove();
    }

    elements.messageList.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    return { rowId, id1, id2 };
}

export function renderComparisonGroup(msg1, msg2) {
    const timeStr = formatTime(msg1.createdAt);
    const modelName1 = msg1.model ? getModelDisplayName(msg1.model) : null;
    const modelName2 = msg2.model ? getModelDisplayName(msg2.model) : null;
    
    const contentHtml1 = marked.parse(msg1.content);
    const contentHtml2 = marked.parse(msg2.content);

    return `
        <div class="message-group">
            <article class="message message--assistant" data-id="${msg1.id}">
                <div class="message__bubble">${contentHtml1}</div>
                <div class="message__meta">
                    ${modelName1 ? `<span class="message__model">${modelName1}</span>` : ''}
                    <time class="message__time">${timeStr}</time>
                    <button class="btn-copy-message" aria-label="Copy message">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </article>
            <article class="message message--assistant" data-id="${msg2.id}">
                <div class="message__bubble">${contentHtml2}</div>
                <div class="message__meta">
                    ${modelName2 ? `<span class="message__model">${modelName2}</span>` : ''}
                    <time class="message__time">${timeStr}</time>
                    <button class="btn-copy-message" aria-label="Copy message">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </article>
        </div>
    `;
}

export function renderMessages(messages) {
    if (messages.length === 0) {
        showWelcome();
        return;
    }
    
    let html = '';
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const nextMsg = messages[i+1];
        
        // Check if this and next message are assistant messages (simple grouping heuristic)
        // Ideally we should check if they are responses to the same user message, but this works for now
        if (msg.role === 'assistant' && nextMsg?.role === 'assistant') {
            html += renderComparisonGroup(msg, nextMsg);
            i++; // Skip next message
        } else {
            html += renderMessage(msg);
        }
    }
    
    elements.messageList.innerHTML = html;
    scrollToBottom(false); // No smooth scroll on initial render
}

export function createStreamingMessage(model = null) {
    const id = 'streaming-' + Date.now();
    const modelName = model ? getModelDisplayName(model) : null;
    
    const html = `
        <article class="message message--assistant" data-id="${id}">
            <div class="message__bubble">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <div class="message__meta">
                ${modelName ? `<span class="message__model">${modelName}</span>` : ''}
                <time class="message__time">now</time>
            </div>
        </article>
    `;
    
    // Remove welcome if present
    const welcome = elements.messageList.querySelector('.welcome');
    if (welcome) {
        welcome.remove();
    }
    
    elements.messageList.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
    
    return id;
}

export function updateStreamingMessage(id, content) {
    const messageEl = elements.messageList.querySelector(`[data-id="${id}"]`);
    if (messageEl) {
        const bubble = messageEl.querySelector('.message__bubble');
        bubble.innerHTML = marked.parse(content) + '<span class="cursor">▊</span>';
        scrollToBottom();
    }
}

export function finalizeStreamingMessage(id, content, messageId) {
    const messageEl = elements.messageList.querySelector(`[data-id="${id}"]`);
    if (messageEl) {
        const bubble = messageEl.querySelector('.message__bubble');
        bubble.innerHTML = marked.parse(content);
        messageEl.dataset.id = messageId;
        
        const timeEl = messageEl.querySelector('.message__time');
        if (timeEl) {
            timeEl.textContent = formatTime(Date.now());
        }
    }
}

export function removeStreamingMessage(id) {
    const messageEl = elements.messageList.querySelector(`[data-id="${id}"]`);
    if (messageEl) {
        messageEl.remove();
    }
}

export function updateMessageError(id, errorMessage, onRetry) {
    const messageEl = elements.messageList.querySelector(`[data-id="${id}"]`);
    if (messageEl) {
        const bubble = messageEl.querySelector('.message__bubble');
        bubble.innerHTML = `
            <div class="error-message">
                <div class="error-message__content">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>${escapeHtml(errorMessage)}</span>
                </div>
                <button class="btn btn--sm btn--outline btn-retry">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Retry
                </button>
            </div>
        `;
        bubble.classList.add('message__bubble--error');
        
        const retryBtn = bubble.querySelector('.btn-retry');
        retryBtn.addEventListener('click', () => {
            // Reset UI state for retry
            bubble.classList.remove('message__bubble--error');
            bubble.innerHTML = `
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            `;
            onRetry();
        });
    }
}

// ============================================
// Scroll Management
// ============================================

export function scrollToBottom(smooth = true) {
    const container = elements.messagesContainer;
    container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

export function updateScrollButton() {
    const container = elements.messagesContainer;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    elements.scrollBottomBtn.classList.toggle('hidden', isNearBottom);
}

// ============================================
// Input State
// ============================================

export function setInputEnabled(enabled) {
    elements.chatInput.disabled = !enabled;
    elements.sendBtn.disabled = !enabled;
}

export function setGenerating(generating) {
    elements.sendBtn.classList.toggle('hidden', generating);
    elements.stopBtn.classList.toggle('hidden', !generating);
    elements.chatInput.disabled = generating;
    
    if (generating) {
        elements.regenerateBtn.classList.add('hidden');
    }
}

export function setRegenerateEnabled(enabled) {
    elements.regenerateBtn.classList.toggle('hidden', !enabled);
}

export function clearInput() {
    elements.chatInput.value = '';
    autoResizeTextarea(elements.chatInput);
}

export function focusInput() {
    elements.chatInput.focus();
}

export function getInputValue() {
    return elements.chatInput.value.trim();
}

// ============================================
// Model Selection
// ============================================

export function setModelSelectEnabled(enabled) {
    elements.modelSelect.disabled = !enabled;
    elements.loadModelBtn.disabled = !enabled || !elements.modelSelect.value;
}

export function getSelectedModel() {
    return elements.modelSelect.value;
}

export function setSelectedModel(modelId) {
    elements.modelSelect.value = modelId || '';
}

export function updateModelBadge(modelId) {
    if (modelId) {
        elements.modelBadge.textContent = getModelDisplayName(modelId);
        elements.modelBadge.classList.add('badge--model');
    } else {
        elements.modelBadge.textContent = 'No model loaded';
        elements.modelBadge.classList.remove('badge--model');
    }
}

// ============================================
// Chat Title
// ============================================

export function setChatTitle(title) {
    elements.chatTitle.textContent = title || 'New Chat';
}

// ============================================
// Modals
// ============================================

export function openModal(modal) {
    modal.showModal();
}

export function closeModal(modal) {
    modal.close();
}

export function openSettings() {
    openModal(elements.settingsModal);
}

export function closeSettings() {
    closeModal(elements.settingsModal);
}

export function openExportModal() {
    openModal(elements.exportModal);
}

export function closeExportModal() {
    closeModal(elements.exportModal);
}

export function openShortcutsModal() {
    openModal(elements.shortcutsModal);
}

export function closeShortcutsModal() {
    closeModal(elements.shortcutsModal);
}

// ============================================
// Settings UI
// ============================================

export function updateSettingsUI(settings) {
    elements.themeSelect.value = settings.theme || 'dark';
    elements.temperatureSlider.value = settings.temperature ?? 0.7;
    elements.tempValue.textContent = settings.temperature ?? 0.7;
    elements.maxTokensSlider.value = settings.maxTokens ?? 512;
    elements.tokensValue.textContent = settings.maxTokens ?? 512;
    elements.systemPrompt.value = settings.systemPrompt || '';
    
    // Update version
    if (elements.appVersion) {
        elements.appVersion.textContent = APP_VERSION;
    }
}

// ============================================
// Toast Notifications
// ============================================

export function showToast(message, type = 'info', duration = 4000, action = null) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast__message">${escapeHtml(message)}</span>`;
    
    if (action) {
        const btn = document.createElement('button');
        btn.className = 'btn btn--sm btn--white';
        btn.textContent = action.text;
        btn.style.marginLeft = '1rem';
        btn.onclick = action.callback;
        toast.appendChild(btn);
    }

    elements.toastContainer.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// ============================================
// Edit Functionality
// ============================================

export function setupEditListeners(onEdit) {
    elements.messageList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-message');
        if (editBtn) {
            const messageEl = editBtn.closest('.message');
            const bubble = messageEl.querySelector('.message__bubble');
            // For user messages, innerText preserves newlines correctly because we used <br>
            const currentContent = bubble.innerText; 
            
            showEditForm(messageEl, currentContent, onEdit);
        }
    });
}

function showEditForm(messageEl, content, onSave) {
    const bubble = messageEl.querySelector('.message__bubble');
    const originalContent = bubble.innerHTML;
    
    // Prevent multiple edit forms
    if (bubble.querySelector('.edit-form')) return;

    bubble.innerHTML = `
        <div class="edit-form">
            <textarea class="edit-form__textarea" rows="1">${content}</textarea>
            <div class="edit-form__actions">
                <button class="btn btn--sm btn--primary btn-save">Save & Regenerate</button>
                <button class="btn btn--sm btn--ghost btn-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    const textarea = bubble.querySelector('textarea');
    
    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    textarea.focus();
    
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    });

    // Handle Enter to save (Ctrl+Enter)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') {
            cancel();
        }
    });
    
    const saveBtn = bubble.querySelector('.btn-save');
    const cancelBtn = bubble.querySelector('.btn-cancel');
    
    function cancel() {
        bubble.innerHTML = originalContent;
    }

    function save() {
        const newContent = textarea.value.trim();
        if (newContent && newContent !== content) {
            onSave(parseInt(messageEl.dataset.id), newContent);
        } else {
            cancel();
        }
    }
    
    cancelBtn.addEventListener('click', cancel);
    saveBtn.addEventListener('click', save);
}

// ============================================
// Copy Functionality
// ============================================

export function setupCopyListeners() {
    elements.messageList.addEventListener('click', async (e) => {
        // Copy Code Block
        const copyCodeBtn = e.target.closest('.btn-copy-code');
        if (copyCodeBtn) {
            const codeBlock = copyCodeBtn.closest('.code-block');
            const code = codeBlock.querySelector('code').textContent;
            await copyToClipboard(code, copyCodeBtn);
            return;
        }

        // Copy Message
        const copyMsgBtn = e.target.closest('.btn-copy-message');
        if (copyMsgBtn) {
            const messageEl = copyMsgBtn.closest('.message');
            const bubble = messageEl.querySelector('.message__bubble');
            const text = bubble.innerText;
            await copyToClipboard(text, copyMsgBtn);
            return;
        }
    });
}

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        
        // Visual feedback
        const originalHtml = button.innerHTML;
        button.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${button.querySelector('span') ? '<span>Copied!</span>' : ''}
        `;
        button.classList.add('success');
        
        setTimeout(() => {
            button.innerHTML = originalHtml;
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

// ============================================
// Textarea Auto-resize
// ============================================

export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Initialize textarea auto-resize
elements.chatInput.addEventListener('input', () => {
    autoResizeTextarea(elements.chatInput);
});
