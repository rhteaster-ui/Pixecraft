import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import ai from '../api/ai';
import health from '../api/health';
import { sameOrigin } from '../server/core';
import { parseRecipe } from '../src/studio/recipeValidation';
function response() {
    const result: { statusCode: number; body: unknown; headers: Record<string, string> } = { statusCode: 200, body: undefined, headers: {} };
    const res = { setHeader(k: string, v: string) { result.headers[k] = v; }, status(code: number) { result.statusCode = code; return res; }, json(body: unknown) { result.body = body; return res; }, send(body: unknown) { result.body = body; return res; } };
    return { result, res: res as never };
}
test('serverless no-key enhancement responds directly without a task registry or hidden resize', async () => {
    const old = { ...process.env }; delete process.env.ILOVEAPI_PUBLIC_KEY; delete process.env.ILOVEAPI_SECRET_KEY;
    try {
        const image = await sharp({ create: { width: 48, height: 32, channels: 4, background: { r: 50, g: 150, b: 80, alpha: .5 } } }).png().toBuffer();
        const { result, res } = response();
        await ai({ method: 'POST', headers: {}, body: { action: 'start', image: image.toString('base64'), tool: 'upscale', multiplier: 2 } } as never, res);
        assert.equal(result.statusCode, 200); assert.ok(Buffer.isBuffer(result.body)); assert.equal(result.headers['Content-Type'], 'image/png');
        const meta = await sharp(result.body as Buffer).metadata(); assert.deepEqual([meta.width, meta.height], [96, 64]); assert.equal(meta.hasAlpha, true);
    } finally { process.env = old; }
});
test('basic isolation remains explicit and returns transparent output', async () => {
    const old = { ...process.env }; delete process.env.ILOVEAPI_PUBLIC_KEY; delete process.env.ILOVEAPI_SECRET_KEY;
    try {
        const image = await sharp({ create: { width: 48, height: 32, channels: 4, background: '#ffffff' } }).png().toBuffer(); const { result, res } = response();
        await ai({ method: 'POST', headers: {}, body: { action: 'start', image: image.toString('base64'), tool: 'removebg', multiplier: 2 } } as never, res);
        assert.equal(result.statusCode, 200); const { data } = await sharp(result.body as Buffer).raw().toBuffer({ resolveWithObject: true }); assert.equal(data[3], 0);
    } finally { process.env = old; }
});
test('API validates methods, body, foreign Vercel tenants and forged tickets', async () => {
    assert.throws(() => sameOrigin({ headers: { host: 'pixcraft.vercel.app', origin: 'https://attacker.vercel.app' } } as never));
    const invalid = response(); await ai({ method: 'POST', headers: {}, body: { action: 'start', image: 'invalid', tool: 'unknown', multiplier: 3 } } as never, invalid.res); assert.equal(invalid.result.statusCode, 400);
    const forged = response(); await ai({ method: 'POST', headers: {}, body: { action: 'download', ticket: 'forged' } } as never, forged.res); assert.equal(forged.result.statusCode, 401);
    const h = response(); await health({ method: 'GET', headers: {} } as never, h.res); assert.equal((h.result.body as { maxBytes: number }).maxBytes, 3_000_000);
});
test('recipe parser rejects unknown tools, malformed CC and arbitrary fields', () => {
    assert.equal(parseRecipe({ name: 'Web', steps: [{ tool: 'compress', options: { format: 'webp', targetKB: 200 } }] }).steps.length, 1);
    for (const options of [{ width: -3 }, { cc: { exposure: 'oops' } }, { jpegBackground: 'bad' }, { logo: {} }, { targetKB: Infinity }]) assert.throws(() => parseRecipe({ name: 'Bad', steps: [{ tool: 'compress', options }] }));
    assert.throws(() => parseRecipe({ name: 'Bad', steps: [{ tool: 'delete', options: {} }] }));
});

test('removeobj validates mask requirement and handles object removal request', async () => {
    const image = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#00ff00' } }).png().toBuffer();
    // Test 1: missing mask rejects with 400
    const noMask = response();
    await ai({ method: 'POST', headers: {}, body: { action: 'start', image: image.toString('base64'), tool: 'removeobj' } } as never, noMask.res);
    assert.equal(noMask.result.statusCode, 400);

    // Test 2: with valid mask
    const mask = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff' } }).png().toBuffer();
    const withMask = response();
    await ai({ method: 'POST', headers: {}, body: { action: 'start', image: image.toString('base64'), mask: mask.toString('base64'), tool: 'removeobj' } } as never, withMask.res);
    // Either 200 (live EzRemove success) or 502/429 (rate limited / provider busy) is returned gracefully without crashing
    assert.ok([200, 429, 502].includes(withMask.result.statusCode));
    if (withMask.result.statusCode === 200) {
        assert.ok(Buffer.isBuffer(withMask.result.body));
        assert.equal(withMask.result.headers['Content-Type'], 'image/png');
    }
});
