import path from 'node:path';

const BASE = 'https://api.ezremove.ai';
const ORIGIN = 'https://ezremove.ai';
const REFERER = 'https://ezremove.ai/';
const PRODUCT_SERIAL = '4dcbe741d275268664b6e4c3fb6d179c';

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
        throw new Error(`${name}: response bukan JSON`);
    }
}

export async function createMaskJob({
    imageBuffer,
    maskBuffer,
    imageFilename = 'image.png',
    maskFilename = 'mask.png',
    signal
}: {
    imageBuffer: Buffer;
    maskBuffer: Buffer;
    imageFilename?: string;
    maskFilename?: string;
    signal?: AbortSignal;
}) {
    const form = new FormData();
    const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: mimeFromFilename(imageFilename) });
    const maskBlob = new Blob([new Uint8Array(maskBuffer)], { type: mimeFromFilename(maskFilename) });

    form.append('original_image_file', imageBlob, imageFilename);
    form.append('mask_file', maskBlob, maskFilename);

    for (let attempt = 1; attempt <= 3; attempt++) {
        if (signal?.aborted) throw new Error('Operation aborted');
        const res = await fetch(`${BASE}/api/ez-remove/obj-remove/create-mask-job`, {
            method: 'POST',
            headers: {
                Accept: 'application/json, text/plain, */*',
                Origin: ORIGIN,
                Referer: REFERER,
                'product-serial': PRODUCT_SERIAL
            },
            body: form,
            signal: signal || AbortSignal.timeout(45000)
        });

        if (res.status === 429 && attempt < 3) {
            await sleep(2000 * attempt);
            continue;
        }

        const json = await parseJSON(res, 'create-mask-job');

        if (json.code !== 100000 || !json.result?.job_id) {
            throw new Error(json.message?.en || `Create job gagal (${json.code})`);
        }

        return {
            jobId: json.result.job_id as string,
            imageUrl: (json.result.image_url || null) as string | null
        };
    }

    throw new Error('Create job gagal setelah beberapa percobaan (429)');
}

export async function waitForJob(
    jobId: string,
    {
        pollInterval = 2000,
        maxAttempts = 90,
        signal
    }: {
        pollInterval?: number;
        maxAttempts?: number;
        signal?: AbortSignal;
    } = {}
) {
    const url = `${BASE}/api/ez-remove/obj-remove/get-job-v2/` + encodeURIComponent(jobId);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (signal?.aborted) {
            throw new Error('Operation aborted');
        }

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json, text/plain, */*',
                Origin: ORIGIN,
                Referer: REFERER
            },
            signal: signal || AbortSignal.timeout(20000)
        });

        const json = await parseJSON(res, 'get-job-v2');
        const result = json.result || {};

        if (json.code === 100000 && result.status === 2 && Array.isArray(result.output) && result.output.length) {
            return {
                outputUrl: result.output[0] as string,
                output: result.output as string[]
            };
        }

        if (result.error && String(result.error).trim()) {
            throw new Error(`EzRemove job gagal: ${result.error}`);
        }

        await sleep(pollInterval);
    }

    throw new Error('EzRemove processing timeout');
}

export async function downloadResult(url: string, signal?: AbortSignal): Promise<Buffer> {
    const res = await fetch(url, {
        headers: {
            Accept: 'image/*,*/*'
        },
        signal: signal || AbortSignal.timeout(60000)
    });

    if (!res.ok) {
        throw new Error(`Download result HTTP ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
}

export async function removeObject({
    imageBuffer,
    maskBuffer,
    imageFilename = 'image.png',
    maskFilename = 'mask.png',
    pollInterval = 2000,
    maxAttempts = 90,
    signal
}: {
    imageBuffer: Buffer;
    maskBuffer: Buffer;
    imageFilename?: string;
    maskFilename?: string;
    pollInterval?: number;
    maxAttempts?: number;
    signal?: AbortSignal;
}): Promise<{
    buffer: Buffer;
    mimeType: string;
    extension: string;
    jobId: string;
    inputUrl: string | null;
    outputUrl: string;
    outputs: string[];
}> {
    if (!imageBuffer?.length) {
        throw new Error('Original image kosong');
    }
    if (!maskBuffer?.length) {
        throw new Error('Mask kosong');
    }

    const job = await createMaskJob({
        imageBuffer,
        maskBuffer,
        imageFilename,
        maskFilename,
        signal
    });

    const result = await waitForJob(job.jobId, { pollInterval, maxAttempts, signal });
    const outputBuffer = await downloadResult(result.outputUrl, signal);

    return {
        buffer: outputBuffer,
        mimeType: 'image/png',
        extension: 'png',
        jobId: job.jobId,
        inputUrl: job.imageUrl,
        outputUrl: result.outputUrl,
        outputs: result.output
    };
}
