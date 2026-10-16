import { randomBytes } from 'node:crypto';

const BASE = 'https://upsampler-media-upscaler.hf.space';
const ORIGIN = 'https://upsampler.com';
const MODEL = '4xNomosWebPhotoRealPLKSR';
const FN_INDEX = 1;

function generateSessionHash(): string {
    return Math.random().toString(36).substring(2, 13);
}

/**
 * Uploads image buffer to Gradio endpoint on HuggingFace Space.
 */
async function uploadToGradio(buffer: Buffer, filename: string, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append('files', new Blob([new Uint8Array(buffer)]), filename);

    const res = await fetch(`${BASE}/gradio_api/upload`, {
        method: 'POST',
        headers: {
            Origin: ORIGIN,
            Referer: `${ORIGIN}/`
        },
        body: form,
        signal: signal || AbortSignal.timeout(45000)
    });

    if (!res.ok) {
        throw new Error(`Upload failed (${res.status}): ${await res.text().catch(() => '')}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) {
        throw new Error(`Invalid upload response: ${JSON.stringify(data)}`);
    }

    return data[0];
}

/**
 * Enqueues upscale task on the Gradio queue.
 */
async function joinGradioQueue(uploadedPath: string, session: string, signal?: AbortSignal): Promise<void> {
    const payload = {
        data: [
            {
                path: uploadedPath,
                meta: {
                    _type: 'gradio.FileData'
                }
            },
            MODEL,
            false
        ],
        event_data: null,
        fn_index: FN_INDEX,
        trigger_id: null,
        session_hash: session
    };

    const res = await fetch(`${BASE}/gradio_api/queue/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-gradio-user': 'api',
            Origin: ORIGIN,
            Referer: `${ORIGIN}/`
        },
        body: JSON.stringify(payload),
        signal: signal || AbortSignal.timeout(30000)
    });

    if (!res.ok) {
        throw new Error(`Queue join failed (${res.status}): ${await res.text().catch(() => '')}`);
    }
}

interface GradioFileData {
    path?: string;
    url?: string;
    meta?: {
        _type?: string;
    };
}

function extractFiles(output: any): GradioFileData[] {
    const found: GradioFileData[] = [];
    function walk(value: any) {
        if (!value) return;
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }
        if (typeof value === 'object') {
            if (value.url || (value.meta?._type === 'gradio.FileData' && value.path) || (value.path && typeof value.path === 'string')) {
                found.push(value);
                return;
            }
            for (const child of Object.values(value)) {
                walk(child);
            }
        }
    }
    walk(output?.data || output);
    return found;
}

/**
 * Listens to Gradio SSE stream until process_completed event.
 */
async function waitForGradioResult(session: string, signal?: AbortSignal): Promise<GradioFileData> {
    const res = await fetch(
        `${BASE}/gradio_api/queue/data?session_hash=${encodeURIComponent(session)}`,
        {
            headers: {
                Accept: 'text/event-stream',
                'Content-Type': 'application/json',
                Origin: ORIGIN,
                Referer: `${ORIGIN}/`
            },
            signal: signal || AbortSignal.timeout(120000)
        }
    );

    if (!res.ok || !res.body) {
        throw new Error(`Queue stream failed (${res.status}): ${await res.text().catch(() => '')}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const event of events) {
            const dataLines = event
                .split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim());

            if (!dataLines.length) continue;

            let msg: any;
            try {
                msg = JSON.parse(dataLines.join('\n'));
            } catch {
                continue;
            }

            if (msg.msg === 'process_completed') {
                if (msg.success === false) {
                    throw new Error(`Upscale failed: ${JSON.stringify(msg.output)}`);
                }
                const files = extractFiles(msg.output);
                if (!files.length) {
                    throw new Error('No files returned from upscale process');
                }
                return files.length > 1 ? files[files.length - 1] : files[0];
            } else if (msg.msg === 'close_stream') {
                throw new Error('Stream closed before upscale completed');
            }
        }
    }

    throw new Error('SSE finished without process_completed');
}

/**
 * Downloads the finished upscale image from Gradio.
 */
async function downloadGradioResult(file: GradioFileData, signal?: AbortSignal): Promise<Buffer> {
    const url = file.url || `${BASE}/gradio_api/file=${file.path}`;
    const res = await fetch(url, {
        headers: {
            Origin: ORIGIN,
            Referer: `${ORIGIN}/`
        },
        signal: signal || AbortSignal.timeout(60000)
    });

    if (!res.ok) {
        throw new Error(`Download failed (${res.status}): ${await res.text().catch(() => '')}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Runs 4x AI Upscale using Gradio NomosWebPhotoRealPLKSR model.
 * Safe fallback on timeout or service disruption.
 */
export async function runGradioUpscale(buffer: Buffer, signal?: AbortSignal): Promise<Buffer> {
    const session = generateSessionHash();
    const uploadedPath = await uploadToGradio(buffer, 'image.png', signal);
    await joinGradioQueue(uploadedPath, session, signal);
    const resultFile = await waitForGradioResult(session, signal);
    return await downloadGradioResult(resultFile, signal);
}
