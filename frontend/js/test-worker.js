// Simple test worker to verify workers are working
console.log('[TestWorker] Starting...');

self.onmessage = (e) => {
    console.log('[TestWorker] Received:', e.data);
    self.postMessage({ type: 'pong', data: 'Worker is working!' });
};

self.postMessage({ type: 'ready' });
console.log('[TestWorker] Ready message sent');
