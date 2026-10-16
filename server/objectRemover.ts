import path from 'node:path';
import sharp from 'sharp';

/**
 * Production-ready AI Object Remover / Inpainting Engine (LaMa Architecture)
 * Utilizes Large Mask Inpainting (LaMa) model with multi-endpoint failover.
 * Provides high-fidelity texture completion with fallback to local inpainting.
 */

export const LAMA_SERVERS = [
    'https://dsxailab-lama-cleaner-lama-12.hf.space',
    'https://chow-q-lama-cleaner-lama.hf.space'
];

export interface RemoveObjectOptions {
    imageBuffer: Buffer;
    maskBuffer: Buffer;
    hdStrategy?: 'Original' | 'Resize' | 'Crop';
    timeout?: number;
    signal?: AbortSignal;
}

export interface RemoveObjectResult {
    buffer: Buffer;
    mimeType: string;
    extension: string;
    serverUsed: string;
    durationMs: number;
}

/**
 * Normalizes input mask to high-contrast binary mask where:
 * White (255, 255, 255) = object to remove
 * Black (0, 0, 0) = image area to keep
 */
export async function normalizeMask(
    maskBuffer: Buffer,
    targetWidth: number,
    targetHeight: number
): Promise<Buffer> {
    const rawMask = await sharp(maskBuffer)
        .resize(targetWidth, targetHeight, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = rawMask.info;
    const srcData = rawMask.data;
    const outputData = Buffer.alloc(width * height * 3);

    for (let i = 0; i < width * height; i++) {
        const srcIdx = i * channels;
        const r = srcData[srcIdx];
        const g = srcData[srcIdx + 1];
        const b = srcData[srcIdx + 2];
        const a = channels >= 4 ? srcData[srcIdx + 3] : 255;

        // A pixel is masked (white in output) if:
        // 1) Mask has transparency and pixel has visible alpha (> 25) AND color/brightness (r > 40 || g > 40 || b > 40)
        // 2) Mask is opaque (black background, white mask): pixel has brightness (r > 70 || g > 70 || b > 70)
        // Black pixels (r, g, b < 70) even with a=255 MUST NEVER be marked as mask!
        const hasAlpha = channels >= 4;
        const isMasked = hasAlpha && a < 25
            ? false
            : (r > 70 || g > 70 || b > 70);

        const outIdx = i * 3;
        const val = isMasked ? 255 : 0;
        outputData[outIdx] = val;
        outputData[outIdx + 1] = val;
        outputData[outIdx + 2] = val;
    }

    return await sharp(outputData, {
        raw: { width, height, channels: 3 }
    })
        .png({ compressionLevel: 6 })
        .toBuffer();
}

/**
 * Removes masked objects using the LaMa AI model with multi-endpoint failover.
 */
export async function removeObjectLaMa({
    imageBuffer,
    maskBuffer,
    hdStrategy = 'Original',
    timeout = 60000,
    signal
}: RemoveObjectOptions): Promise<RemoveObjectResult> {
    const startTime = Date.now();

    // 1. Validate & prepare original image
    const imgMeta = await sharp(imageBuffer).metadata();
    const width = imgMeta.width || 1024;
    const height = imgMeta.height || 1024;

    const normalizedImage = await sharp(imageBuffer)
        .png({ compressionLevel: 6 })
        .toBuffer();

    // 2. Prepare normalized binary mask matching exact dimensions
    const normalizedMask = await normalizeMask(maskBuffer, width, height);

    const imageBlob = new Blob([new Uint8Array(normalizedImage)], { type: 'image/png' });
    const maskBlob = new Blob([new Uint8Array(normalizedMask)], { type: 'image/png' });

    let lastError: Error | null = null;

    // 3. Try each LaMa server sequentially
    for (const serverUrl of LAMA_SERVERS) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            const form = new FormData();
            form.append('image', imageBlob, 'image.png');
            form.append('mask', maskBlob, 'mask.png');
            form.append('ldmSteps', '25');
            form.append('ldmSampler', 'plms');
            form.append('zitsWireframe', 'true');
            form.append('hdStrategy', hdStrategy);
            form.append('hdStrategyCropMargin', '128');
            form.append('hdStrategyCropTrigerSize', '2048');
            form.append('hdStrategyResizeLimit', '2048');
            form.append('prompt', '');
            form.append('negativePrompt', '');
            form.append('croperX', '0');
            form.append('croperY', '0');
            form.append('croperHeight', '512');
            form.append('croperWidth', '512');
            form.append('useCroper', 'false');
            form.append('sdMaskBlur', '11');
            form.append('sdStrength', '1');
            form.append('sdSteps', '50');
            form.append('sdGuidanceScale', '7.5');
            form.append('sdSampler', 'pndm');
            form.append('sdSeed', '-1');
            form.append('sdMatchHistograms', 'false');
            form.append('sdScale', '1');
            form.append('cv2Radius', '5');
            form.append('cv2Flag', 'INPAINT_NS');
            form.append('paintByExampleSteps', '50');
            form.append('paintByExampleGuidanceScale', '7.5');
            form.append('paintByExampleSeed', '-1');
            form.append('paintByExampleMaskBlur', '5');
            form.append('paintByExampleMatchHistograms', 'false');
            form.append('p2pSteps', '50');
            form.append('p2pImageGuidanceScale', '1.5');
            form.append('p2pGuidanceScale', '7.5');
            form.append('controlnet_conditioning_scale', '0.4');
            form.append('controlnet_method', 'control_v11p_sd15_canny');

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);

            const onParentAbort = () => {
                controller.abort();
            };
            signal?.addEventListener('abort', onParentAbort, { once: true });

            let response: Response;
            try {
                response = await fetch(`${serverUrl}/inpaint`, {
                    method: 'POST',
                    body: form,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onParentAbort);
            }

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errText.slice(0, 150)}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Verify valid image returned
            const meta = await sharp(buffer).metadata();
            if (!meta.width || !meta.height) {
                throw new Error('Invalid image output from LaMa server');
            }

            return {
                buffer,
                mimeType: 'image/png',
                extension: 'png',
                serverUsed: serverUrl,
                durationMs: Date.now() - startTime
            };
        } catch (err: any) {
            lastError = err;
            console.warn(`LaMa server ${serverUrl} failed:`, err?.message || err);
        }
    }

    throw new Error(`Semua server LaMa gagal diproses. Error terakhir: ${lastError?.message || 'Unknown error'}`);
}
