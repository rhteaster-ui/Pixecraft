import type { Tool, Options } from './types';
import { inspectHeader } from './header';
export interface Health {
    ai: boolean;
    configured: boolean;
    authenticated: boolean;
    hasKeys?: boolean;
    maxBytes: number;
    maxPixels: number;
}
export async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    const init: RequestInit = {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        signal
    };
    if (body) {
        init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PROCESS_FAILED');
    }
    return res;
}
export async function health(): Promise<Health> {
    try {
        const res = await fetch('/api/health');
        if (!res.ok)
            throw new Error();
        return await res.json();
    }
    catch {
        return {
            ai: false,
            configured: false,
            authenticated: false,
            maxBytes: 25000000,
            maxPixels: 64000000
        };
    }
}
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            const base64 = res.split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
export async function sharpProcess(blob: Blob, tool: Tool, options: Options, signal?: AbortSignal): Promise<Blob> {
    const base64 = await blobToBase64(blob);
    const res = await request('/api/images', {
        tool,
        image: base64,
        options
    }, signal);
    return await res.blob();
}
export async function aiProcess(blob: Blob, tool: Tool, options: Options, setBusy: (s: string) => void, signal?: AbortSignal): Promise<Blob> {
    if (blob.size > 3000000)
        throw new Error('AI_INPUT_LIMIT');
    const header = inspectHeader(new Uint8Array(await blob.arrayBuffer()));
    if (tool === 'upscale' && header.width * header.height * options.multiplier * options.multiplier > 64000000)
        throw new Error('PIXEL_LIMIT');
    
    let maskBase64: string | undefined;
    if (tool === 'removeobj') {
        if (!options.maskBlob) {
            throw new Error('MASK_REQUIRED');
        }
        maskBase64 = await blobToBase64(options.maskBlob);
    }

    setBusy('uploading');
    const base64 = await blobToBase64(blob);
    // 1. Start task
    const startRes = await request('/api/ai', {
        action: 'start',
        image: base64,
        mask: maskBase64,
        tool,
        multiplier: options.multiplier,
        prompt: options.expandPrompt,
        expandWidth: options.expandWidth,
        expandHeight: options.expandHeight,
        expandRatio: options.expandRatio,
        alignment: options.expandAlignment,
        overlap: options.expandOverlap,
        expandScale: options.expandScale,
        expandOffsetX: options.expandOffsetX,
        expandOffsetY: options.expandOffsetY,
        expandLeft: options.expandLeft,
        expandRight: options.expandRight,
        expandTop: options.expandTop,
        expandBottom: options.expandBottom
    }, signal);
    if (startRes.headers.get('content-type')?.startsWith('image/')) return await startRes.blob();
    try {
        const { ticket } = await startRes.json();
        // 2. Poll status
        setBusy('retrieving');
        let attempts = 0;
        while (attempts < 120) {
            if (signal?.aborted)
                throw new DOMException('Aborted', 'AbortError');
            await new Promise(r => setTimeout(r, 1200));
            const statusRes = await request('/api/ai', { action: 'status', ticket }, signal);
            const { status } = await statusRes.json();
            if (status === 'TaskSuccess') {
                break;
            }
            if (status === 'TaskFailed' || status === 'TaskError') {
                throw new Error('PROVIDER_FAILED');
            }
            attempts++;
        }
        if (attempts >= 120)
            throw new Error('PROVIDER_TIMEOUT');
        // 3. Download result
        const dlRes = await request('/api/ai', { action: 'download', ticket }, signal);
        return await dlRes.blob();
    } catch (err) {
        if (signal?.aborted) throw err;
        if (tool === 'removewm') throw err;
        // Fallback to high-resolution local engine if remote processing fails
        const fallbackRes = await request('/api/ai', {
            action: 'start',
            image: base64,
            tool,
            multiplier: options.multiplier,
            fallback: true
        }, signal);
        if (fallbackRes.headers.get('content-type')?.startsWith('image/')) {
            return await fallbackRes.blob();
        }
        throw err;
    }
}
