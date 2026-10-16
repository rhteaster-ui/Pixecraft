import { defaults, neutralStyle, type ImageState, type Options, type Project, type Version, type Tool, type ColorStyle } from '../types';

export function sourceState(blob: Blob, width: number, height: number): ImageState {
    const format = ['image/jpeg', 'image/webp'].includes(blob.type) ? blob.type.split('/')[1] as 'jpeg' | 'webp' : 'png';
    return { source: blob, sourceWidth: width, sourceHeight: height, width, height, operations: [], style: neutralStyle(), overlays: [], output: { format, quality: 100, targetKB: 0, jpegBackground: '#ffffff' } };
}
export function stateOf(v: Version): ImageState { return v.state || sourceState(v.blob, v.width, v.height); }
export function migrateProject(p: Project): Project {
    if (!p.versions?.length || !(p.original instanceof Blob)) throw new Error('INVALID_PROJECT');
    if (p.schemaVersion > 2) throw new Error('PROJECT_VERSION_UNSUPPORTED');
    return { ...p, schemaVersion: 2, active: Math.max(0, Math.min(p.versions.length - 1, p.active)), versions: p.versions.map(v => ({ ...v, state: stateOf(v) })) };
}
export function optionsFor(v: Version, tool: Tool): Options {
    const s = stateOf(v), o = defaults(s.width, s.height);
    const previous = [...s.operations].reverse().find(x => x.tool === tool);
    return { ...o, ...(tool === 'watermark' && previous ? previous.options : {}), format: s.output.format, quality: s.output.quality, targetKB: s.output.targetKB,
        brightness: s.style.brightness, contrast: s.style.contrast, saturation: s.style.saturation,
        cc: { ...s.style }, overlays: s.overlays };
}
export function styleFrom(o: Options): ColorStyle {
    return { ...neutralStyle(), ...o.cc, brightness: o.brightness, contrast: o.contrast, saturation: o.saturation };
}
export function applyOperation(base: ImageState, tool: Tool, options: Options): ImageState {
    const s = { ...base, operations: [...base.operations] };
    if (tool === 'compress' || tool === 'convert') {
        if (!['png', 'jpeg', 'webp'].includes(options.format) || !Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100 || !Number.isFinite(options.targetKB) || options.targetKB < 0) throw new Error('INVALID_OPTIONS');
        return { ...s, output: { ...s.output, format: options.format, quality: options.quality, targetKB: tool === 'compress' ? options.targetKB : 0 } };
    }
    if (tool === 'adjust') return { ...s, style: styleFrom(options) };
    if (tool === 'overlay') return { ...s, overlays: options.overlays.map(x => ({ ...x })) };
    if (tool === 'upscale' || tool === 'removebg' || tool === 'removewm' || tool === 'removeobj' || tool === 'expand') throw new Error('CHECKPOINT_REQUIRED');
    if (tool === 'crop') {
        const c = options.crop;
        if (![c.x, c.y, c.width, c.height].every(Number.isInteger) || c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1 || c.x + c.width > s.width || c.y + c.height > s.height) throw new Error('CROP_BOUNDS');
        s.width = c.width; s.height = c.height;
    } else if (tool === 'resize' || tool === 'background') {
        s.width = options.width; s.height = options.height;
    } else if (tool === 'rotate') {
        if (![0, 90, 180, 270].includes(options.rotation)) throw new Error('INVALID_OPTIONS');
        if (options.rotation % 180) [s.width, s.height] = [s.height, s.width];
    }
    if (!Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width < 1 || s.height < 1 || s.width * s.height > 64_000_000) throw new Error('PIXEL_LIMIT');
    if (tool === 'watermark') s.operations = s.operations.filter(x => x.tool !== tool);
    s.operations.push({ tool, options: { ...options, crop: { ...options.crop } } });
    return s;
}
export function checkpoint(base: ImageState, blob: Blob, width: number, height: number): ImageState {
    const isPng = blob.type === 'image/png' || !blob.type;
    const format = isPng ? 'png' : (base.output.format || 'png');
    return { ...sourceState(blob, width, height), output: { ...base.output, format } };
}

export const looks: { name: string; style: ColorStyle }[] = [
    { name: 'Neutral', style: neutralStyle() },
    { name: 'Editorial', style: { ...neutralStyle(), contrast: 112, saturation: 90, shadows: 12, highlights: -16, fade: 4 } },
    { name: 'Clean', style: { ...neutralStyle(), exposure: 0.15, contrast: 104, vibrance: 15, whites: 6 } },
    { name: 'Mono', style: { ...neutralStyle(), saturation: 0, contrast: 115, blacks: -8 } }
];
