import { neutralStyle, type ComposerState, type Frame, type SplitTree, type Project } from '../types';
import { stateOf } from './document';
export interface Rect { x: number; y: number; width: number; height: number }
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const templates = (count: number) => count === 2 ? ['Left / Right', 'Top / Bottom'] : count === 3 ? ['2 + 1', '1 + 2', 'Left + stack', 'Stack + right'] : count === 4 ? ['2 x 2', 'Columns', 'Rows'] : ['2 + 3', '3 + 2'];
export function makeLayout(ids: string[], variant = 0): SplitTree {
    let index = 0;
    const split = (axis: 'x' | 'y', a: SplitTree, b: SplitTree, ratio = .5): SplitTree => ({ id: `split-${index++}`, axis, ratio, a, b });
    const row = (list: string[], axis: 'x' | 'y'): SplitTree => list.length === 1 ? { frame: list[0] } : split(axis, { frame: list[0] }, row(list.slice(1), axis), 1 / list.length);
    if (ids.length === 2) return row(ids, variant === 1 ? 'y' : 'x');
    if (ids.length === 3) {
        if (variant === 2) return split('x', row(ids.slice(0, 1), 'y'), row(ids.slice(1), 'y'));
        if (variant === 3) return split('x', row(ids.slice(0, 2), 'y'), row(ids.slice(2), 'y'));
        return split('y', row(ids.slice(0, variant === 1 ? 1 : 2), 'x'), row(ids.slice(variant === 1 ? 1 : 2), 'x'));
    }
    if (ids.length === 4 && variant) return row(ids, variant === 1 ? 'x' : 'y');
    const first = ids.length === 5 && variant === 1 ? 3 : 2;
    return split('y', row(ids.slice(0, first), 'x'), row(ids.slice(first), 'x'));
}
export function geometry(tree: SplitTree, rect: Rect = { x: 0, y: 0, width: 1, height: 1 }, frames: Record<string, Rect> = {}, dividers: { id: string; axis: 'x' | 'y'; ratio: number; rect: Rect }[] = []) {
    if ('frame' in tree) frames[tree.frame] = rect;
    else {
        dividers.push({ id: tree.id, axis: tree.axis, ratio: tree.ratio, rect });
        const r = clamp(tree.ratio, .15, .85);
        if (tree.axis === 'x') {
            geometry(tree.a, { ...rect, width: rect.width * r }, frames, dividers);
            geometry(tree.b, { ...rect, x: rect.x + rect.width * r, width: rect.width * (1 - r) }, frames, dividers);
        } else {
            geometry(tree.a, { ...rect, height: rect.height * r }, frames, dividers);
            geometry(tree.b, { ...rect, y: rect.y + rect.height * r, height: rect.height * (1 - r) }, frames, dividers);
        }
    }
    return { frames, dividers };
}
export function moveSplit(tree: SplitTree, id: string, ratio: number, width = 1, height = 1): SplitTree {
    if ('frame' in tree) return tree;
    const minimum = (node: SplitTree, axis: 'x' | 'y'): number => 'frame' in node ? .1 : node.axis === axis ? minimum(node.a, axis) + minimum(node.b, axis) : Math.max(minimum(node.a, axis), minimum(node.b, axis));
    const span = tree.axis === 'x' ? width : height;
    const min = Math.max(.15, minimum(tree.a, tree.axis) / span), max = Math.min(.85, 1 - minimum(tree.b, tree.axis) / span);
    const next = tree.id === id ? clamp(ratio, min, Math.max(min, max)) : tree.ratio;
    return { ...tree, ratio: next,
        a: moveSplit(tree.a, id, ratio, tree.axis === 'x' ? width * next : width, tree.axis === 'y' ? height * next : height),
        b: moveSplit(tree.b, id, ratio, tree.axis === 'x' ? width * (1 - next) : width, tree.axis === 'y' ? height * (1 - next) : height) };
}
// Shared rounded endpoints prevent 1px seams at fractional split positions.
export function pixelRect(r: Rect, s: Pick<ComposerState, 'width' | 'height' | 'margin' | 'gap'>): Rect {
    const w = s.width - s.margin * 2, h = s.height - s.margin * 2;
    const left = Math.round(s.margin + r.x * w), top = Math.round(s.margin + r.y * h);
    const right = Math.round(s.margin + (r.x + r.width) * w), bottom = Math.round(s.margin + (r.y + r.height) * h);
    const l = r.x > .00001 ? Math.floor(s.gap / 2) : 0, t = r.y > .00001 ? Math.floor(s.gap / 2) : 0;
    const rr = r.x + r.width < .99999 ? Math.ceil(s.gap / 2) : 0, bb = r.y + r.height < .99999 ? Math.ceil(s.gap / 2) : 0;
    return { x: left + l, y: top + t, width: Math.max(1, right - left - l - rr), height: Math.max(1, bottom - top - t - bb) };
}
export function framePlacement(f: Frame, r: Rect) {
    const scale = (f.fit === 'cover' ? Math.max(r.width / f.image.width, r.height / f.image.height) : Math.min(r.width / f.image.width, r.height / f.image.height)) * f.zoom;
    const width = f.image.width * scale, height = f.image.height * scale;
    return { x: r.x + (r.width - width) * f.x, y: r.y + (r.height - height) * f.y, width, height, lowResolution: scale > 1.01 };
}
export function createComposer(images: Project[]): ComposerState {
    if (images.length < 2 || images.length > 5) throw new Error('COMPOSER_COUNT');
    const frames: Frame[] = images.map(p => ({ id: crypto.randomUUID(), assetId: p.id, name: p.name, image: stateOf(p.versions[p.active]), fit: 'cover', x: .5, y: .5, zoom: 1 }));
    return { id: crypto.randomUUID(), name: 'Composition', width: 1200, height: 1200, background: 'transparent', frames, layout: makeLayout(frames.map(f => f.id)), gap: 0, margin: 0, border: 0, borderColor: '#ffffff', radius: 0, output: { format: 'png', quality: 100, targetKB: 0, jpegBackground: '#ffffff' } };
}
