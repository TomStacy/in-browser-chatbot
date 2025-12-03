/**
 * Chat storage using IndexedDB via Dexie.js
 */

import Dexie from 'dexie';
import { DEFAULT_SYSTEM_PROMPT } from './utils.js';

// Initialize database
const db = new Dexie('LocalAIChatDB');

db.version(1).stores({
    conversations: '++id, createdAt, updatedAt',
    messages: '++id, conversationId, createdAt',
    settings: 'key'
});

// ============================================
// Conversation Operations
// ============================================

/**
 * Create a new conversation
 * @param {string} title - Conversation title
 * @param {string} model - Model ID used
 * @returns {Promise<number>} - Conversation ID
 */
export async function createConversation(title = 'New Chat', model = null) {
    const now = Date.now();
    const id = await db.conversations.add({
        title,
        model,
        systemPrompt: null,
        compareMode: false,
        createdAt: now,
        updatedAt: now
    });
    return id;
}

/**
 * Get a conversation by ID
 * @param {number} id - Conversation ID
 * @returns {Promise<Object|undefined>}
 */
export async function getConversation(id) {
    return db.conversations.get(id);
}

/**
 * Get all conversations, sorted by most recent
 * @returns {Promise<Array>}
 */
export async function getConversations() {
    return db.conversations.orderBy('updatedAt').reverse().toArray();
}

/**
 * Update a conversation
 * @param {number} id - Conversation ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>}
 */
export async function updateConversation(id, updates) {
    return db.conversations.update(id, {
        ...updates,
        updatedAt: Date.now()
    });
}

/**
 * Delete a conversation and its messages
 * @param {number} id - Conversation ID
 * @returns {Promise<void>}
 */
export async function deleteConversation(id) {
    await db.transaction('rw', db.conversations, db.messages, async () => {
        await db.messages.where('conversationId').equals(id).delete();
        await db.conversations.delete(id);
    });
}

/**
 * Delete all conversations and messages
 * @returns {Promise<void>}
 */
export async function deleteAllConversations() {
    await db.transaction('rw', db.conversations, db.messages, async () => {
        await db.messages.clear();
        await db.conversations.clear();
    });
}

// ============================================
// Message Operations
// ============================================

/**
 * Add a message to a conversation
 * @param {number} conversationId - Conversation ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @param {string} model - Model that generated the message (for assistant)
 * @returns {Promise<number>} - Message ID
 */
export async function addMessage(conversationId, role, content, model = null) {
    const now = Date.now();
    
    const id = await db.messages.add({
        conversationId,
        role,
        content,
        model,
        createdAt: now
    });
    
    // Update conversation's updatedAt
    await db.conversations.update(conversationId, {
        updatedAt: now
    });
    
    return id;
}

/**
 * Get all messages for a conversation
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Array>}
 */
export async function getMessages(conversationId) {
    return db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('createdAt');
}

/**
 * Update a message
 * @param {number} id - Message ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>}
 */
export async function updateMessage(id, updates) {
    return db.messages.update(id, updates);
}

/**
 * Delete a message
 * @param {number} id - Message ID
 * @returns {Promise<void>}
 */
export async function deleteMessage(id) {
    return db.messages.delete(id);
}

// ============================================
// Settings Operations
// ============================================

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>}
 */
export async function getSetting(key, defaultValue = null) {
    const record = await db.settings.get(key);
    return record?.value ?? defaultValue;
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
    await db.settings.put({ key, value });
}

/**
 * Get all settings
 * @returns {Promise<Object>}
 */
export async function getAllSettings() {
    const records = await db.settings.toArray();
    const settings = {};
    for (const record of records) {
        settings[record.key] = record.value;
    }
    return settings;
}

/**
 * Initialize default settings if not present
 * @returns {Promise<Object>}
 */
export async function initializeSettings() {
    const defaults = {
        theme: 'dark',
        temperature: 0.7,
        maxTokens: 512,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        defaultModel: null,
        compareMode: false,
        sidebarCollapsed: false
    };
    
    const existing = await getAllSettings();
    
    for (const [key, value] of Object.entries(defaults)) {
        if (!(key in existing)) {
            await setSetting(key, value);
        }
    }
    
    return { ...defaults, ...existing };
}

// ============================================
// Export for direct access if needed
// ============================================

export { db };
