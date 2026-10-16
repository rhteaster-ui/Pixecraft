import { inspectHeader } from './header';
import type { Tool, Options, Version } from './types';
export function bytes(n: number): string {
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
export function download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function canvasBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type = 'image/png', quality = 0.92): Promise<Blob> {
    if ('convertToBlob' in canvas) {
        const result = await canvas.convertToBlob({ type, quality });
        if (result.type !== type)
            throw new Error('FORMAT_UNSUPPORTED');
        return result;
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob && blob.type === type)
                resolve(blob);
            else
                reject(new Error('FORMAT_UNSUPPORTED'));
        }, type, quality);
    });
}
export function loadImage(blob: Blob): Promise<HTMLImageElement | ImageBitmap> {
    if (typeof document === 'undefined')
        return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('DECODE_FAILED'));
        };
        img.src = url;
    });
}
export async function validate(file: Blob): Promise<{
    width: number;
    height: number;
}> {
    if (file.size > 50 * 1024 * 1024) {
        throw new Error('FILE_LIMIT');
    }
    const header = inspectHeader(new Uint8Array(await file.arrayBuffer()));
    if (header.width * header.height > 64000000)
        throw new Error('PIXEL_LIMIT');
    const img = await loadImage(file);
    const pixels = img.width * img.height;
    if (pixels > 64000000) {
        throw new Error('PIXEL_LIMIT');
    }
    const dimensions = { width: img.width, height: img.height };
    if ('close' in img) img.close();
    return dimensions;
}
export async function thumb(file: Blob, maxDim = 180): Promise<Blob> {
    const img = await loadImage(file);
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = newCanvas();
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('DECODE_FAILED');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    if ('close' in img) img.close();
    return await canvasBlob(canvas, 'image/webp', 0.8);
}
export async function makeVersion(blob: Blob, label: string): Promise<Version> {
    const img = await loadImage(blob);
    const thumbnail = await thumb(blob, 160);
    const width = img.width, height = img.height;
    if ('close' in img) img.close();
    return {
        id: crypto.randomUUID(),
        label,
        width,
        height,
        blob,
        thumbnail
    };
}
export async function render(blob: Blob, tool: Tool, options: Options, maxDim = 1600): Promise<HTMLCanvasElement> {
    const img = await loadImage(blob);
    const origW = img.width;
    const origH = img.height;
    let targetW = origW;
    let targetH = origH;
    if (tool === 'rotate' && options.rotation % 180 !== 0) {
        targetW = origH;
        targetH = origW;
    }
    const scale = Math.min(maxDim / targetW, maxDim / targetH, 1);
    const w = Math.max(1, Math.round(targetW * scale));
    const h = Math.max(1, Math.round(targetH * scale));
    const canvas = newCanvas();
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('DECODE_FAILED');
    ctx.imageSmoothingQuality = 'high';
    // Apply filters if Adjust
    if (tool === 'adjust') {
        ctx.filter = `brightness(${options.brightness}%) contrast(${options.contrast}%) saturate(${options.saturation}%)`;
    }
    // Handle Rotation and Flipping
    if (tool === 'rotate') {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
        ctx.rotate((options.rotation * Math.PI) / 180);
        const drawW = options.rotation % 180 !== 0 ? h : w;
        const drawH = options.rotation % 180 !== 0 ? w : h;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
    }
    else {
        ctx.drawImage(img, 0, 0, w, h);
    }
    // Handle Watermark
    if (tool === 'watermark') {
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, options.opacity / 100);
        if (options.watermarkMode === 'text' && options.text) {
            const fontSize = Math.max(8, Math.round((w * options.scale) / 100));
            ctx.font = `600 ${fontSize}px sans-serif`;
            ctx.fillStyle = options.color || '#ffffff';
            ctx.textBaseline = 'middle';
            const metrics = ctx.measureText(options.text);
            const textW = metrics.width;
            const pad = Math.min(w, h) * .035;
            let x = pad;
            let y = pad + fontSize / 2;
            if (options.position === 'top-right') {
                x = w - textW - pad;
                y = pad + fontSize / 2;
            }
            else if (options.position === 'center') {
                x = (w - textW) / 2;
                y = h / 2;
            }
            else if (options.position === 'bottom-left') {
                x = pad;
                y = h - pad - fontSize / 2;
            }
            else if (options.position === 'bottom-right') {
                x = w - textW - pad;
                y = h - pad - fontSize / 2;
            }
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = w * .004;
            ctx.fillText(options.text, x, y);
        }
        else if (options.watermarkMode === 'logo' && options.logo) {
            try {
                const logoImg = await loadImage(options.logo);
                const logoTargetW = Math.max(1, Math.round((w * options.scale) / 100));
                const logoScale = logoTargetW / logoImg.width;
                const logoTargetH = Math.round(logoImg.height * logoScale);
                const pad = Math.min(w, h) * .035;
                let lx = pad;
                let ly = pad;
                if (options.position === 'top-right') {
                    lx = w - logoTargetW - pad;
                    ly = pad;
                }
                else if (options.position === 'center') {
                    lx = (w - logoTargetW) / 2;
                    ly = (h - logoTargetH) / 2;
                }
                else if (options.position === 'bottom-left') {
                    lx = pad;
                    ly = h - logoTargetH - pad;
                }
                else if (options.position === 'bottom-right') {
                    lx = w - logoTargetW - pad;
                    ly = h - logoTargetH - pad;
                }
                ctx.drawImage(logoImg, lx, ly, logoTargetW, logoTargetH);
                if ('close' in logoImg)
                    logoImg.close();
            }
            catch {
                // ignore logo render failure in preview
            }
        }
        ctx.restore();
    }
    if ('close' in img) img.close();
    return canvas;
}
export async function processLocalDirect(blob: Blob, tool: Tool, options: Options, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted)
        throw new DOMException('Aborted', 'AbortError');
    const img = await loadImage(blob);
    const origW = img.width;
    const origH = img.height;
    let targetW = origW;
    let targetH = origH;
    if (tool === 'resize') {
        targetW = options.width;
        targetH = options.height;
    }
    else if (tool === 'crop') {
        targetW = options.crop.width;
        targetH = options.crop.height;
    }
    else if (tool === 'rotate' && options.rotation % 180 !== 0) {
        targetW = origH;
        targetH = origW;
    }
    if (tool === 'background') {
        targetW = options.width;
        targetH = options.height;
    }
    if (!Number.isInteger(targetW) || !Number.isInteger(targetH) || targetW < 1 || targetH < 1 || targetW * targetH > 64000000)
        throw new Error('PIXEL_LIMIT');
    if (tool === 'crop' && (options.crop.x < 0 || options.crop.y < 0 || options.crop.x + targetW > origW || options.crop.y + targetH > origH))
        throw new Error('CROP_BOUNDS');
    const canvas = newCanvas();
    canvas.width = Math.max(1, targetW);
    canvas.height = Math.max(1, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('DECODE_FAILED');
    ctx.imageSmoothingQuality = 'high';
    if (tool === 'adjust') {
        ctx.filter = `brightness(${options.brightness}%) contrast(${options.contrast}%) saturate(${options.saturation}%)`;
    }
    if (tool === 'background') {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, targetW, targetH);
        const ratio = Math.min(targetW / origW, targetH / origH) * (1 - options.padding * 2 / 100);
        const dw = origW * ratio, dh = origH * ratio;
        ctx.shadowColor = '#00000045';
        ctx.shadowBlur = options.shadow * targetW / 500;
        ctx.shadowOffsetY = options.shadow * targetH / 1200;
        ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    }
    else if (tool === 'crop') {
        ctx.drawImage(img, options.crop.x, options.crop.y, options.crop.width, options.crop.height, 0, 0, targetW, targetH);
    }
    else if (tool === 'rotate') {
        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);
        ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
        ctx.rotate((options.rotation * Math.PI) / 180);
        const drawW = options.rotation % 180 !== 0 ? targetH : targetW;
        const drawH = options.rotation % 180 !== 0 ? targetW : targetH;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
    }
    else if (tool === 'resize') {
        ctx.drawImage(img, 0, 0, targetW, targetH);
    }
    else {
        ctx.drawImage(img, 0, 0, targetW, targetH);
    }
    // If Watermark
    if (tool === 'watermark') {
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, options.opacity / 100);
        if (options.watermarkMode === 'text' && options.text) {
            const fontSize = Math.max(8, Math.round((targetW * options.scale) / 100));
            ctx.font = `600 ${fontSize}px sans-serif`;
            ctx.fillStyle = options.color || '#ffffff';
            ctx.textBaseline = 'middle';
            const metrics = ctx.measureText(options.text);
            const textW = metrics.width;
            const pad = Math.min(targetW, targetH) * .035;
            let x = pad;
            let y = pad + fontSize / 2;
            if (options.position === 'top-right') {
                x = targetW - textW - pad;
                y = pad + fontSize / 2;
            }
            else if (options.position === 'center') {
                x = (targetW - textW) / 2;
                y = targetH / 2;
            }
            else if (options.position === 'bottom-left') {
                x = pad;
                y = targetH - pad - fontSize / 2;
            }
            else if (options.position === 'bottom-right') {
                x = targetW - textW - pad;
                y = targetH - pad - fontSize / 2;
            }
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = targetW * .004;
            ctx.fillText(options.text, x, y);
        }
        else if (options.watermarkMode === 'logo' && options.logo) {
            const logoImg = await loadImage(options.logo);
            const logoTargetW = Math.max(1, Math.round((targetW * options.scale) / 100));
            const logoScale = logoTargetW / logoImg.width;
            const logoTargetH = Math.round(logoImg.height * logoScale);
            const pad = Math.min(targetW, targetH) * .035;
            let lx = pad;
            let ly = pad;
            if (options.position === 'top-right') {
                lx = targetW - logoTargetW - pad;
                ly = pad;
            }
            else if (options.position === 'center') {
                lx = (targetW - logoTargetW) / 2;
                ly = (targetH - logoTargetH) / 2;
            }
            else if (options.position === 'bottom-left') {
                lx = pad;
                ly = targetH - logoTargetH - pad;
            }
            else if (options.position === 'bottom-right') {
                lx = targetW - logoTargetW - pad;
                ly = targetH - logoTargetH - pad;
            }
            ctx.drawImage(logoImg, lx, ly, logoTargetW, logoTargetH);
            if ('close' in logoImg)
                logoImg.close();
        }
        ctx.restore();
    }
    // Format selection
    let mimeType = 'image/png';
    let quality = 0.92;
    if (tool === 'compress' || tool === 'convert') {
        mimeType = `image/${options.format}`;
        quality = options.quality / 100;
    }
    else {
        // Preserve original format if possible
        mimeType = 'image/png'; // Keep an editable lossless master between steps.
    }
    // If converting transparent canvas to jpeg, fill white background
    if (mimeType === 'image/jpeg') {
        const bgCanvas = newCanvas();
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
        const bgCtx = bgCanvas.getContext('2d');
        if (bgCtx) {
            bgCtx.fillStyle = '#ffffff';
            bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
            bgCtx.drawImage(canvas, 0, 0);
            if ('close' in img)
                img.close();
            return await encode(bgCanvas, 'image/jpeg', quality, tool === 'compress' ? options : undefined, signal);
        }
    }
    if ('close' in img)
        img.close();
    return await encode(canvas, mimeType, quality, tool === 'compress' ? options : undefined, signal);
}
// Canvas API is shared by the worker and the main-thread compatibility fallback.
export function newCanvas(): HTMLCanvasElement {
    return (typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1)) as HTMLCanvasElement;
}
export async function encode(canvas: HTMLCanvasElement, type: string, quality: number, options?: Options, signal?: AbortSignal): Promise<Blob> {
    const target = (options?.targetKB || 0) * 1024;
    if (!target)
        return canvasBlob(canvas, type, quality);
    let surface = canvas;
    for (let resize = 0; resize < 9; resize++) {
        if (signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        let high = quality, low = .01;
        let best = await canvasBlob(surface, type, high);
        if (best.size <= target)
            return best;
        if (type !== 'image/png') {
            const floor = await canvasBlob(surface, type, low);
            if (floor.size <= target) {
                best = floor;
                for (let i = 0; i < 10; i++) {
                    const q = (low + high) / 2, candidate = await canvasBlob(surface, type, q);
                    if (candidate.size <= target) {
                        best = candidate;
                        low = q;
                    }
                    else
                        high = q;
                }
                return best;
            }
            best = floor;
        }
        if (!options?.allowResize || Math.min(surface.width, surface.height) <= 32)
            break;
        const factor = Math.max(.35, Math.min(.85, Math.sqrt(target / best.size) * .9));
        const next = newCanvas();
        next.width = Math.max(1, Math.floor(surface.width * factor));
        next.height = Math.max(1, Math.floor(surface.height * factor));
        next.getContext('2d')!.drawImage(canvas, 0, 0, next.width, next.height);
        surface = next;
    }
    throw new Error('TARGET_UNREACHABLE');
}
export async function localProcess(blob: Blob, tool: Tool, options: Options, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted)
        throw new DOMException('Aborted', 'AbortError');
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
        return processLocalDirect(blob, tool, options, signal);
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
        signal?.addEventListener('abort', abort, { once: true });
        worker.onmessage = e => { cleanup(); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result); };
        worker.onerror = () => { cleanup(); reject(new Error('PROCESS_FAILED')); };
        worker.postMessage({ blob, tool, options });
    });
}
