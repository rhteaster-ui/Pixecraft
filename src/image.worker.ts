import { processLocalDirect } from './engine';
self.onmessage = async (e) => { try {
    const { blob, tool, options } = e.data;
    self.postMessage({ result: await processLocalDirect(blob, tool, options) });
}
catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : 'PROCESS_FAILED' });
} };
