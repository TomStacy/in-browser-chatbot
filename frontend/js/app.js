/**
 * Main Application Controller
 * Coordinates all modules and handles user interactions
 */

import * as ui from './ui.js';
import * as store from './chat-store.js';
import { modelManager } from './model-manager.js';
import { exportToJSON, exportToMarkdown } from './export.js';
import {
    DEFAULT_SYSTEM_PROMPT,
    generateTitle,
    debounce,
    isWebGPUSupported
} from './utils.js?v=2';

// ============================================
// Application State
// ============================================

const state = {
    currentConversationId: null,
    currentModel: null,
    isGenerating: false,
    settings: null,
    conversations: []
};

// ============================================
// Initialization
// ============================================

async function init() {
    console.log('🚀 Initializing Local AI Chat...');

    // Check WebGPU support
    const hasWebGPU = await isWebGPUSupported();
    if (hasWebGPU) {
        console.log('✅ WebGPU is supported');
    } else {
        console.log('⚠️ WebGPU not available, will use WASM fallback');
    }

    // Initialize settings
    state.settings = await store.initializeSettings();

    // Apply theme
    ui.setTheme(state.settings.theme);
    ui.updateSettingsUI(state.settings);

    // Apply sidebar state
    if (state.settings.sidebarCollapsed) {
        ui.toggleSidebar(true);
    }

    // Load conversations
    await loadConversations();

    // Set up event listeners
    setupEventListeners();

    // Set up model manager callbacks
    setupModelCallbacks();

    // Update status
    ui.setStatus('ready', 'Select a model to start chatting');

    // Register service worker
    registerServiceWorker();

    console.log('✅ Initialization complete');
}

// ============================================
// Service Worker Registration
// ============================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('✅ Service Worker registered:', registration.scope);
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }
}

// ============================================
// Conversation Management
// ============================================

async function loadConversations() {
    state.conversations = await store.getConversations();
    ui.renderConversationList(state.conversations, state.currentConversationId);
}

async function createNewConversation() {
    const id = await store.createConversation('New Chat', state.currentModel);
    state.currentConversationId = id;

    await loadConversations();

    ui.clearMessages();
    ui.showWelcome();
    ui.setChatTitle('New Chat');
    ui.clearInput();
    ui.focusInput();

    // Collapse sidebar on mobile
    if (window.innerWidth <= 768) {
        ui.toggleSidebar(true);
    }
}

async function loadConversation(id) {
    const conversation = await store.getConversation(id);
    if (!conversation) {
        ui.showToast('Conversation not found', 'error');
        return;
    }

    state.currentConversationId = id;

    const messages = await store.getMessages(id);

    ui.setChatTitle(conversation.title);
    ui.renderMessages(messages);
    ui.setActiveConversation(id);

    // Restore model selection if recorded
    if (conversation.model) {
        ui.setSelectedModel(conversation.model);
        // Update load button state
        ui.elements.loadModelBtn.disabled = false;
    }

    // Collapse sidebar on mobile
    if (window.innerWidth <= 768) {
        ui.toggleSidebar(true);
    }
}

async function deleteConversation(id) {
    if (!confirm('Delete this conversation?')) {
        return;
    }

    await store.deleteConversation(id);

    if (state.currentConversationId === id) {
        state.currentConversationId = null;
        ui.clearMessages();
        ui.showWelcome();
        ui.setChatTitle('New Chat');
    }

    await loadConversations();
    ui.showToast('Conversation deleted', 'success');
}

// ============================================
// Model Management
// ============================================

function setupModelCallbacks() {
    modelManager.onProgress = (modelId, progress) => {
        ui.showProgress(true);
        ui.updateProgress(progress.progress, `${progress.file}: ${progress.progress}%`);
    };

    modelManager.onStatusChange = (modelId, status, message) => {
        ui.setStatus(status, message);
    };

    modelManager.onModelReady = (modelId, device) => {
        state.currentModel = modelId;
        ui.showProgress(false);
        ui.setStatus('ready', `Model ready (${device || 'wasm'})`);
        ui.updateModelBadge(modelId);
        ui.setInputEnabled(true);
        ui.setModelSelectEnabled(true);
        ui.showToast('Model loaded successfully!', 'success');
    };

    modelManager.onError = (modelId, message) => {
        ui.showProgress(false);
        ui.setStatus('error', message);
        ui.setModelSelectEnabled(true);
        ui.showToast(`Error: ${message}`, 'error');
    };
}

async function loadModel() {
    const modelId = ui.getSelectedModel();
    if (!modelId) {
        ui.showToast('Please select a model', 'warning');
        return;
    }

    ui.setModelSelectEnabled(false);
    ui.setInputEnabled(false);
    ui.showProgress(true);
    ui.updateProgress(0, 'Starting...');
    ui.setStatus('loading', 'Loading model...');

    try {
        await modelManager.initModel(modelId);
    } catch (error) {
        console.error('Failed to load model:', error);
        // Error handled by callback
    }
}

