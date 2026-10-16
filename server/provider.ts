import { SignJWT } from 'jose';
import { AppError, boundedBody } from './core.js';
export async function providerJWT() {
    const pub = process.env.ILOVEAPI_PUBLIC_KEY || '';
    const sec = process.env.ILOVEAPI_SECRET_KEY || '';
    return new SignJWT({ jti: pub })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setNotBefore(Math.floor(Date.now() / 1000) - 10)
        .setExpirationTime('50m')
        .sign(new TextEncoder().encode(sec));
}
export function providerHost(host: unknown) {
    if (typeof host !== 'string') {
        throw new AppError('PROVIDER_HOST', 502);
    }
    const clean = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    if (!/^([a-z0-9_-]+\.)*(iloveimg|ilovepdf)\.com$/i.test(clean)) {
        throw new AppError('PROVIDER_HOST', 502);
    }
    return clean;
}
export async function provider(path: string, init: RequestInit = {}, host = 'api.ilovepdf.com') {
    if (host !== 'api.ilovepdf.com')
        providerHost(host);
    const r = await fetch(`https://${host}/v1/${path}`, {
        ...init,
        headers: {
            ...init.headers,
            Authorization: `Bearer ${await providerJWT()}`
        },
        redirect: 'error',
        signal: AbortSignal.timeout(path.startsWith('download/') ? 60000 : 45000)
    });
    if (!r.ok) {
        let errText = '';
        try { errText = await r.text(); } catch {}
        console.error(`iLoveAPI error [${r.status} ${path}]:`, errText);
        if (r.status === 429)
            throw new AppError('PROVIDER_QUOTA', 429);
        if (r.status === 401 || r.status === 403)
            throw new AppError('PROVIDER_AUTH', 502);
        throw new AppError('PROVIDER_FAILED', 502);
    }
    return r;
}
export async function providerJSON(path: string, body?: unknown, host?: string) {
    const r = await provider(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}, host);
    return JSON.parse((await boundedBody(r, 200000)).toString());
}
