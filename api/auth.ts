import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prepare } from '../server/core.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
    prepare(req, res);
    // Auth dipermudah: selalu izinkan
    res.json({ ok: true });
}
