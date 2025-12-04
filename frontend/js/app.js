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
    isWebGPUSupported,
    isRepetitive
} from './utils.js?v=8';

// ============================================
// Application State
// ============================================

const state = {
    currentConversationId: null,
    currentModel: null,
    compareModel: null,
    isGenerating: false,
    settings: null,
    conversations: [],
    deferredPrompt: null
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
    } else if (window.innerWidth <= 768) {
        // Force collapse on mobile init if not already set
        ui.toggleSidebar(true);
    }

    // Apply compare mode state
    if (state.settings.compareMode) {
        ui.toggleCompareMode(true);
    }

    // Load conversations
    await loadConversations();

    // Set up event listeners
    setupEventListeners();
    setupInstallPrompt();
    ui.setupCopyListeners();
    ui.setupEditListeners(handleEditMessage);

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

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('Service Worker update found...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New worker installed and waiting
                        console.log('New Service Worker installed and waiting');
                        showUpdateNotification(registration);
                    }
                });
            });

            // Handle controller change (reload page)
            let refreshing;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                window.location.reload();
                refreshing = true;
            });

            // Check if there's already a waiting worker
            if (registration.waiting) {
                console.log('Service Worker waiting...');
                showUpdateNotification(registration);
            }

        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }
}

function showUpdateNotification(registration) {
    ui.showToast('New version available!', 'info', 0, {
        text: 'Reload',
        callback: () => {
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        }
    });
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
    ui.setRegenerateEnabled(false);

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

    // Show regenerate button if there are messages
    ui.setRegenerateEnabled(messages.length > 0);

    // Restore compare mode
    const compareMode = !!conversation.compareMode;
    if (state.settings.compareMode !== compareMode) {
        await updateSetting('compareMode', compareMode);
        ui.toggleCompareMode(compareMode);
    }

    // Restore compare model
    if (compareMode && conversation.compareModel) {
        ui.elements.modelSelectCompare.value = conversation.compareModel;
        
        if (state.compareModel !== conversation.compareModel) {
            await loadCompareModel();
        } else {
             // Already loaded, just ensure UI state
             ui.elements.loadModelCompareBtn.textContent = 'Loaded';
             ui.elements.loadModelCompareBtn.disabled = true;
             ui.elements.modelSelectCompare.disabled = false;
        }
    }

    // Determine which model to select
    let targetModel = conversation.model;
    
    // Prefer the model from the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.model);
    if (lastAssistantMessage) {
        targetModel = lastAssistantMessage.model;
    }

    // Restore model selection and auto-load
    if (targetModel) {
        ui.setSelectedModel(targetModel);
        
        if (state.currentModel !== targetModel) {
            await loadModel();
        } else {
            // Already loaded, just ensure UI state
            ui.updateModelBadge(targetModel);
            ui.elements.loadModelBtn.textContent = 'Loaded';
            ui.elements.loadModelBtn.disabled = true;
            ui.setInputEnabled(true);
        }
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
        ui.showProgress(false);
        ui.setStatus('ready', `Model ready (${device || 'wasm'})`);
        ui.setInputEnabled(true);
        ui.setModelSelectEnabled(true);
        
        // Update primary load button if this is the selected model
        if (modelId === ui.getSelectedModel()) {
            ui.elements.loadModelBtn.textContent = 'Loaded';
            ui.elements.loadModelBtn.disabled = true;
        }

        // Update compare load button if this is the selected compare model
        if (modelId === ui.elements.modelSelectCompare.value) {
            ui.elements.loadModelCompareBtn.textContent = 'Loaded';
            ui.elements.loadModelCompareBtn.disabled = true;
        }

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
        state.currentModel = modelId;
        ui.updateModelBadge(modelId);
    } catch (error) {
        console.error('Failed to load model:', error);
        // Error handled by callback
    }
}

async function loadCompareModel() {
    const modelId = ui.elements.modelSelectCompare.value;
    if (!modelId) {
        ui.showToast('Please select a comparison model', 'warning');
        return;
    }

    ui.elements.loadModelCompareBtn.disabled = true;
    ui.elements.modelSelectCompare.disabled = true;
    
    ui.showToast('Loading comparison model...', 'info');

    try {
        await modelManager.initModel(modelId);
        state.compareModel = modelId;
        ui.showToast('Comparison model loaded!', 'success');
        ui.elements.loadModelCompareBtn.textContent = 'Loaded';
        ui.elements.modelSelectCompare.disabled = false; // Re-enable selection
    } catch (error) {
        console.error('Failed to load comparison model:', error);
        ui.elements.loadModelCompareBtn.disabled = false;
        ui.elements.modelSelectCompare.disabled = false;
        ui.showToast(`Failed to load comparison model: ${error.message}`, 'error');
    }
}

