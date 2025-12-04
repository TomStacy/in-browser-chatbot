import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modelManager } from '../../frontend/js/model-manager.js';

// Mock Worker
class MockWorker {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
    }

    postMessage(msg) {
        // Simulate worker response based on message type
        if (msg.type === 'init') {
            setTimeout(() => {
                this.onmessage({ data: { type: 'ready', model: msg.model, device: 'wasm' } });
            }, 10);
        } else if (msg.type === 'generate') {
            setTimeout(() => {
                this.onmessage({ data: { type: 'generating' } });
                this.onmessage({ data: { type: 'token', token: 'Hello', fullResponse: 'Hello' } });
                this.onmessage({ data: { type: 'complete', content: 'Hello', model: 'test-model' } });
            }, 10);
        }
    }

    terminate() {}
}

globalThis.Worker = MockWorker;
globalThis.URL.createObjectURL = vi.fn(() => 'blob:url');

describe('Model Manager', () => {
    beforeEach(() => {
        // Reset model manager state
        modelManager.workers.clear();
        modelManager.readyModels.clear();
        modelManager.loadingModels.clear();
        modelManager.callbacks.clear();
    });

    it('should initialize a model', async () => {
        const modelId = 'test-model';
        
        // Mock createWorker to return our MockWorker and trigger the initial 'worker-ready'
        vi.spyOn(modelManager, 'createWorker').mockImplementation(() => {
            const worker = new MockWorker();
            setTimeout(() => {
                worker.onmessage({ data: { type: 'worker-ready' } });
            }, 0);
            return worker;
        });

        await modelManager.initModel(modelId);
        
        expect(modelManager.isModelReady(modelId)).toBe(true);
        expect(modelManager.workers.has(modelId)).toBe(true);
    });

    it('should generate text', async () => {
        const modelId = 'test-model';
        
        // Setup ready model
        const worker = new MockWorker();
        // Manually attach the message handler since we're bypassing initModel
        worker.onmessage = (event) => {
            modelManager.handleWorkerMessage(modelId, event.data, () => {}, () => {});
        };
        
        modelManager.workers.set(modelId, worker);
        modelManager.readyModels.add(modelId);

        const onToken = vi.fn();
        const result = await modelManager.generate(modelId, [], { onToken });
        
        expect(result).toBe('Hello');
        expect(onToken).toHaveBeenCalledWith('Hello', 'Hello');
    });

    it('should handle errors during initialization', async () => {
        const modelId = 'error-model';
        
        vi.spyOn(modelManager, 'createWorker').mockImplementation(() => {
            throw new Error('Worker creation failed');
        });

        await expect(modelManager.initModel(modelId)).rejects.toThrow('Worker creation failed');
        expect(modelManager.isModelLoading(modelId)).toBe(false);
    });
});
