import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Check if tsx loader is active
const isTsx = process.execArgv.some(a => a.includes('tsx')) || process.env.__PIXCRAFT_TSX__ === '1';

if (!isTsx) {
    const filePath = fileURLToPath(import.meta.url);
    const child = spawn(process.execPath, ['--import', 'tsx', filePath, ...process.argv.slice(2)], {
        stdio: 'inherit',
        env: { ...process.env, __PIXCRAFT_TSX__: '1' }
    });
    child.on('exit', (code, signal) => {
        if (signal) process.kill(process.pid, signal);
        else process.exit(code ?? 0);
    });
} else {
    const { createServer } = await import('node:http');
    const { readFile, stat } = await import('node:fs/promises');
    const { resolve, extname } = await import('node:path');
    const { createServer: createViteServer } = await import('vite');
    const { existsSync } = await import('node:fs');
    const { loadEnvFile } = await import('node:process');

    const health = (await import('./api/health.js')).default;
    const ai = (await import('./api/ai.js')).default;
    const images = (await import('./api/images.js')).default;
    const auth = (await import('./api/auth.js')).default;

    for (const f of ['.env', '.env.local']) if (existsSync(f)) loadEnvFile(f);
    const handlers: Record<string, (req: Parameters<typeof ai>[0], res: Parameters<typeof ai>[1]) => Promise<unknown>> = {
        '/api/ai': ai,
        '/api/health': health,
        '/api/images': images,
        '/api/auth': auth
    };
    const production = process.env.NODE_ENV === 'production';
    const vite = production ? null : await createViteServer({ server: { middlewareMode: true } });
    const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.json': 'application/json',
        '.woff2': 'font/woff2',
        '.webmanifest': 'application/manifest+json'
    };
    createServer(async (req, res) => {
        try {
            const pathname = new URL(req.url || '/', 'http://localhost').pathname;
            if (pathname.startsWith('/api/')) {
                const handler = handlers[pathname];
                if (!handler) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                let body = '';
                for await (const chunk of req) {
                    body += chunk;
                    if (Buffer.byteLength(body) > 35_000_000) {
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'FILE_LIMIT' }));
                        return;
                    }
                }
                const request = Object.assign(req, { body: body ? JSON.parse(body) : undefined });
                const response = Object.assign(res, {
                    status(n: number) {
                        res.statusCode = n;
                        return response;
                    },
                    json(data: unknown) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                        return response;
                    },
                    send(data: unknown) {
                        res.end(data as string);
                        return response;
                    }
                });
                await handler(request as never, response as never);
                return;
            }
            if (vite) {
                vite.middlewares(req, res);
                return;
            }
            const base = resolve('dist'), requested = resolve(base, '.' + decodeURIComponent(pathname));
            if (!requested.startsWith(base + '/') && requested !== base) {
                res.writeHead(403);
                res.end();
                return;
            }
            const file = await stat(requested).then(s => s.isFile() ? requested : resolve(base, 'index.html')).catch(() => resolve(base, 'index.html'));
            res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
            res.end(await readFile(file));
        } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'INVALID_OPTIONS' }));
        }
    }).listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Pixcraft ready on port ' + (process.env.PORT || 3000)));
}
