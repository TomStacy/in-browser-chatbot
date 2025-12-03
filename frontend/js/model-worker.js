/**
 * Web Worker for ML model inference using transformers.js
 * 
 * Note: This worker uses dynamic import() which requires the worker
 * to be created with { type: 'module' } option.
 */

console.log('[ModelWorker] Script loading...');

// State variables
var pipeline = null;
var TextStreamer = null;
var env = null;
var generator = null;
var currentModel = null;
var isGenerating = false;
var shouldAbort = false;
var transformersLoaded = false;
var transformersLoading = false;
var loadPromise = null;

// Helper to send messages
function send(type, data) {
    self.postMessage(Object.assign({ type: type }, data || {}));
}

// Load transformers.js dynamically
function loadTransformers() {
    if (transformersLoaded) {
        return Promise.resolve();
    }

    if (transformersLoading) {
        return loadPromise;
    }

    transformersLoading = true;
    console.log('[ModelWorker] Starting to load transformers.js...');
    send('status', { status: 'loading', message: 'Loading AI library...' });

    loadPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0/dist/transformers.min.js')
        .then(function (module) {
            console.log('[ModelWorker] Transformers module loaded');
            pipeline = module.pipeline;
            TextStreamer = module.TextStreamer;
            env = module.env;

            env.allowRemoteModels = true;
            env.useBrowserCache = true;

            transformersLoaded = true;
            transformersLoading = false;
            console.log('[ModelWorker] Transformers.js ready');
            send('status', { status: 'loading', message: 'AI library ready' });
        })
        .catch(function (error) {
            transformersLoading = false;
            console.error('[ModelWorker] Failed to load transformers:', error);
            send('error', {
                message: 'Failed to load AI library: ' + (error.message || String(error))
            });
            throw error;
        });

    return loadPromise;
}

// Initialize model
function initModel(modelId) {
    console.log('[ModelWorker] initModel:', modelId);

    loadTransformers()
        .then(function () {
            if (currentModel === modelId && generator) {
                send('ready', { model: modelId });
                return;
            }

            send('status', { status: 'loading', message: 'Checking GPU...' });

            // Check WebGPU
            var device = 'wasm';
            var gpuPromise = Promise.resolve();

            if (navigator.gpu) {
                gpuPromise = navigator.gpu.requestAdapter()
                    .then(function (adapter) {
                        if (adapter) {
                            device = 'webgpu';
                            console.log('[ModelWorker] Using WebGPU');
                        }
                    })
                    .catch(function () {
                        console.log('[ModelWorker] WebGPU not available');
                    });
            }

            return gpuPromise.then(function () {
                send('status', { status: 'loading', message: 'Downloading model (' + device + ')...' });

                return pipeline('text-generation', modelId, {
                    device: device,
                    dtype: 'q4f16',
                    progress_callback: function (progress) {
                        if (progress.status === 'progress' || progress.status === 'downloading') {
                            var pct = progress.progress ? Math.round(progress.progress) : 0;
                            send('progress', {
                                file: progress.file || progress.name || 'model',
                                progress: pct
                            });
                        } else if (progress.status === 'initiate') {
                            send('status', {
                                status: 'loading',
                                message: 'Loading ' + (progress.file || 'files') + '...'
                            });
                        }
                    }
                });
            })
                .then(function (gen) {
                    generator = gen;
                    currentModel = modelId;
                    console.log('[ModelWorker] Model ready');
                    send('ready', { model: modelId, device: device });
                });
        })
        .catch(function (error) {
            console.error('[ModelWorker] Init error:', error);
            send('error', { message: error.message || 'Failed to load model' });
        });
}

// Generate response
function generate(data) {
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

    var chatMessages = [];
    if (data.systemPrompt) {
        chatMessages.push({ role: 'system', content: data.systemPrompt });
    }
    chatMessages = chatMessages.concat(data.messages || []);

    var fullResponse = '';

    var streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: function (token) {
            if (shouldAbort) throw new Error('Aborted');
            fullResponse += token;
            send('token', { token: token, fullResponse: fullResponse });
        }
    });

    generator(chatMessages, {
        max_new_tokens: data.maxTokens || 512,
        temperature: data.temperature || 0.7,
        do_sample: (data.temperature || 0.7) > 0,
        streamer: streamer
    })
        .then(function (result) {
            var content = fullResponse;
            var msgs = result[0] && result[0].generated_text;
            if (Array.isArray(msgs)) {
                for (var i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].role === 'assistant') {
                        content = msgs[i].content;
                        break;
                    }
                }
            }
            send('complete', { content: content, model: currentModel });
        })
        .catch(function (error) {
            if (error.message === 'Aborted') {
                send('aborted', {});
            } else {
                send('error', { message: error.message });
            }
        })
        .finally(function () {
            isGenerating = false;
            shouldAbort = false;
        });
}

// Message handler
self.onmessage = function (e) {
    var type = e.data.type;
    console.log('[ModelWorker] Message:', type);

    switch (type) {
        case 'init':
            initModel(e.data.model);
            break;
        case 'generate':
            generate(e.data);
            break;
        case 'abort':
            shouldAbort = true;
            break;
        case 'unload':
            generator = null;
            currentModel = null;
            send('unloaded', {});
            break;
        case 'ping':
            send('pong', { ready: !!generator, model: currentModel });
            break;
    }
};

console.log('[ModelWorker] Script loaded, sending ready');
send('worker-ready', {});
