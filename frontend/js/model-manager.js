/**
 * Model Manager - Coordinates Web Workers for ML inference
 * 
 * Uses a Blob-based worker to handle dynamic imports properly
 */

import { SUPPORTED_MODELS } from './utils.js';

// Worker code as a string - will be converted to Blob URL
const WORKER_CODE = `
// Worker for ML inference
console.log('[ModelWorker] Starting...');

let pipeline = null;
let TextStreamer = null;
let generator = null;
let currentModel = null;
let isGenerating = false;
let shouldAbort = false;

function send(type, data) {
    self.postMessage(Object.assign({ type: type }, data || {}));
}

async function loadTransformers() {
    if (pipeline) return;
    
    console.log('[ModelWorker] Loading transformers.js...');
    send('status', { status: 'loading', message: 'Loading AI library...' });
    
    const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0/dist/transformers.min.js');
    
    pipeline = module.pipeline;
    TextStreamer = module.TextStreamer;
    module.env.allowRemoteModels = true;
    module.env.useBrowserCache = true;
    
    console.log('[ModelWorker] Transformers.js loaded');
}

async function initModel(modelId) {
    console.log('[ModelWorker] initModel:', modelId);
    
    try {
        await loadTransformers();
        
        if (currentModel === modelId && generator) {
            send('ready', { model: modelId });
            return;
        }
        
        let device = 'wasm';
        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) device = 'webgpu';
            } catch (e) {}
        }
        
        send('status', { status: 'loading', message: 'Downloading model (' + device + ')...' });
        
        generator = await pipeline('text-generation', modelId, {
            device: device,
            dtype: 'q4f16',
            progress_callback: (progress) => {
                if (progress.status === 'progress' || progress.status === 'downloading') {
                    send('progress', {
                        file: progress.file || progress.name || 'model',
                        progress: Math.round(progress.progress || 0)
                    });
                } else if (progress.status === 'initiate') {
                    send('status', { status: 'loading', message: 'Loading ' + (progress.file || 'files') + '...' });
                }
            }
        });
        
        currentModel = modelId;
        console.log('[ModelWorker] Model ready');
        send('ready', { model: modelId, device: device });
        
    } catch (error) {
        console.error('[ModelWorker] Error:', error);
        send('error', { message: error.message || 'Failed to load model' });
    }
}

async function generate(data) {
    if (!generator) {
        send('error', { message: 'No model loaded' });
        return;
    }
    if (isGenerating) {
        send('error', { message: 'Already generating' });
        return;
    }
    
    isGenerating = true;
    shouldAbort = false;
    send('generating', { started: true });
    
    try {
        const chatMessages = [];
        if (data.systemPrompt) {
            chatMessages.push({ role: 'system', content: data.systemPrompt });
        }
        chatMessages.push(...(data.messages || []));
        
        let fullResponse = '';
        const streamer = new TextStreamer(generator.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (token) => {
                if (shouldAbort) throw new Error('Aborted');
                fullResponse += token;
                send('token', { token: token, fullResponse: fullResponse });
            }
        });
        
        const result = await generator(chatMessages, {
            max_new_tokens: data.maxTokens || 512,
            temperature: data.temperature || 0.7,
            do_sample: (data.temperature || 0.7) > 0,
            streamer: streamer
        });
        
        let content = fullResponse;
        const msgs = result[0]?.generated_text;
        if (Array.isArray(msgs)) {
            const assistant = msgs.findLast(m => m.role === 'assistant');
            if (assistant) content = assistant.content;
        }
        
        send('complete', { content: content, model: currentModel });
        
    } catch (error) {
        if (error.message === 'Aborted') {
            send('aborted', {});
        } else {
            send('error', { message: error.message });
        }
    } finally {
        isGenerating = false;
        shouldAbort = false;
    }
}

self.onmessage = (e) => {
    const { type, ...data } = e.data;
    console.log('[ModelWorker] Message:', type);
    
    switch (type) {
        case 'init': initModel(data.model); break;
        case 'generate': generate(data); break;
        case 'abort': shouldAbort = true; break;
        case 'unload': generator = null; currentModel = null; send('unloaded', {}); break;
        case 'ping': send('pong', { ready: !!generator, model: currentModel }); break;
    }
};

console.log('[ModelWorker] Ready');
send('worker-ready', {});
`;

class ModelManager {
    constructor() {
        this.workers = new Map(); // modelId -> Worker
        this.readyModels = new Set();
        this.loadingModels = new Set();
        this.callbacks = new Map(); // modelId -> { onToken, onComplete, onError, ... }

        // Global callbacks
        this.onProgress = null;
        this.onStatusChange = null;
        this.onModelReady = null;
        this.onError = null;
    }