// ============================================
// Message Handling
// ============================================

async function sendMessage() {
    const content = ui.getInputValue();
    if (!content) return;

    if (!state.currentModel || !modelManager.isModelReady(state.currentModel)) {
        ui.showToast('Please load a model first', 'warning');
        return;
    }

    // Create conversation if needed
    if (!state.currentConversationId) {
        await createNewConversation();
    }

    // Save and display user message
    const userMsgId = await store.addMessage(
        state.currentConversationId,
        'user',
        content
    );

    ui.appendMessage({
        id: userMsgId,
        role: 'user',
        content,
        createdAt: Date.now()
    });

    ui.clearInput();

    // Update title if first message
    const messages = await store.getMessages(state.currentConversationId);
    if (messages.length === 1) {
        const title = generateTitle(content);
        await store.updateConversation(state.currentConversationId, { title });
        ui.setChatTitle(title);
        await loadConversations();
    }

    // Generate response
    await generateResponse();
}

async function generateResponse() {
    if (state.isGenerating) return;

    state.isGenerating = true;
    ui.setGenerating(true);

    // Get conversation history
    const messages = await store.getMessages(state.currentConversationId);
    const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
    }));

    // Create streaming message element
    const streamingId = ui.createStreamingMessage(state.currentModel);
    let fullResponse = '';

    try {
        await modelManager.generate(state.currentModel, chatHistory, {
            temperature: state.settings.temperature,
            maxTokens: state.settings.maxTokens,
            systemPrompt: state.settings.systemPrompt,

            onToken: (token, accumulated) => {
                fullResponse = accumulated;
                ui.updateStreamingMessage(streamingId, accumulated);
            },

            onComplete: async (content, model) => {
                // Save assistant message
                const msgId = await store.addMessage(
                    state.currentConversationId,
                    'assistant',
                    content,
                    model
                );

                ui.finalizeStreamingMessage(streamingId, content, msgId);
            },

            onAborted: () => {
                if (fullResponse) {
                    ui.finalizeStreamingMessage(streamingId, fullResponse + '\n\n*[Generation stopped]*', null);
                } else {
                    ui.removeStreamingMessage(streamingId);
                }
            },

            onError: (message) => {
                ui.removeStreamingMessage(streamingId);
                ui.showToast(`Generation failed: ${message}`, 'error');
            }
        });
    } catch (error) {
        console.error('Generation error:', error);
        ui.removeStreamingMessage(streamingId);
        ui.showToast(`Error: ${error.message}`, 'error');
    } finally {
        state.isGenerating = false;
        ui.setGenerating(false);
        ui.focusInput();
    }
}

function stopGeneration() {
    if (state.isGenerating && state.currentModel) {
        modelManager.abort(state.currentModel);
    }
}

// ============================================
// Settings Management
// ============================================

async function updateSetting(key, value) {
    state.settings[key] = value;
    await store.setSetting(key, value);
}

async function handleThemeChange(theme) {
    await updateSetting('theme', theme);
    ui.setTheme(theme);
}

async function handleTemperatureChange(value) {
    const temp = parseFloat(value);
    ui.elements.tempValue.textContent = temp;
    await updateSetting('temperature', temp);
}

async function handleMaxTokensChange(value) {
    const tokens = parseInt(value);
    ui.elements.tokensValue.textContent = tokens;
    await updateSetting('maxTokens', tokens);
}

async function handleSystemPromptChange(value) {
    await updateSetting('systemPrompt', value);
}

async function resetSystemPrompt() {
    ui.elements.systemPrompt.value = DEFAULT_SYSTEM_PROMPT;
    await updateSetting('systemPrompt', DEFAULT_SYSTEM_PROMPT);
    ui.showToast('System prompt reset to default', 'success');
}

async function clearModelCache() {
    if (!confirm('Clear all cached model files? You will need to re-download models.')) {
        return;
    }

    try {
        // Clear caches
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
            if (name.includes('transformers') || name.includes('chatbot')) {
                await caches.delete(name);
            }
        }

        // Unload current model
        modelManager.unloadAll();
        state.currentModel = null;

        ui.updateModelBadge(null);
        ui.setInputEnabled(false);
        ui.setStatus('ready', 'Model cache cleared');
        ui.showToast('Model cache cleared', 'success');
    } catch (error) {
        console.error('Failed to clear cache:', error);
        ui.showToast('Failed to clear cache', 'error');
    }
}

