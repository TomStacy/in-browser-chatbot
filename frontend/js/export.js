/**
 * Export functions for conversations
 */

import { getMessages, getConversation } from './chat-store.js';
import { sanitizeFilename, downloadFile, getModelDisplayName } from './utils.js';

/**
 * Export a conversation as JSON
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export async function exportToJSON(conversationId) {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
        throw new Error('Conversation not found');
    }
    
    const messages = await getMessages(conversationId);
    
    const data = {
        title: conversation.title,
        model: conversation.model,
        systemPrompt: conversation.systemPrompt,
        exportedAt: new Date().toISOString(),
        createdAt: new Date(conversation.createdAt).toISOString(),
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            model: m.model,
            timestamp: new Date(m.createdAt).toISOString()
        }))
    };
    
    const filename = `${sanitizeFilename(conversation.title)}.json`;
    downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

/**
 * Export a conversation as Markdown
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export async function exportToMarkdown(conversationId) {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
        throw new Error('Conversation not found');
    }
    
    const messages = await getMessages(conversationId);
    
    let md = `# ${conversation.title}\n\n`;
    md += `**Exported:** ${new Date().toLocaleString()}\n`;
    md += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    
    if (conversation.model) {
        md += `**Model:** ${getModelDisplayName(conversation.model)}\n`;
    }
    
    md += `\n---\n\n`;
    
    for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
        const modelLabel = msg.model ? ` (${getModelDisplayName(msg.model)})` : '';
        const time = new Date(msg.createdAt).toLocaleTimeString();
        
        md += `### ${roleLabel}${modelLabel}\n`;
        md += `*${time}*\n\n`;
        md += `${msg.content}\n\n`;
        md += `---\n\n`;
    }
    
    const filename = `${sanitizeFilename(conversation.title)}.md`;
    downloadFile(md, filename, 'text/markdown');
}

/**
 * Export all conversations as a single JSON file
 * @param {Array} conversations - Array of conversation objects
 * @returns {Promise<void>}
 */
export async function exportAllConversations(conversations) {
    const exportData = {
        exportedAt: new Date().toISOString(),
        conversationCount: conversations.length,
        conversations: []
    };
    
    for (const conv of conversations) {
        const messages = await getMessages(conv.id);
        exportData.conversations.push({
            id: conv.id,
            title: conv.title,
            model: conv.model,
            systemPrompt: conv.systemPrompt,
            createdAt: new Date(conv.createdAt).toISOString(),
            updatedAt: new Date(conv.updatedAt).toISOString(),
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                model: m.model,
                timestamp: new Date(m.createdAt).toISOString()
            }))
        });
    }
    
    const filename = `local-ai-chat-export-${Date.now()}.json`;
    downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
}