    /**
     * Create a worker from blob
     */
    createWorker() {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url, { type: 'module' });
        // Note: We don't revoke the URL immediately as the worker needs it
        return worker;
    }

    /**
     * Initialize a model by creating a worker and loading the model
     * @param {string} modelId - Model identifier
     * @returns {Promise<void>}
     */
    async initModel(modelId) {
        // Already ready
        if (this.readyModels.has(modelId)) {
            this.onModelReady?.(modelId);
            return;
        }

        // Already loading
        if (this.loadingModels.has(modelId)) {
            return new Promise((resolve, reject) => {
                const checkReady = setInterval(() => {
                    if (this.readyModels.has(modelId)) {
                        clearInterval(checkReady);
                        resolve();
                    }
                    if (!this.loadingModels.has(modelId) && !this.readyModels.has(modelId)) {
                        clearInterval(checkReady);
                        reject(new Error('Model loading failed'));
                    }
                }, 100);
            });
        }

        this.loadingModels.add(modelId);

        return new Promise((resolve, reject) => {
            console.log('[ModelManager] Creating worker...');

            let worker;
            try {
                worker = this.createWorker();
                console.log('[ModelManager] Worker created');
            } catch (e) {
                console.error('[ModelManager] Failed to create worker:', e);
                this.loadingModels.delete(modelId);
                reject(e);
                return;
            }

            this.workers.set(modelId, worker);

            // Set up message handler
            worker.onmessage = (event) => {
                this.handleWorkerMessage(modelId, event.data);
            };

            worker.onerror = (error) => {
                console.error('Worker error:', error);
                console.error('Error details:', {
                    message: error.message,
                    filename: error.filename,
                    lineno: error.lineno,
                    colno: error.colno,
                    error: error.error
                });
                this.loadingModels.delete(modelId);
                this.workers.delete(modelId);
                const errorMsg = error.message || 'Worker failed to load - check console for details';
                this.onError?.(modelId, errorMsg);
                reject(new Error(errorMsg));
            };

            // Store callbacks
            this.callbacks.set(modelId, {
                resolve,
                reject
            });

            // Wait for worker-ready, then send init
            // The worker will send 'worker-ready' when it's ready to receive commands
        });
    }

    /**
     * Handle messages from workers
     */
    handleWorkerMessage(modelId, data) {
        const { type, ...payload } = data;
        const callbacks = this.callbacks.get(modelId) || {};

        switch (type) {
            case 'worker-ready': {
                console.log('[ModelManager] Worker ready, sending init for:', modelId);
                const worker = this.workers.get(modelId);
                if (worker) {
                    worker.postMessage({ type: 'init', model: modelId });
                }
                break;
            }

            case 'status':
                this.onStatusChange?.(modelId, payload.status, payload.message);
                break;

            case 'progress':
                this.onProgress?.(modelId, payload);
                break;

            case 'ready':
                this.loadingModels.delete(modelId);
                this.readyModels.add(modelId);
                this.onModelReady?.(modelId, payload.device);
                callbacks.resolve?.();
                break;

            case 'generating':
                callbacks.onGenerating?.();
                break;

            case 'token':
                callbacks.onToken?.(payload.token, payload.fullResponse);
                break;

            case 'complete':
                callbacks.onComplete?.(payload.content, payload.model);
                break;

            case 'aborted':
                callbacks.onAborted?.();
                break;

            case 'error':
                this.loadingModels.delete(modelId);
                this.onError?.(modelId, payload.message);
                callbacks.onError?.(payload.message);
                callbacks.reject?.(new Error(payload.message));
                break;

            case 'unloaded':
                this.readyModels.delete(modelId);
                this.workers.delete(modelId);
                break;
        }
    }

    /**
     * Generate a response from a model
     */
    async generate(modelId, messages, options = {}) {
        const worker = this.workers.get(modelId);

        if (!worker) {
            throw new Error(`Model ${modelId} not initialized`);
        }

        if (!this.readyModels.has(modelId)) {
            throw new Error(`Model ${modelId} not ready`);
        }

        return new Promise((resolve, reject) => {
            this.callbacks.set(modelId, {
                ...this.callbacks.get(modelId),
                onToken: options.onToken,
                onGenerating: options.onGenerating,
                onComplete: (content, model) => {
                    options.onComplete?.(content, model);
                    resolve(content);
                },
                onAborted: () => {
                    options.onAborted?.();
                    resolve(null);
                },
                onError: (message) => {
                    options.onError?.(message);
                    reject(new Error(message));
                }
            });

            worker.postMessage({
                type: 'generate',
                messages,
                temperature: options.temperature ?? 0.7,
                maxTokens: options.maxTokens ?? 512,
                systemPrompt: options.systemPrompt
            });
        });
    }

    /**
     * Abort generation for a model
     */
    abort(modelId) {
        const worker = this.workers.get(modelId);
        if (worker) {
            worker.postMessage({ type: 'abort' });
        }
    }

    /**
     * Abort all generations
     */
    abortAll() {
        for (const [, worker] of this.workers) {
            worker.postMessage({ type: 'abort' });
        }
    }

    /**
     * Unload a model
     */
    unloadModel(modelId) {
        const worker = this.workers.get(modelId);
        if (worker) {
            worker.postMessage({ type: 'unload' });
            worker.terminate();
            this.workers.delete(modelId);
            this.readyModels.delete(modelId);
            this.callbacks.delete(modelId);
        }
    }

    /**
     * Unload all models
     */
    unloadAll() {
        for (const modelId of this.workers.keys()) {
            this.unloadModel(modelId);
        }
    }

    /**
     * Check if a model is ready
     */
    isModelReady(modelId) {
        return this.readyModels.has(modelId);
    }

    /**
     * Check if a model is loading
     */
    isModelLoading(modelId) {
        return this.loadingModels.has(modelId);
    }

    /**
     * Get model info
     */
    getModelInfo(modelId) {
        return SUPPORTED_MODELS.find(m => m.id === modelId);
    }

    /**
     * Get all supported models
     */
    getSupportedModels() {
        return SUPPORTED_MODELS;
    }
}

// Export singleton instance
export const modelManager = new ModelManager();
