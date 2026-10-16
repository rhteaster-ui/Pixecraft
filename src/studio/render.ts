import { canvasBlob, encode, loadImage, newCanvas } from '../engine';
import { defaults, neutralStyle, type ImageState, type ComposerState, type ColorStyle, type Overlay, type OutputPolicy } from '../types';
import { framePlacement, geometry, pixelRect, clamp } from './layout';
export type RenderDocument = { kind: 'image'; state: ImageState } | { kind: 'composer'; state: ComposerState };
export interface RenderRequest { document: RenderDocument; maxDim?: number; encodeOutput?: boolean; allowResize?: boolean }
export interface RenderResult { blob: Blob; width: number; height: number }
const surface = (w: number, h: number) => {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w * h > 64_000_000) throw new Error('PIXEL_LIMIT');
    const c = newCanvas(); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    if (!c.getContext('2d')) throw new Error('RENDER_MEMORY');
    return c;
};
const ctxOf = (c: HTMLCanvasElement) => { const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.imageSmoothingQuality = 'high'; return ctx; };
export function colorPixels(pixels: Uint8ClampedArray, s: ColorStyle) {
    const gain = 2 ** clamp(s.exposure, -3, 3) * s.brightness / 100;
    const contrast = s.contrast / 100, saturation = s.saturation / 100;
    for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue;
        let r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
        const l = .2126 * r + .7152 * g + .0722 * b;
        const tone = s.shadows / 100 * (1 - l) ** 2 * .35 + s.highlights / 100 * l ** 2 * .35 + s.whites / 100 * l ** 4 * .3 + s.blacks / 100 * (1 - l) ** 4 * .3;
        r = ((r * gain + tone - .5) * contrast + .5) + s.temperature / 100 * .12 + s.tint / 100 * .04;
        g = ((g * gain + tone - .5) * contrast + .5) - s.tint / 100 * .08;
        b = ((b * gain + tone - .5) * contrast + .5) - s.temperature / 100 * .12 + s.tint / 100 * .04;
        const gray = .2126 * r + .7152 * g + .0722 * b;
        const sat = saturation * (1 + s.vibrance / 100 * (1 - (Math.max(r, g, b) - Math.min(r, g, b))));
        const fade = s.fade / 100 * .3;
        pixels[i] = ((gray + (r - gray) * sat) * (1 - fade) + fade) * 255;
        pixels[i + 1] = ((gray + (g - gray) * sat) * (1 - fade) + fade) * 255;
        pixels[i + 2] = ((gray + (b - gray) * sat) * (1 - fade) + fade) * 255;
    }
}
function correct(c: HTMLCanvasElement, style: ColorStyle) {
    if (Object.entries(neutralStyle()).every(([k, v]) => style[k as keyof ColorStyle] === v)) return;
    const ctx = ctxOf(c), data = ctx.getImageData(0, 0, c.width, c.height);
    colorPixels(data.data, style);
    if (style.sharpen > 0) {
        const p = new Uint8ClampedArray(data.data), out = data.data, a = style.sharpen / 100 * .65, w = c.width;
        for (let y = 1; y < c.height - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            for (let k = 0; k < 3; k++) out[i + k] = p[i + k] * (1 + 4 * a) - a * (p[i - 4 + k] + p[i + 4 + k] + p[i - w * 4 + k] + p[i + w * 4 + k]);
        }
    }
    ctx.putImageData(data, 0, 0);
}
async function overlays(c: HTMLCanvasElement, layers: Overlay[]) {
    const ctx = ctxOf(c);
    for (const layer of layers.filter(l => l.enabled)) {
        ctx.save(); ctx.globalAlpha = clamp(layer.opacity, 0, 100) / 100; ctx.globalCompositeOperation = layer.blend;
        if (layer.kind === 'custom' && layer.image) {
            const img = await loadImage(layer.image);
            try { ctx.drawImage(img, 0, 0, c.width, c.height); } finally { if ('close' in img) img.close(); }
        } else if (layer.kind === 'vignette') {
            const g = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * .2, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) / 2);
            g.addColorStop(0, 'transparent'); g.addColorStop(1, '#000000'); ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
        } else if (layer.kind === 'grain') {
            const tile = surface(128, 128), t = ctxOf(tile), d = t.createImageData(128, 128);
            let seed = 123456;
            for (let i = 0; i < d.data.length; i += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; const v = seed >>> 24; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
            t.putImageData(d, 0, 0); ctx.fillStyle = ctx.createPattern(tile, 'repeat')!; ctx.fillRect(0, 0, c.width, c.height); tile.width = tile.height = 1;
        }
        ctx.restore();
    }
}
export async function renderImage(s: ImageState, maxDim = Infinity): Promise<HTMLCanvasElement> {
    const max = Math.max(s.sourceWidth, s.sourceHeight, s.width, s.height, ...s.operations.flatMap(op => op.tool === 'resize' || op.tool === 'background' ? [op.options.width, op.options.height] : []));
    const scale = Math.min(1, maxDim / max);
    const img = await loadImage(s.source);
    let c = surface(s.sourceWidth * scale, s.sourceHeight * scale);
    try { ctxOf(c).drawImage(img, 0, 0, c.width, c.height); } finally { if ('close' in img) img.close(); }
    let logicalW = s.sourceWidth, logicalH = s.sourceHeight;
    for (const op of s.operations.filter(x => x.tool !== 'watermark')) {
        const o = op.options; let w = logicalW, h = logicalH;
        if (op.tool === 'crop') { w = o.crop.width; h = o.crop.height; }
        if (op.tool === 'resize' || op.tool === 'background') { w = o.width; h = o.height; }
        if (op.tool === 'rotate' && o.rotation % 180) [w, h] = [h, w];
        const next = surface(w * scale, h * scale), ctx = ctxOf(next);
        if (op.tool === 'crop') ctx.drawImage(c, o.crop.x / logicalW * c.width, o.crop.y / logicalH * c.height, o.crop.width / logicalW * c.width, o.crop.height / logicalH * c.height, 0, 0, next.width, next.height);
        else if (op.tool === 'rotate') {
            ctx.save();
            ctx.translate(next.width / 2, next.height / 2); ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1); ctx.rotate(o.rotation * Math.PI / 180);
            const dw = o.rotation % 180 ? next.height : next.width, dh = o.rotation % 180 ? next.width : next.height;
            ctx.drawImage(c, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        } else if (op.tool === 'background') {
            if (o.background !== 'transparent') { ctx.fillStyle = o.background; ctx.fillRect(0, 0, next.width, next.height); }
            const ratio = Math.min(next.width / c.width, next.height / c.height) * (1 - o.padding * 2 / 100), dw = c.width * ratio, dh = c.height * ratio;
            ctx.shadowColor = '#00000045'; ctx.shadowBlur = o.shadow * next.width / 500; ctx.shadowOffsetY = o.shadow * next.height / 1200;
            ctx.drawImage(c, (next.width - dw) / 2, (next.height - dh) / 2, dw, dh);
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        } else ctx.drawImage(c, 0, 0, next.width, next.height);
        c.width = c.height = 1; c = next; logicalW = w; logicalH = h;
    }
    correct(c, s.style);
    for (const op of s.operations.filter(x => x.tool === 'watermark')) {
        const o = op.options, ctx = ctxOf(c); ctx.save(); ctx.globalAlpha = o.opacity / 100;
        const pad = Math.min(c.width, c.height) * .035, font = Math.max(8 * scale, c.width * o.scale / 100);
        let image: Awaited<ReturnType<typeof loadImage>> | undefined;
        try {
            if (o.watermarkMode === 'logo' && o.logo) image = await loadImage(o.logo);
            ctx.font = `600 ${font}px sans-serif`; ctx.textBaseline = 'top'; ctx.fillStyle = o.color;
            const w = image ? c.width * o.scale / 100 : ctx.measureText(o.text).width, h = image ? w * image.height / image.width : font;
            const x = o.position.includes('right') ? c.width - w - pad : o.position === 'center' ? (c.width - w) / 2 : pad;
            const y = o.position.includes('bottom') ? c.height - h - pad : o.position === 'center' ? (c.height - h) / 2 : pad;
            if (image) ctx.drawImage(image, x, y, w, h); else ctx.fillText(o.text, x, y);
        } finally { if (image && 'close' in image) image.close(); ctx.restore(); }
    }
    await overlays(c, s.overlays);
    return c;
}
export async function renderComposer(s: ComposerState, maxDim = Infinity) {
    const scale = Math.min(1, maxDim / Math.max(s.width, s.height));
    const c = surface(s.width * scale, s.height * scale), ctx = ctxOf(c), layout = geometry(s.layout);
    if (s.background !== 'transparent') { ctx.fillStyle = s.background; ctx.fillRect(0, 0, c.width, c.height); }
    const previewState = { ...s, width: c.width, height: c.height, margin: s.margin * scale, gap: s.gap * scale };
    for (const frame of s.frames) {
        const r = pixelRect(layout.frames[frame.id], previewState), placement = framePlacement(frame, r);
        const img = await renderImage(frame.image, maxDim === Infinity ? Infinity : Math.max(c.width, c.height));
        try {
            ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, Math.min(s.radius * scale, r.width / 2, r.height / 2)); ctx.clip();
            ctx.drawImage(img, placement.x, placement.y, placement.width, placement.height);
            if (s.border) { const b = Math.min(s.border * scale, r.width, r.height); ctx.strokeStyle = s.borderColor; ctx.lineWidth = b; ctx.beginPath(); ctx.roundRect(r.x + b / 2, r.y + b / 2, Math.max(0, r.width - b), Math.max(0, r.height - b), Math.max(0, s.radius * scale - b / 2)); ctx.stroke(); }
            ctx.restore();
        } finally { img.width = img.height = 1; }
    }
    return c;
}
export async function renderDirect(request: RenderRequest): Promise<RenderResult> {
    const { document: doc, maxDim = Infinity, encodeOutput = false, allowResize = false } = request;
    const c = doc.kind === 'image' ? await renderImage(doc.state, maxDim) : await renderComposer(doc.state, maxDim);
    try {
        const policy = doc.state.output;
        if (encodeOutput && policy.format === 'jpeg') {
            const ctx = ctxOf(c); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = policy.jpegBackground; ctx.fillRect(0, 0, c.width, c.height); ctx.globalCompositeOperation = 'source-over';
        }
        const blob = encodeOutput ? await encode(c, `image/${policy.format}`, policy.quality / 100, { ...defaults(c.width, c.height), targetKB: policy.targetKB, allowResize }) : await canvasBlob(c, 'image/png');
        if (allowResize) {
            const img = await loadImage(blob); const result = { blob, width: img.width, height: img.height }; if ('close' in img) img.close(); return result;
        }
        return { blob, width: c.width, height: c.height };
    } finally { c.width = c.height = 1; }
}
export async function renderJob(request: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return renderDirect(request);
    return new Promise((resolve, reject) => {
        const w = new Worker(new URL('../document.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => { w.terminate(); signal?.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
        signal?.addEventListener('abort', abort, { once: true });
        w.onmessage = e => { cleanup(); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result); };
        w.onerror = () => { cleanup(); reject(new Error('RENDER_MEMORY')); };
        w.postMessage(request);
    });
}
