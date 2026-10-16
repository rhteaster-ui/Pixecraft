import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import sharp from 'sharp';
export class AppError extends Error {
    constructor(public code: string, public status = 400) {
        super(code);
    }
}
// Only remote tasks need tickets. Never use a public, hard-coded signing key.
export const secret = () => {
    const s = process.env.ILOVEAPI_SECRET_KEY && process.env.ILOVEAPI_SECRET_KEY.length >= 16
        ? process.env.ILOVEAPI_SECRET_KEY
        : '';
    if (!s) throw new AppError('AI_NOT_CONFIGURED', 503);
    return new TextEncoder().encode(s);
};
export const maxBytes = () => 3000000;
export const maxPixels = () => 64000000;
// Cukup periksa apakah kunci iLoveAPI sudah diatur
export function configured() {
    return !!(process.env.ILOVEAPI_PUBLIC_KEY && process.env.ILOVEAPI_SECRET_KEY);
}
export function aiEnabled() {
    return true;
}
export async function sign(data: Record<string, unknown>, ttl = '30m', aud = 'pixcraft-task') {
    return new SignJWT(data)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('pixcraft')
        .setAudience(aud)
        .setExpirationTime(ttl)
        .sign(secret());
}
export async function verify(token: string, aud = 'pixcraft-task') {
    try {
        return (await jwtVerify(token, secret(), { algorithms: ['HS256'], issuer: 'pixcraft', audience: aud })).payload;
    }
    catch {
        throw new AppError('ACCESS_REQUIRED', 401);
    }
}
// Always accessible for owner deploy
export async function access(_req: VercelRequest) {
    return;
}
export function sameOrigin(req: VercelRequest) {
    const origin = req.headers.origin;
    if (!origin) return;
    try {
        const u = new URL(String(origin));
        const host = req.headers.host || '';
        const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
        const forwardedHosts = forwardedHost.split(',').map(h => h.trim());
        const vercelUrl = process.env.VERCEL_URL || '';
        const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
        // Trust the deployment host, forwarded hosts, or current Vercel deployment URL
        if (
            u.host === host ||
            forwardedHosts.includes(u.host) ||
            (vercelUrl && u.host === vercelUrl) ||
            (vercelProdUrl && u.host === vercelProdUrl)
        ) {
            return;
        }
        throw new Error();
    } catch {
        throw new AppError('ORIGIN_REJECTED', 403);
    }
}
export async function imageBuffer(image: unknown) {
    if (typeof image !== 'string' || image.length > Math.ceil(maxBytes() / 3) * 4 + 4) {
        throw new AppError('FILE_LIMIT', 413);
    }
    const buffer = Buffer.from(image, 'base64');
    if (!buffer.length || buffer.length > maxBytes())
        throw new AppError('FILE_LIMIT', 413);
    const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!png && !jpg && !webp)
        throw new AppError('FILE_TYPE');
    try {
        const meta = await sharp(buffer, { limitInputPixels: maxPixels(), failOn: 'error' }).metadata();
        if (!meta.width || !meta.height || (meta.pages || 1) > 1 || meta.width * meta.height > maxPixels()) {
            throw new AppError('PIXEL_LIMIT');
        }
        return { buffer, meta };
    }
    catch (e) {
        if (e instanceof AppError)
            throw e;
        throw new AppError('DECODE_FAILED');
    }
}
export async function boundedBody(r: Response, limit = 4000000) {
    if (Number(r.headers.get('content-length')) > limit) {
        await r.body?.cancel();
        throw new AppError('OUTPUT_LIMIT', 413);
    }
    const reader = r.body?.getReader();
    if (!reader)
        throw new AppError('PROVIDER_FAILED', 502);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.length;
        if (total > limit) {
            await reader.cancel();
            throw new AppError('OUTPUT_LIMIT', 413);
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}
export function fail(res: VercelResponse, e: unknown) {
    console.error('Pixcraft API:', e instanceof AppError ? e.code : 'PROCESS_FAILED');
    if (e instanceof AppError)
        return res.status(e.status).json({ error: e.code });
    return res.status(500).json({ error: 'PROCESS_FAILED' });
}
export function prepare(req: VercelRequest, res: VercelResponse, method = 'POST') {
    if (req.method !== method)
        throw new AppError('METHOD_NOT_ALLOWED', 405);
    if (method !== 'GET')
        sameOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}
