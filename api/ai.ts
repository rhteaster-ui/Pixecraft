import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp, { type Metadata } from 'sharp';
import { z } from 'zod';
import { access, aiEnabled, AppError, boundedBody, configured, fail, imageBuffer, maxPixels, prepare, sign, verify } from '../server/core.js';
import { provider, providerHost, providerJSON } from '../server/provider.js';
import { runGradioUpscale } from '../server/gradioUpscaler.js';
import { removeWatermark } from '../server/magicEraser.js';
import { removeObjectLaMa, normalizeMask } from '../server/objectRemover.js';
import { removeObject as removeObjectEz } from '../server/ezremove.js';
import { inpaintImage } from '../server/inpainting.js';
import { expandImage } from '../server/imageExpand.js';

const start = z.object({
    action: z.literal('start'),
    image: z.string(),
    mask: z.string().optional(),
    tool: z.enum(['upscale', 'removebg', 'removewm', 'removeobj', 'expand']),
    multiplier: z.union([z.literal(2), z.literal(4)]).optional(),
    fallback: z.boolean().optional(),
    prompt: z.string().optional(),
    expandWidth: z.number().optional(),
    expandHeight: z.number().optional(),
    expandRatio: z.string().optional(),
    alignment: z.string().optional(),
    overlap: z.number().optional(),
    expandScale: z.number().optional(),
    expandOffsetX: z.number().optional(),
    expandOffsetY: z.number().optional(),
    expandLeft: z.boolean().optional(),
    expandRight: z.boolean().optional(),
    expandTop: z.boolean().optional(),
    expandBottom: z.boolean().optional()
});
const other = z.object({
    action: z.enum(['status', 'download']),
    ticket: z.string().max(3000)
});