async function clearAllData() {
    if (!confirm('Delete all conversations and settings? This cannot be undone.')) {
        return;
    }

    try {
        await store.deleteAllConversations();
        state.currentConversationId = null;
        state.conversations = [];

        // Re-initialize settings to defaults
        state.settings = await store.initializeSettings();

        ui.clearMessages();
        ui.showWelcome();
        ui.setChatTitle('New Chat');
        ui.renderConversationList([]);
        ui.updateSettingsUI(state.settings);
        ui.setTheme(state.settings.theme);
        ui.closeSettings();

        ui.showToast('All data deleted', 'success');
    } catch (error) {
        console.error('Failed to clear data:', error);
        ui.showToast('Failed to clear data', 'error');
    }
}

// ============================================
// Export
// ============================================

async function handleExport(format) {
    if (!state.currentConversationId) {
        ui.showToast('No conversation to export', 'warning');
        return;
    }

    try {
        if (format === 'json') {
            await exportToJSON(state.currentConversationId);
        } else {
            await exportToMarkdown(state.currentConversationId);
        }
        ui.closeExportModal();
        ui.showToast('Conversation exported!', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        ui.showToast('Export failed', 'error');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Sidebar
    ui.elements.sidebarToggle.addEventListener('click', () => {
        const collapsed = !ui.isSidebarCollapsed();
        ui.toggleSidebar(collapsed);
        updateSetting('sidebarCollapsed', collapsed);
    });

    ui.elements.newChatBtn.addEventListener('click', createNewConversation);

    ui.elements.conversationList.addEventListener('click', (e) => {
        const item = e.target.closest('.conversation-item');
        if (!item) return;

        const deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
            e.stopPropagation();
            deleteConversation(parseInt(deleteBtn.dataset.id));
            return;
        }

        loadConversation(parseInt(item.dataset.id));
    });

    // Model loading
    ui.elements.modelSelect.addEventListener('change', () => {
        ui.elements.loadModelBtn.disabled = !ui.elements.modelSelect.value;
    });

    ui.elements.loadModelBtn.addEventListener('click', loadModel);

    // Chat input
    ui.elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            sendMessage();
        }
    });

    ui.elements.sendBtn.addEventListener('click', sendMessage);
    ui.elements.stopBtn.addEventListener('click', stopGeneration);

    // Scroll
    ui.elements.messagesContainer.addEventListener('scroll', debounce(ui.updateScrollButton, 100));
    ui.elements.scrollBottomBtn.addEventListener('click', () => ui.scrollToBottom());

    // Header actions
    ui.elements.themeToggle.addEventListener('click', () => {
        const current = ui.getEffectiveTheme();
        const newTheme = current === 'dark' ? 'light' : 'dark';
        handleThemeChange(newTheme);
        ui.elements.themeSelect.value = newTheme;
    });

    ui.elements.exportBtn.addEventListener('click', () => {
        if (!state.currentConversationId) {
            ui.showToast('No conversation to export', 'warning');
            return;
        }
        ui.openExportModal();
    });

    ui.elements.settingsBtn.addEventListener('click', ui.openSettings);

    // Settings modal
    ui.elements.closeSettingsBtn.addEventListener('click', ui.closeSettings);
    ui.elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === ui.elements.settingsModal) {
            ui.closeSettings();
        }
    });

    ui.elements.themeSelect.addEventListener('change', (e) => {
        handleThemeChange(e.target.value);
    });

    ui.elements.temperatureSlider.addEventListener('input', (e) => {
        handleTemperatureChange(e.target.value);
    });

    ui.elements.maxTokensSlider.addEventListener('input', (e) => {
        handleMaxTokensChange(e.target.value);
    });

    ui.elements.systemPrompt.addEventListener('change', (e) => {
        handleSystemPromptChange(e.target.value);
    });

    ui.elements.resetPromptBtn.addEventListener('click', resetSystemPrompt);
    ui.elements.clearCacheBtn.addEventListener('click', clearModelCache);
    ui.elements.clearAllBtn.addEventListener('click', clearAllData);

    // Export modal
    ui.elements.closeExportBtn.addEventListener('click', ui.closeExportModal);
    ui.elements.exportModal.addEventListener('click', (e) => {
        if (e.target === ui.elements.exportModal) {
            ui.closeExportModal();
        }
    });

    ui.elements.exportJsonBtn.addEventListener('click', () => handleExport('json'));
    ui.elements.exportMdBtn.addEventListener('click', () => handleExport('md'));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            if (ui.elements.settingsModal.open) {
                ui.closeSettings();
            } else if (ui.elements.exportModal.open) {
                ui.closeExportModal();
            }
        }

        // Ctrl/Cmd + N for new chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewConversation();
        }
    });

    // System theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.settings.theme === 'system') {
            ui.setTheme('system');
        }
    });

    // Online/offline status
    window.addEventListener('online', () => {
        ui.showToast('Back online', 'success');
    });

    window.addEventListener('offline', () => {
        ui.showToast('You are offline. The app will still work!', 'warning');
    });
}

// ============================================
// Start Application
// ============================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
