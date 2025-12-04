import { describe, it, expect } from 'vitest';
import {
    formatTime,
    formatRelativeTime,
    sanitizeFilename,
    generateTitle,
    formatBytes,
    getModelDisplayName,
    isRepetitive,
    escapeHtml
} from '../../frontend/js/utils.js';

describe('Utility Functions', () => {
    
    describe('formatTime', () => {
        it('should format time for today as HH:MM', () => {
            const now = new Date();
            const timestamp = now.getTime();
            // This test might be flaky if run exactly at midnight, but good enough for now
            const formatted = formatTime(timestamp);
            expect(formatted).toMatch(/\d{2}:\d{2}/);
        });

        it('should format time for past dates as Month Day, HH:MM', () => {
            const pastDate = new Date('2023-01-01T12:00:00');
            const formatted = formatTime(pastDate.getTime());
            // Output depends on locale, but usually contains the month
            expect(formatted).toContain('Jan');
            expect(formatted).toContain('1');
        });
    });

    describe('formatRelativeTime', () => {
        it('should return "just now" for very recent times', () => {
            const now = Date.now();
            expect(formatRelativeTime(now)).toBe('just now');
        });

        it('should return relative time for minutes ago', () => {
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
        });

        it('should return relative time for hours ago', () => {
            const twoHoursAgo = Date.now() - (2 * 3600 * 1000);
            expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
        });
    });

    describe('sanitizeFilename', () => {
        it('should remove special characters', () => {
            expect(sanitizeFilename('hello/world:test?')).toBe('helloworldtest');
        });

        it('should replace spaces with underscores', () => {
            expect(sanitizeFilename('hello world')).toBe('hello_world');
        });

        it('should truncate long filenames', () => {
            const longName = 'a'.repeat(100);
            expect(sanitizeFilename(longName).length).toBe(50);
        });

        it('should provide a default if result is empty', () => {
            expect(sanitizeFilename('   ')).toBe('conversation');
        });
    });

    describe('generateTitle', () => {
        it('should use content if short enough', () => {
            expect(generateTitle('Hello world')).toBe('Hello world');
        });

        it('should truncate long content', () => {
            const longContent = 'This is a very long message that should be truncated because it exceeds the default length limit of the title generation function.';
            const title = generateTitle(longContent, 20);
            expect(title.length).toBeLessThanOrEqual(23); // 20 + '...'
            expect(title).toMatch(/\.\.\.$/);
        });

        it('should clean markdown', () => {
            expect(generateTitle('**Bold** and `code`')).toBe('Bold and code');
        });
    });

    describe('formatBytes', () => {
        it('should format bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 B');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1024 * 1024)).toBe('1 MB');
            expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
            expect(formatBytes(1500)).toBe('1.5 KB');
        });
    });

    describe('getModelDisplayName', () => {
        it('should extract model name from ID', () => {
            expect(getModelDisplayName('org/my-model')).toBe('my-model');
        });

        it('should clean up suffixes', () => {
            expect(getModelDisplayName('org/model-instruct_q4')).toBe('model');
        });
    });

    describe('isRepetitive', () => {
        it('should detect simple repetition', () => {
            const repetitive = 'test '.repeat(50);
            expect(isRepetitive(repetitive)).toBe(true);
        });

        it('should not flag normal text', () => {
            const normal = 'This is a normal sentence that does not repeat itself over and over again in a weird way.';
            expect(isRepetitive(normal)).toBe(false);
        });
    });

    describe('escapeHtml', () => {
        // This requires JSDOM environment
        it('should escape HTML tags', () => {
            // We need to mock document for this to work if not running in browser-like env
            // But since we installed jsdom and will configure vitest to use it, this should work.
            expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        });
    });
});