async function toggleCompareMode() {
    const enabled = !state.settings.compareMode;
    await updateSetting('compareMode', enabled);
    ui.toggleCompareMode(enabled);
    
    // Update current conversation if active
    if (state.currentConversationId) {
        await store.updateConversation(state.currentConversationId, { compareMode: enabled });
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

    // Update conversation model if not set or different
    if (state.currentConversationId) {
        const conversation = await store.getConversation(state.currentConversationId);
        const updates = {};
        
        if (conversation.model !== state.currentModel) {
            updates.model = state.currentModel;
        }
        
        // Save compare state
        if (state.settings.compareMode) {
            if (conversation.compareMode !== true) updates.compareMode = true;
            if (conversation.compareModel !== state.compareModel) updates.compareModel = state.compareModel;
        } else {
            if (conversation.compareMode !== false) updates.compareMode = false;
        }

        if (Object.keys(updates).length > 0) {
            await store.updateConversation(state.currentConversationId, updates);
        }
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

    // Hide regenerate button while generating
    ui.setRegenerateEnabled(false);

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

    try {
        if (state.settings.compareMode && state.compareModel && modelManager.isModelReady(state.compareModel)) {
            // Dual generation
            const { id1, id2 } = ui.createComparisonRow(state.currentModel, state.compareModel);
            
            if (state.currentModel === state.compareModel) {
                // Run sequentially if using the same model to avoid worker conflict
                await generateSingleResponse(state.currentModel, id1, chatHistory);
                await generateSingleResponse(state.compareModel, id2, chatHistory);
            } else {
                // Run in parallel for different models
                const p1 = generateSingleResponse(state.currentModel, id1, chatHistory);
                const p2 = generateSingleResponse(state.compareModel, id2, chatHistory);
                await Promise.all([p1, p2]);
            }
        } else {
            // Single generation
            const streamingId = ui.createStreamingMessage(state.currentModel);
            await generateSingleResponse(state.currentModel, streamingId, chatHistory);
        }
    } catch (error) {
        console.error('Generation error:', error);
        ui.showToast(`Error: ${error.message}`, 'error');
    } finally {
        state.isGenerating = false;
        ui.setGenerating(false);
        ui.focusInput();
        
        // Show regenerate button if we have messages
        const msgs = await store.getMessages(state.currentConversationId);
        if (msgs.length > 0) {
            ui.setRegenerateEnabled(true);
        }
    }
}

async function regenerateResponse() {
    if (state.isGenerating || !state.currentConversationId) return;

    // Get all messages
    const messages = await store.getMessages(state.currentConversationId);
    if (messages.length === 0) return;

    // Find the last user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserIndex = i;
            break;
        }
    }

    if (lastUserIndex === -1) {
        ui.showToast('No user message to regenerate from', 'warning');
        return;
    }

    // Delete all messages after the last user message
    const messagesToDelete = messages.slice(lastUserIndex + 1);
    for (const msg of messagesToDelete) {
        await store.deleteMessage(msg.id);
    }

    // Refresh UI
    const updatedMessages = await store.getMessages(state.currentConversationId);
    ui.renderMessages(updatedMessages);

    // Trigger generation
    await generateResponse();
}

async function handleEditMessage(messageId, newContent) {
    if (state.isGenerating) return;

    // Get all messages
    const messages = await store.getMessages(state.currentConversationId);
    const messageIndex = messages.findIndex(m => m.id === messageId);

    if (messageIndex === -1) {
        ui.showToast('Message not found', 'error');
        return;
    }

    // Update the message content
    await store.updateMessage(messageId, { content: newContent });

    // Delete all subsequent messages
    const messagesToDelete = messages.slice(messageIndex + 1);
    for (const msg of messagesToDelete) {
        await store.deleteMessage(msg.id);
    }

    // Refresh UI
    const updatedMessages = await store.getMessages(state.currentConversationId);
    ui.renderMessages(updatedMessages);

    // Trigger generation
    await generateResponse();
}

async function generateSingleResponse(modelId, streamingId, chatHistory) {
    let timeoutId = null;
    let timedOut = false;
    let repetitionDetected = false;
    const TIMEOUT_MS = 45000; // 45 seconds timeout

    const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            console.warn(`Generation timed out for ${modelId}`);
            timedOut = true;
            modelManager.abort(modelId);
        }, TIMEOUT_MS);
    };
    
    try {
        resetTimeout();

        await modelManager.generate(modelId, chatHistory, {
            temperature: state.settings.temperature,
            maxTokens: state.settings.maxTokens,
            systemPrompt: state.settings.systemPrompt,

            onToken: (token, accumulated) => {
                resetTimeout();
                
                // Check for repetition
                if (isRepetitive(accumulated)) {
                    repetitionDetected = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    modelManager.abort(modelId);
                    return;
                }
                
                ui.updateStreamingMessage(streamingId, accumulated);
            },

            onComplete: async (content, model) => {
                if (timeoutId) clearTimeout(timeoutId);

                // Save assistant message
                const msgId = await store.addMessage(
                    state.currentConversationId,
                    'assistant',
                    content,
                    model
                );

                ui.finalizeStreamingMessage(streamingId, content, msgId);
            }
        });

        if (timedOut) {
            throw new Error('Generation timed out - model stopped responding');
        }

        if (repetitionDetected) {
            throw new Error('Generation stopped due to repetitive output');
        }

    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(`Generation error (${modelId}):`, error);
        
        ui.updateMessageError(streamingId, error.message || 'Generation failed', async () => {
            // Retry logic
            if (state.isGenerating) return;
            
            state.isGenerating = true;
            ui.setGenerating(true);
            
            try {
                await generateSingleResponse(modelId, streamingId, chatHistory);
            } finally {
                state.isGenerating = false;
                ui.setGenerating(false);
                
                // Re-enable regenerate button if needed
                const msgs = await store.getMessages(state.currentConversationId);
                if (msgs.length > 0) {
                    ui.setRegenerateEnabled(true);
                }
            }
        });
    }
}

