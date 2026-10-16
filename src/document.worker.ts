import { renderDirect, type RenderRequest } from './studio/render';
self.onmessage = async (e: MessageEvent<RenderRequest>) => {
    try { self.postMessage({ result: await renderDirect(e.data) }); }
    catch (e) { self.postMessage({ error: e instanceof Error ? e.message : 'PROCESS_FAILED' }); }
};
