import path from 'node:path';

const BASE = 'https://api-v2.imgupscaler.ai';
const ORIGIN = 'https://magiceraser.org';
const REFERER = 'https://magiceraser.org/';

const PRODUCT_SERIAL = '2c30ffa5-f468-42e4-9ed4-2c58edaea7c6';
const PRODUCT_CODE = 'magiceraser';
const ROUTER_KEY = 'me_remove_watermark_v1_free';

const PROMPT = '移除所有水印和移除右下角四角星水印';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mimeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return (
        {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp'
        }[ext] || 'application/octet-stream'
    );
}

async function parseJSON(res: Response, name: string): Promise<any> {
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${name} HTTP ${res.status}: ${text}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${name}: invalid JSON`);
    }
}

async function prepareUpload(filename: string, signal?: AbortSignal) {
    const form = new FormData();
    form.append('file_name', filename);

    const res = await fetch(`${BASE}/api/common/upload/upload-image`, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            Origin: ORIGIN,
            Referer: REFERER
        },
        body: form,
        signal: signal || AbortSignal.timeout(30000)
    });

    const json = await parseJSON(res, 'upload-image');

    if (json.code !== 100000 || !json.result?.url || !json.result?.object_name) {
        throw new Error(json.message?.en || 'Failed to prepare image upload');
    }

    return {
        uploadUrl: json.result.url as string,
        objectName: json.result.object_name as string
    };
}

async function uploadImage(buffer: Buffer, filename: string, uploadUrl: string, signal?: AbortSignal) {
    const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': mimeFromFilename(filename),
            Accept: '*/*',
            Origin: ORIGIN,
            Referer: REFERER
        },
        body: new Blob([new Uint8Array(buffer)]),
        signal: signal || AbortSignal.timeout(45000)
    });

    if (!res.ok) {
        throw new Error(`OSS upload failed: HTTP ${res.status}`);
    }
}

async function signObject(objectName: string, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append('object_name', objectName);

    const res = await fetch(`${BASE}/api/common/upload/sign-object`, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            Origin: ORIGIN,
            Referer: REFERER
        },
        body: form,
        signal: signal || AbortSignal.timeout(30000)
    });

    const json = await parseJSON(res, 'sign-object');

    if (json.code !== 100000 || !json.result?.url) {
        throw new Error(json.message?.en || 'Failed to sign uploaded image');
    }

    return json.result.url as string;
}

async function createJob(originalImageUrl: string, signal?: AbortSignal) {
    const form = new FormData();

    form.append('prompt', PROMPT);
    form.append('original_image_url', originalImageUrl);
    form.append('resolution', '0.8');
    form.append('output_format', 'jpg');

    const res = await fetch(`${BASE}/api/runtime/jobs/create-job`, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            Origin: ORIGIN,
            Referer: REFERER,
            authorization: '',
            timezone: 'Asia/Jakarta',
            'router-key': ROUTER_KEY,
            'product-serial': PRODUCT_SERIAL,
            'product-code': PRODUCT_CODE
        },
        body: form,
        signal: signal || AbortSignal.timeout(30000)
    });

    const json = await parseJSON(res, 'create-job');

    if (json.code !== 100000 || !json.result?.job_id) {
        throw new Error(json.message?.en || 'Failed to create watermark removal job');
    }

    return {
        jobId: json.result.job_id as string,
        credits: (json.result.free_credits_info?.day_free_credits ?? null) as number | null
    };
}

async function waitForJob(jobId: string, options: { pollInterval?: number; maxAttempts?: number } = {}, signal?: AbortSignal) {
    const interval = options.pollInterval ?? 2500;
    const maxAttempts = options.maxAttempts ?? 80;

    const url = `${BASE}/api/runtime/jobs/get-job/${encodeURIComponent(jobId)}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (signal?.aborted) {
            throw new Error('Operation aborted');
        }

        const res = await fetch(url, {
            headers: {
                Accept: '*/*',
                Origin: ORIGIN,
                Referer: REFERER,
                authorization: '',
                'product-serial': PRODUCT_SERIAL
            },
            signal: signal || AbortSignal.timeout(20000)
        });

        const json = await parseJSON(res, 'get-job');
        const result = json.result || {};

        if (json.code === 100000 && result.status === 1 && result.output_url) {
            return {
                outputUrl: result.output_url as string,
                credits: (result.free_credits_info?.day_free_credits ?? null) as number | null
            };
        }

        if (json.code === 300006 || result.status === 0) {
            await sleep(interval);
            continue;
        }

        throw new Error(json.message?.en || `MagicEraser job failed (${json.code})`);
    }

    throw new Error('MagicEraser processing timeout');
}

async function downloadResult(url: string, signal?: AbortSignal): Promise<Buffer> {
    const res = await fetch(url, {
        signal: signal || AbortSignal.timeout(45000)
    });

    if (!res.ok) {
        throw new Error(`Result download failed: HTTP ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
}

/**
 * Remove watermark using MagicEraser provider.
 */
export async function removeWatermark(
    input: Buffer | Uint8Array | ArrayBuffer,
    filename = 'image.png',
    options: { pollInterval?: number; maxAttempts?: number; signal?: AbortSignal } = {}
): Promise<{
    buffer: Buffer;
    mimeType: string;
    extension: string;
    jobId: string;
    credits: number | null;
}> {
    if (!input) {
        throw new Error('Image buffer is required');
    }

    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input as any);

    if (!buffer.length) {
        throw new Error('Image buffer is empty');
    }

    const ext = path.extname(filename).toLowerCase();

    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        throw new Error('Supported formats: PNG, JPG, JPEG, WEBP');
    }

    const signal = options.signal;

    // 1. Get presigned PUT URL
    const { uploadUrl, objectName } = await prepareUpload(filename, signal);

    // 2. Upload image
    await uploadImage(buffer, filename, uploadUrl, signal);

    // 3. Generate signed readable URL
    const originalImageUrl = await signObject(objectName, signal);

    // 4. Create processing job
    const job = await createJob(originalImageUrl, signal);

    // 5. Poll until finished
    const result = await waitForJob(job.jobId, options, signal);

    // 6. Download result
    const output = await downloadResult(result.outputUrl, signal);

    return {
        buffer: output,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        jobId: job.jobId,
        credits: result.credits ?? job.credits
    };
}
