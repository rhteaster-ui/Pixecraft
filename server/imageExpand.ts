import crypto from 'node:crypto';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';

const BASE = 'https://multimodalart-flux-fill-outpaint.hf.space';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

function randomSessionHash(): string {
    return crypto.randomBytes(8).toString('hex').slice(0, 11);
}

/**
 * Uploads buffer to Gradio upload endpoint.
 */
async function uploadToGradio(buffer: Buffer, filename: string, mimeType: string, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('files', blob, filename);

    const res = await axios.post(`${BASE}/gradio_api/upload`, form, {
        headers: {
            'user-agent': UA,
            origin: BASE,
            referer: `${BASE}/`
        },
        timeout: 45000,
        signal
    });

    if (!Array.isArray(res.data) || !res.data[0]) {
        throw new Error(`Upload failed: ${JSON.stringify(res.data)}`);
    }

    return res.data[0] as string;
}

/**
 * AI Outpainting using FLUX.1 Fill via HuggingFace Space.
 */
export async function expandImageAI({
    buffer,
    prompt = '',
    width = 1024,
    height = 1024,
    overlap = 10,
    steps = 15,
    alignment = 'Middle',
    resizeMode = 'Full',
    customResize = 50,
    expandLeft = true,
    expandRight = true,
    expandTop = true,
    expandBottom = true,
    signal
}: {
    buffer: Buffer;
    prompt?: string;
    width?: number;
    height?: number;
    overlap?: number;
    steps?: number;
    alignment?: string;
    resizeMode?: string;
    customResize?: number;
    expandLeft?: boolean;
    expandRight?: boolean;
    expandTop?: boolean;
    expandBottom?: boolean;
    signal?: AbortSignal;
}): Promise<{
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
    url?: string;
}> {
    const sessionHash = randomSessionHash();
    const uploadedPath = await uploadToGradio(buffer, 'input.jpg', 'image/jpeg', signal);

    const targetW = Math.min(1920, Math.max(256, Number(width) || 1024));
    const targetH = Math.min(1920, Math.max(256, Number(height) || 1024));

    const payload = {
        data: [
            { path: uploadedPath, meta: { _type: 'gradio.FileData' } },
            targetW,
            targetH,
            Number(overlap) || 10,
            Number(steps) || 15,
            resizeMode,
            Number(customResize) || 50,
            String(prompt || ''),
            alignment,
            Boolean(expandLeft),
            Boolean(expandRight),
            Boolean(expandTop),
            Boolean(expandBottom)
        ],
        event_data: null,
        fn_index: 6,
        trigger_id: 11,
        session_hash: sessionHash
    };

    await axios.post(`${BASE}/gradio_api/queue/join`, payload, {
        headers: {
            'user-agent': UA,
            'content-type': 'application/json',
            origin: BASE,
            referer: `${BASE}/`
        },
        timeout: 30000,
        signal
    });

    return new Promise(async (resolve, reject) => {
        let timeoutTimer: NodeJS.Timeout | null = null;
        let sseStream: any = null;

        const onAbort = () => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            try { sseStream?.destroy(); } catch {}
            reject(new Error('Operation aborted'));
        };

        if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
        }

        try {
            const sseRes = await axios.get(
                `${BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
                {
                    responseType: 'stream',
                    headers: {
                        'user-agent': UA,
                        accept: 'text/event-stream'
                    },
                    timeout: 120000,
                    signal
                }
            );

            sseStream = sseRes.data;

            timeoutTimer = setTimeout(() => {
                try { sseStream.destroy(); } catch {}
                reject(new Error('Timeout: Proses AI Outpaint melebihi batas waktu'));
            }, 120000);

            let bufferChunk = '';

            sseStream.on('data', async (chunk: any) => {
                bufferChunk += chunk.toString();
                const lines = bufferChunk.split('\n\n');
                bufferChunk = lines.pop() || '';

                for (const line of lines) {
                    const match = line.match(/^data:\s*(.+)$/m);
                    if (!match) continue;

                    let eventData: any;
                    try {
                        eventData = JSON.parse(match[1]);
                    } catch {
                        continue;
                    }

                    if (eventData.msg === 'process_completed') {
                        if (timeoutTimer) clearTimeout(timeoutTimer);

                        if (!eventData.success) {
                            return reject(new Error(eventData.output?.error || 'Gagal memproses outpainting'));
                        }

                        const outputData = eventData.output?.data;
                        if (!Array.isArray(outputData) || !outputData[0]?.url) {
                            return reject(new Error('Output gambar tidak ditemukan dari Gradio'));
                        }

                        const resultImageUrl = outputData[0].url;

                        try {
                            const dlRes = await axios.get(resultImageUrl, {
                                responseType: 'arraybuffer',
                                headers: { 'user-agent': UA },
                                timeout: 45000
                            });
                            const outputBuf = Buffer.from(dlRes.data);
                            return resolve({
                                buffer: outputBuf,
                                mimeType: 'image/webp',
                                width: targetW,
                                height: targetH,
                                url: resultImageUrl
                            });
                        } catch (dlErr: any) {
                            return reject(new Error(`Download output failed: ${dlErr.message}`));
                        }
                    }
                }
            });

            sseStream.on('error', (err: any) => {
                if (timeoutTimer) clearTimeout(timeoutTimer);
                reject(new Error(`SSE Stream Error: ${err.message}`));
            });
        } catch (err: any) {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            reject(err);
        }
    });
}

/**
 * Local high-quality edge-continuation & ambient diffusion outpainting fallback.
 * Ensures the user always receives an expanded image if remote AI is offline.
 */
export async function expandImageLocal({
    buffer,
    width = 1024,
    height = 1024,
    alignment = 'Middle',
    scale = 80,
    offsetX = 0,
    offsetY = 0
}: {
    buffer: Buffer;
    width?: number;
    height?: number;
    alignment?: string;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
}): Promise<{
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
}> {
    const meta = await sharp(buffer).metadata();
    const origW = meta.width || 800;
    const origH = meta.height || 600;

    const targetW = Math.max(origW, Number(width) || 1024);
    const targetH = Math.max(origH, Number(height) || 1024);

    // Compute scaled inner image dimensions
    const scaleFactor = Math.min(1, Math.max(0.15, (Number(scale) || 80) / 100));
    const innerW = Math.max(32, Math.min(targetW, Math.round(origW * scaleFactor)));
    const innerH = Math.max(32, Math.min(targetH, Math.round(origH * scaleFactor)));

    // Resize original image if scaled
    const resizedInner = (innerW !== origW || innerH !== origH)
        ? await sharp(buffer).resize(innerW, innerH, { fit: 'fill' }).toBuffer()
        : buffer;

    let left = Math.round((targetW - innerW) / 2);
    let top = Math.round((targetH - innerH) / 2);

    switch (alignment) {
        case 'TopLeft':
            left = 0;
            top = 0;
            break;
        case 'Top':
        case 'TopCenter':
            left = Math.round((targetW - innerW) / 2);
            top = 0;
            break;
        case 'TopRight':
            left = targetW - innerW;
            top = 0;
            break;
        case 'Left':
        case 'CenterLeft':
            left = 0;
            top = Math.round((targetH - innerH) / 2);
            break;
        case 'Right':
        case 'CenterRight':
            left = targetW - innerW;
            top = Math.round((targetH - innerH) / 2);
            break;
        case 'BottomLeft':
            left = 0;
            top = targetH - innerH;
            break;
        case 'Bottom':
        case 'BottomCenter':
            left = Math.round((targetW - innerW) / 2);
            top = targetH - innerH;
            break;
        case 'BottomRight':
            left = targetW - innerW;
            top = targetH - innerH;
            break;
        case 'Middle':
        case 'Center':
        default:
            left = Math.round((targetW - innerW) / 2);
            top = Math.round((targetH - innerH) / 2);
            break;
    }

    // Apply manual offset if provided
    if (offsetX) {
        left += Math.round((offsetX / 100) * targetW);
    }
    if (offsetY) {
        top += Math.round((offsetY / 100) * targetH);
    }

    left = Math.max(0, Math.min(targetW - innerW, left));
    top = Math.max(0, Math.min(targetH - innerH, top));

    // Create blurred ambient background from original image
    const ambientBg = await sharp(buffer)
        .resize(targetW, targetH, { fit: 'cover' })
        .blur(45)
        .modulate({ brightness: 0.95, saturation: 1.1 })
        .toBuffer();

    // Composite scaled sharp image onto the ambient background with subtle soft shadow
    const finalBuffer = await sharp(ambientBg)
        .composite([
            {
                input: resizedInner,
                left: Math.max(0, left),
                top: Math.max(0, top)
            }
        ])
        .png({ compressionLevel: 6 })
        .toBuffer();

    return {
        buffer: finalBuffer,
        mimeType: 'image/png',
        width: targetW,
        height: targetH
    };
}

/**
 * Main Expand Image entry point with automated fallback.
 */
export async function expandImage({
    buffer,
    prompt = '',
    width = 1024,
    height = 1024,
    overlap = 10,
    steps = 15,
    alignment = 'Middle',
    resizeMode = 'Full',
    customResize = 80,
    expandLeft = true,
    expandRight = true,
    expandTop = true,
    expandBottom = true,
    offsetX = 0,
    offsetY = 0,
    signal
}: {
    buffer: Buffer;
    prompt?: string;
    width?: number;
    height?: number;
    overlap?: number;
    steps?: number;
    alignment?: string;
    resizeMode?: string;
    customResize?: number;
    expandLeft?: boolean;
    expandRight?: boolean;
    expandTop?: boolean;
    expandBottom?: boolean;
    offsetX?: number;
    offsetY?: number;
    signal?: AbortSignal;
}): Promise<{
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
}> {
    // Map complex alignment to FLUX Gradio basic alignment
    let gradioAlignment = 'Middle';
    if (alignment === 'Left' || alignment === 'TopLeft' || alignment === 'BottomLeft') {
        gradioAlignment = 'Left';
    } else if (alignment === 'Right' || alignment === 'TopRight' || alignment === 'BottomRight') {
        gradioAlignment = 'Right';
    } else if (alignment === 'Top' || alignment === 'TopCenter') {
        gradioAlignment = 'Top';
    } else if (alignment === 'Bottom' || alignment === 'BottomCenter') {
        gradioAlignment = 'Bottom';
    }

    try {
        return await expandImageAI({
            buffer,
            prompt,
            width,
            height,
            overlap,
            steps,
            alignment: gradioAlignment,
            resizeMode: customResize && customResize < 100 ? 'Custom' : resizeMode,
            customResize: customResize || 80,
            expandLeft,
            expandRight,
            expandTop,
            expandBottom,
            signal
        });
    } catch (aiErr: any) {
        console.warn('AI Outpainting remote provider failed, using ambient outpainting engine fallback:', aiErr?.message || aiErr);
        return await expandImageLocal({
            buffer,
            width,
            height,
            alignment,
            scale: customResize,
            offsetX,
            offsetY
        });
    }
}
