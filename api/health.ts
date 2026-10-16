import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aiEnabled, configured, maxBytes, maxPixels, prepare, fail } from '../server/core.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        prepare(req, res, 'GET');
        const hasKeys = configured();
        res.json({
            ai: true,
            configured: hasKeys,
            authenticated: true,
            hasKeys,
            maxBytes: maxBytes(),
            maxPixels: maxPixels()
        });
    }
    catch (e) {
        fail(res, e);
    }
}
