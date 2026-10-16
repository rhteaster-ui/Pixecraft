import type { VercelRequest, VercelResponse } from '@vercel/node';
import { access, fail, prepare } from '../server/core.js';
import { processImage } from '../server/images.js';
export default async function handler(req: VercelRequest, res: VercelResponse) { try {
    prepare(req, res);
    await access(req);
    const { output, type } = await processImage(req.body);
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', output.length);
    res.send(output);
}
catch (e) {
    fail(res, e);
} }