function stopGeneration() {
    if (state.isGenerating) {
        if (state.currentModel) modelManager.abort(state.currentModel);
        if (state.compareModel) modelManager.abort(state.compareModel);
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
// PWA Installation
// ============================================

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        state.deferredPrompt = e;
        // Update UI to notify the user they can add to home screen
        ui.elements.installBtn.classList.remove('hidden');
    });

    ui.elements.installBtn.addEventListener('click', async () => {
        // Hide the app provided install promotion
        ui.elements.installBtn.classList.add('hidden');
        // Show the install prompt
        if (state.deferredPrompt) {
            state.deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, throw it away
            state.deferredPrompt = null;
        }
    });

    window.addEventListener('appinstalled', () => {
        // Hide the app-provided install promotion
        ui.elements.installBtn.classList.add('hidden');
        // Clear the deferredPrompt so it can be garbage collected
        state.deferredPrompt = null;
        console.log('PWA was installed');
        ui.showToast('App installed successfully!', 'success');
    });
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

    // Close sidebar when clicking backdrop (mobile)
    ui.elements.sidebarBackdrop.addEventListener('click', () => {
        ui.toggleSidebar(true); // Collapse
        updateSetting('sidebarCollapsed', true);
    });

    ui.elements.newChatBtn.addEventListener('click', () => {
        createNewConversation();
        // Close sidebar on mobile after clicking new chat
        if (window.innerWidth <= 768) {
            ui.toggleSidebar(true);
        }
    });

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
        
        // Close sidebar on mobile after selecting conversation
        if (window.innerWidth <= 768) {
            ui.toggleSidebar(true);
        }
    });

    // Model loading
    ui.elements.modelSelect.addEventListener('change', () => {
        const selectedId = ui.elements.modelSelect.value;
        const isCurrent = selectedId === state.currentModel;
        
        if (isCurrent && state.currentModel) {
             ui.elements.loadModelBtn.textContent = 'Loaded';
             ui.elements.loadModelBtn.disabled = true;
        } else {
             ui.elements.loadModelBtn.textContent = 'Load';
             ui.elements.loadModelBtn.disabled = !selectedId;
        }
    });

    ui.elements.loadModelBtn.addEventListener('click', loadModel);

    // Compare mode
    ui.elements.compareToggle.addEventListener('click', toggleCompareMode);
    
    ui.elements.modelSelectCompare.addEventListener('change', () => {
        const selectedId = ui.elements.modelSelectCompare.value;
        const isCurrent = selectedId === state.compareModel;

        if (isCurrent && state.compareModel) {
            ui.elements.loadModelCompareBtn.textContent = 'Loaded';
            ui.elements.loadModelCompareBtn.disabled = true;
        } else {
            ui.elements.loadModelCompareBtn.textContent = 'Load';
            ui.elements.loadModelCompareBtn.disabled = !selectedId;
        }
    });
    
    ui.elements.loadModelCompareBtn.addEventListener('click', loadCompareModel);

    // Chat input
    ui.elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (state.settings.enterToSend) {
                if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            } else {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    sendMessage();
                }
            }
        }
    });

    ui.elements.sendBtn.addEventListener('click', sendMessage);
    ui.elements.stopBtn.addEventListener('click', stopGeneration);
    ui.elements.regenerateBtn.addEventListener('click', regenerateResponse);

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

    ui.elements.enterToSendCheckbox.addEventListener('change', (e) => {
        updateSetting('enterToSend', e.target.checked);
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

    // Shortcuts modal
    ui.elements.closeShortcutsBtn.addEventListener('click', ui.closeShortcutsModal);
    ui.elements.shortcutsModal.addEventListener('click', (e) => {
        if (e.target === ui.elements.shortcutsModal) {
            ui.closeShortcutsModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            if (ui.elements.settingsModal.open) {
                ui.closeSettings();
            } else if (ui.elements.exportModal.open) {
                ui.closeExportModal();
            } else if (ui.elements.shortcutsModal.open) {
                ui.closeShortcutsModal();
            }
        }

        // Alt + N for new chat
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            createNewConversation();
        }

        // ? for shortcuts (Shift + /)
        if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            ui.openShortcutsModal();
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
