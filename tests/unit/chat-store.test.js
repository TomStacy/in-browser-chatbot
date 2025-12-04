import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, createConversation, getConversation, addMessage, getMessages, deleteConversation, initializeSettings, getSetting, setSetting } from '../../frontend/js/chat-store.js';

describe('Chat Store', () => {
    beforeEach(async () => {
        await db.open();
    });

    afterEach(async () => {
        await db.delete();
        await db.open();
    });

    describe('Conversations', () => {
        it('should create a conversation', async () => {
            const id = await createConversation('Test Chat', 'model-id');
            expect(id).toBeDefined();
            
            const conv = await getConversation(id);
            expect(conv).toBeDefined();
            expect(conv.title).toBe('Test Chat');
            expect(conv.model).toBe('model-id');
        });

        it('should delete a conversation', async () => {
            const id = await createConversation('To Delete');
            await deleteConversation(id);
            
            const conv = await getConversation(id);
            expect(conv).toBeUndefined();
        });
    });

    describe('Messages', () => {
        it('should add and retrieve messages', async () => {
            const convId = await createConversation('Chat with Messages');
            
            await addMessage(convId, 'user', 'Hello');
            await addMessage(convId, 'assistant', 'Hi there');
            
            const messages = await getMessages(convId);
            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('Hello');
            expect(messages[0].role).toBe('user');
            expect(messages[1].content).toBe('Hi there');
            expect(messages[1].role).toBe('assistant');
        });

        it('should delete messages when conversation is deleted', async () => {
            const convId = await createConversation('Chat to Delete');
            await addMessage(convId, 'user', 'Message 1');
            
            await deleteConversation(convId);
            
            const messages = await getMessages(convId);
            expect(messages).toHaveLength(0);
        });
    });

    describe('Settings', () => {
        it('should initialize default settings', async () => {
            const settings = await initializeSettings();
            expect(settings.theme).toBe('dark');
            expect(settings.temperature).toBe(0.7);
        });

        it('should update settings', async () => {
            await initializeSettings();
            await setSetting('theme', 'light');
            
            const theme = await getSetting('theme');
            expect(theme).toBe('light');
        });
    });
});