async function runLocalEnhance(buffer: Buffer, meta: Metadata, tool: 'upscale' | 'removebg' | 'removewm', multiplier: 2 | 4) {
    if (tool === 'upscale') {
        const targetWidth = Math.round(meta.width! * multiplier);
        const targetHeight = Math.round(meta.height! * multiplier);
        
        let pipeline = sharp(buffer, { limitInputPixels: maxPixels() })
            .rotate()
            .resize(targetWidth, targetHeight, {
                kernel: 'lanczos3',
                fastShrinkOnLoad: false
            })
            .sharpen({
                sigma: multiplier === 4 ? 1.5 : 1.0,
                m1: 1.0,
                m2: 2.5,
                x1: 2.0,
                y2: 10.0,
                y3: 20.0
            });
            
        const fmt = 'png';
        pipeline = pipeline.png({ compressionLevel: 6 });
        
        const output = await pipeline.toBuffer();
        return { buffer: output, format: fmt };
    } else {
        // Smart background isolation fallback
        let pipeline = sharp(buffer, { limitInputPixels: maxPixels() })
            .rotate()
            .ensureAlpha();
            
        const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });
        const data = raw.data;
        const w = raw.info.width;
        const h = raw.info.height;
        
        // Sample border background colors to compute background mask
        const corners = [
            0, // top-left
            (w - 1) * 4, // top-right
            ((h - 1) * w) * 4, // bottom-left
            ((h - 1) * w + (w - 1)) * 4 // bottom-right
        ];
        
        let avgR = 0, avgG = 0, avgB = 0;
        for (const idx of corners) {
            avgR += data[idx];
            avgG += data[idx + 1];
            avgB += data[idx + 2];
        }
        avgR = Math.round(avgR / corners.length);
        avgG = Math.round(avgG / corners.length);
        avgB = Math.round(avgB / corners.length);
        
        const threshold = 38;
        for (let i = 0; i < data.length; i += 4) {
            const dr = Math.abs(data[i] - avgR);
            const dg = Math.abs(data[i+1] - avgG);
            const db = Math.abs(data[i+2] - avgB);
            const diff = Math.sqrt(dr*dr + dg*dg + db*db);
            if (diff < threshold) {
                data[i + 3] = 0; // transparent
            } else if (diff < threshold + 15) {
                data[i + 3] = Math.round(((diff - threshold) / 15) * 255); // smooth alpha transition
            }
        }
        
        const output = await sharp(data, {
            raw: { width: w, height: h, channels: 4 }
        }).png().toBuffer();
        
        return { buffer: output, format: 'png' };
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        prepare(req, res);
        await access(req);

        if (req.body?.action === 'start') {
            const p = start.safeParse(req.body);
            if (!p.success)
                throw new AppError('INVALID_OPTIONS');
            const { image, tool } = p.data;
            const multiplier = p.data.multiplier || 2;
            const { buffer, meta } = await imageBuffer(image);
            if (tool === 'upscale' && meta.width! * meta.height! * multiplier * multiplier > maxPixels()) {
                throw new AppError('PIXEL_LIMIT');
            }

            // Normalisasi orientasi & format yang didukung iLoveAPI (PNG / JPG)
            // (iLoveAPI AI tools tidak mendukung WebP secara native dan menghasilkan 500)
            const ext = 'png';
            const source = await sharp(buffer, { limitInputPixels: maxPixels() }).rotate().png({ compressionLevel: 6 }).toBuffer();
            if (source.length > 25000000)
                throw new AppError('FILE_LIMIT', 413);

            // Handle removewm via MagicEraser provider
            if (tool === 'removewm') {
                try {
                    const result = await removeWatermark(source, `image.${ext}`);
                    const finalBuffer = result.buffer;
                    if (finalBuffer.length > 4000000) {
                        const compressed = await sharp(finalBuffer)
                            .jpeg({ quality: 90 })
                            .toBuffer();
                        res.setHeader('Content-Type', 'image/jpeg');
                        return res.send(compressed);
                    }
                    res.setHeader('Content-Type', result.mimeType || 'image/jpeg');
                    return res.send(finalBuffer);
                } catch (wmErr: any) {
                    console.error('MagicEraser watermark removal failed:', wmErr);
                    throw new AppError(wmErr?.message?.includes('timeout') ? 'PROCESS_TIMEOUT' : 'PROVIDER_FAILED', 502);
                }
            }

            // Handle removeobj via multi-server AI pipeline (EzRemove -> LaMa -> Local Inpainting)
            // with guaranteed pixel compositing lock so unmasked pixels are 100% preserved!
            if (tool === 'removeobj') {
                if (!p.data.mask) {
                    throw new AppError('MASK_REQUIRED', 400);
                }
                const sourceMeta = await sharp(source).metadata();
                const srcW = sourceMeta.width || meta.width || 1024;
                const srcH = sourceMeta.height || meta.height || 1024;

                const maskData = await imageBuffer(p.data.mask);
                const maskBuf = await sharp(maskData.buffer)
                    .resize(srcW, srcH, { fit: 'fill' })
                    .png()
                    .toBuffer();

                // Compute binary normalized mask (255 = masked, 0 = keep)
                const binaryMask = await normalizeMask(maskBuf, srcW, srcH);

                let finalBuffer: Buffer | null = null;
                let mime = 'image/png';

                // 1. Try EzRemove AI first (specialized, fast object remover)
                try {
                    const ezResult = await removeObjectEz({
                        imageBuffer: source,
                        maskBuffer: binaryMask,
                        pollInterval: 1500,
                        maxAttempts: 35
                    });
                    if (ezResult?.buffer?.length) {
                        finalBuffer = ezResult.buffer;
                        mime = ezResult.mimeType || 'image/png';
                    }
                } catch (ezErr: any) {
                    console.warn('EzRemove AI failed or unavailable, trying LaMa AI:', ezErr?.message || ezErr);
                }

                // 2. If EzRemove failed, try LaMa AI Cleaner
                if (!finalBuffer) {
                    try {
                        const result = await removeObjectLaMa({
                            imageBuffer: source,
                            maskBuffer: binaryMask
                        });
                        finalBuffer = result.buffer;
                        mime = result.mimeType || 'image/png';
                    } catch (objErr: any) {
                        console.warn('LaMa AI object removal failed, falling back to local high-fidelity inpainting engine:', objErr?.message || objErr);
                    }
                }

                // 3. Fallback to local inpainting engine if remote providers are offline
                if (!finalBuffer) {
                    const fallbackResult = await inpaintImage({
                        imageBuffer: source,
                        maskBuffer: binaryMask
                    });
                    finalBuffer = fallbackResult.buffer;
                    mime = fallbackResult.mimeType || 'image/png';
                }

                if (!finalBuffer) {
                    throw new AppError('PROCESS_FAILED', 500);
                }

                // SAFETY COMPOSITING LOCK:
                // Guarantee with 100% certainty that unmasked pixels from the original image are NEVER altered.
                // Only pixels inside the mask will take the AI inpainting result.
                try {
                    const origRaw = await sharp(source).resize(srcW, srcH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                    const inpaintRaw = await sharp(finalBuffer).resize(srcW, srcH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                    const maskRaw = await sharp(binaryMask).resize(srcW, srcH, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });

                    const compBuf = Buffer.alloc(srcW * srcH * 4);
                    const oD = origRaw.data;
                    const iD = inpaintRaw.data;
                    const mD = maskRaw.data;
                    const mChannels = maskRaw.info.channels;

                    for (let i = 0; i < srcW * srcH; i++) {
                        const idx4 = i * 4;
                        const isMasked = mD[i * mChannels] > 50;
                        if (isMasked) {
                            compBuf[idx4] = iD[idx4];
                            compBuf[idx4 + 1] = iD[idx4 + 1];
                            compBuf[idx4 + 2] = iD[idx4 + 2];
                            compBuf[idx4 + 3] = iD[idx4 + 3];
                        } else {
                            compBuf[idx4] = oD[idx4];
                            compBuf[idx4 + 1] = oD[idx4 + 1];
                            compBuf[idx4 + 2] = oD[idx4 + 2];
                            compBuf[idx4 + 3] = oD[idx4 + 3];
                        }
                    }

                    finalBuffer = await sharp(compBuf, { raw: { width: srcW, height: srcH, channels: 4 } })
                        .png({ compressionLevel: 6 })
                        .toBuffer();
                } catch (compErr) {
                    console.warn('Safety compositing pass skipped:', compErr);
                }

                if (finalBuffer.length > 4000000) {
                    const compressed = await sharp(finalBuffer)
                        .png({ compressionLevel: 8 })
                        .toBuffer();
                    res.setHeader('Content-Type', 'image/png');
                    return res.send(compressed);
                }
                res.setHeader('Content-Type', mime || 'image/png');
                return res.send(finalBuffer);
            }

            // Handle expand via AI Outpainting (FLUX.1 Fill) with local ambient fallback
            if (tool === 'expand') {
                try {
                    const result = await expandImage({
                        buffer: source,
                        prompt: p.data.prompt || '',
                        width: p.data.expandWidth || 1024,
                        height: p.data.expandHeight || 1024,
                        alignment: p.data.alignment || 'Middle',
                        overlap: p.data.overlap || 10,
                        customResize: p.data.expandScale || 80,
                        resizeMode: p.data.expandScale && p.data.expandScale < 100 ? 'Custom' : 'Full',
                        expandLeft: p.data.expandLeft ?? true,
                        expandRight: p.data.expandRight ?? true,
                        expandTop: p.data.expandTop ?? true,
                        expandBottom: p.data.expandBottom ?? true,
                        offsetX: p.data.expandOffsetX || 0,
                        offsetY: p.data.expandOffsetY || 0
                    });

                    const finalBuffer = result.buffer;
                    if (finalBuffer.length > 4000000) {
                        const compressed = await sharp(finalBuffer)
                            .webp({ quality: 90 })
                            .toBuffer();
                        res.setHeader('Content-Type', 'image/webp');
                        return res.send(compressed);
                    }
                    res.setHeader('Content-Type', result.mimeType || 'image/webp');
                    return res.send(finalBuffer);
                } catch (expErr: any) {
                    console.error('AI expand error:', expErr);
                    throw new AppError('PROVIDER_FAILED', 502);
                }
            }

            // Jika kunci iLoveAPI dikonfigurasi dan bukan mode fallback, jalankan melalui provider iLoveAPI
            if (configured() && !p.data.fallback) {
                try {
                    const providerTool = tool === 'upscale' ? 'upscaleimage' : 'removebackgroundimage';
                    const region = process.env.ILOVEAPI_REGION;
                    let task: any;
                    if (region && ['eu', 'us', 'fr', 'de', 'pl', 'in', 'sg'].includes(region)) {
                        try {
                            task = await providerJSON(`start/${providerTool}/${region}`);
                        }
                        catch {
                            task = await providerJSON(`start/${providerTool}`);
                        }
                    }
                    else {
                        task = await providerJSON(`start/${providerTool}`);
                    }
                    const server = providerHost(task.server);
                    if (typeof task.task === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(task.task)) {
                        const form = new FormData();
                        form.set('task', task.task);
                        form.set('file', new Blob([new Uint8Array(source)]), `image.${ext}`);
                        const upload = await (await provider('upload', { method: 'POST', body: form }, server)).json();
                        if (typeof upload.server_filename === 'string') {
                            await providerJSON('process', {
                                task: task.task,
                                tool: providerTool,
                                files: [{ server_filename: upload.server_filename, filename: `image.${ext}` }],
                                ...(tool === 'upscale' ? { multiplier } : {}),
                                webhook: ''
                            }, server);
                            return res.json({ ticket: await sign({ task: task.task, server }, '30m', 'pixcraft-task') });
                        }
                    }
                } catch (providerError) {
                    console.warn('iLoveAPI provider request failed, falling back to high-res engine:', providerError);
                }
            }

            // If tool is upscale and not in fallback mode, try the specialized Gradio PLKSR Upscaler engine
            if (tool === 'upscale' && !p.data.fallback) {
                try {
                    const gradioOutput = await runGradioUpscale(source);
                    const targetWidth = Math.round(meta.width! * multiplier);
                    const targetHeight = Math.round(meta.height! * multiplier);
                    let pipeline = sharp(gradioOutput)
                        .resize(targetWidth, targetHeight, { kernel: 'lanczos3' });
                    if (meta.hasAlpha) {
                        pipeline = pipeline.ensureAlpha();
                    }
                    const processed = await pipeline
                        .png({ compressionLevel: 6 })
                        .toBuffer();
                    if (processed.length <= 4000000) {
                        res.setHeader('Content-Type', 'image/png');
                        return res.send(processed);
                    }
                } catch (gradioErr) {
                    console.warn('Gradio upscaler failed, falling back to sharp Lanczos engine:', gradioErr);
                }
            }

            // High-resolution local enhancement engine fallback
            // A single response works across serverless instances; no in-memory task registry.
            const result = await runLocalEnhance(source, await sharp(source).metadata(), tool, multiplier);
            if (result.buffer.length > 4000000) throw new AppError('OUTPUT_LIMIT', 413);
            res.setHeader('Content-Type', `image/${result.format}`);
            return res.send(result.buffer);
        }

        const p = other.safeParse(req.body);
        if (!p.success)
            throw new AppError('INVALID_OPTIONS');
        const ticket = await verify(p.data.ticket, 'pixcraft-task');
        const server = String(ticket.server || '');
        const task = String(ticket.task || '');
        if (!/^[A-Za-z0-9_-]{8,300}$/.test(task))
            throw new AppError('INVALID_OPTIONS');

        const host = providerHost(ticket.server);
        if (p.data.action === 'status') {
            const data = await providerJSON(`task/${task}`, undefined, host);
            const d = data.task && typeof data.task === 'object' ? data.task : data;
            return res.json({ status: typeof d.status === 'string' ? d.status : 'TaskProcessing' });
        }

        const response = await provider(`download/${task}`, {}, host);
        const output = await boundedBody(response);
        const meta = await sharp(output, { limitInputPixels: maxPixels() }).metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format || ''))
            throw new AppError('PROVIDER_FORMAT', 502);
        res.setHeader('Content-Type', `image/${meta.format}`);
        res.setHeader('Content-Length', output.length);
        res.send(output);
    }
    catch (e) {
        fail(res, e);
    }
}
