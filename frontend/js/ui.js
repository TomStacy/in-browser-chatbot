/**
 * UI Module - DOM manipulation and rendering
 */

import { marked } from 'marked';
import { formatTime, escapeHtml, getModelDisplayName } from './utils.js';

// Configure marked for safe rendering
marked.setOptions({
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
    
    // Modals
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    exportModal: document.getElementById('export-modal'),
    closeExportBtn: document.getElementById('close-export-btn'),
    
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
    toastContainer: document.getElementById('toast-container')
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
    
    return `
        <article class="message message--${message.role}" data-id="${message.id || ''}">
            <div class="message__bubble">
                ${contentHtml}
            </div>
            <div class="message__meta">
                ${modelName ? `<span class="message__model">${modelName}</span>` : ''}
                <time class="message__time">${timeStr}</time>
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
                </div>
            </article>
            <article class="message message--assistant" data-id="${msg2.id}">
                <div class="message__bubble">${contentHtml2}</div>
                <div class="message__meta">
                    ${modelName2 ? `<span class="message__model">${modelName2}</span>` : ''}
                    <time class="message__time">${timeStr}</time>
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
}

// ============================================
// Toast Notifications
// ============================================

export function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast__message">${escapeHtml(message)}</span>`;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
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
