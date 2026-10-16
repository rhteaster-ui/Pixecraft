import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, neutralStyle, type Project } from '../src/types';
import { applyOperation, migrateProject, sourceState } from '../src/studio/document';
import { createComposer, geometry, makeLayout, moveSplit, pixelRect } from '../src/studio/layout';
import { colorPixels } from '../src/studio/render';
const source = new Blob(['fixture'], { type: 'image/jpeg' });
test('compression is policy, CC replaces parameters, original is immutable', () => {
    const original = sourceState(source, 4000, 3000);
    const compressed = applyOperation(original, 'compress', { ...defaults(), format: 'webp', targetKB: 200 });
    const first = applyOperation(compressed, 'adjust', { ...defaults(), brightness: 70 });
    const second = applyOperation(first, 'adjust', { ...defaults(), brightness: 90 });
    assert.equal(second.source, source); assert.equal(second.style.brightness, 90);
    assert.equal(second.operations.length, 0); assert.equal(second.output.format, 'webp'); assert.equal(second.output.targetKB, 200);
    assert.deepEqual([second.width, second.height], [4000, 3000]); assert.equal(original.style.brightness, 100);
});
test('crop, rotate and CC reset retain independent geometry', () => {
    let s = sourceState(source, 600, 400);
    s = applyOperation(s, 'crop', { ...defaults(), crop: { x: 100, y: 50, width: 300, height: 200 } });
    s = applyOperation(s, 'rotate', { ...defaults(), rotation: 90 });
    s = applyOperation(s, 'adjust', { ...defaults(), brightness: 20 });
    s = applyOperation(s, 'adjust', defaults());
    assert.deepEqual([s.width, s.height], [200, 300]); assert.equal(s.operations.length, 2); assert.deepEqual(s.style, neutralStyle());
    assert.throws(() => applyOperation(s, 'crop', { ...defaults(), crop: { x: -1, y: 0, width: 200, height: 300 } }), /CROP_BOUNDS/);
});
test('v1 migration preserves all raster history and does not mutate stored record', () => {
    const edited = new Blob(['edited'], { type: 'image/png' });
    const p: Project = { id: 'legacy', name: 'legacy.jpg', schemaVersion: 1, created: 1, updated: 1, active: 1, original: source, thumbnail: edited, versions: [{ id: 'v0', label: 'Original', blob: source, thumbnail: source, width: 600, height: 400 }, { id: 'v1', label: 'crop', blob: edited, thumbnail: edited, width: 200, height: 200 }] };
    const migrated = migrateProject(p);
    assert.equal(p.schemaVersion, 1); assert.equal(p.versions[1].state, undefined);
    assert.equal(migrated.schemaVersion, 2); assert.equal(migrated.original, source); assert.equal(migrated.versions[1].state?.source, edited);
});
test('normalized templates tile the canvas exactly for 2-5 frames and all ratios', () => {
    for (let n = 2; n <= 5; n++) for (let variant = 0; variant < (n === 3 ? 4 : n === 4 ? 3 : 2); variant++) {
        const tree = makeLayout(Array.from({ length: n }, (_, i) => String(i)), variant);
        for (const [width, height] of [[301, 301], [333, 416], [401, 713], [721, 405]]) {
            const pixels = new Uint8Array(width * height);
            for (const rect of Object.values(geometry(tree).frames)) {
                const r = pixelRect(rect, { width, height, margin: 0, gap: 0 });
                for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) pixels[y * width + x]++;
            }
            assert.ok(pixels.every(p => p === 1), `${n}/${variant}/${width} seam or overlap`);
        }
        if (!('frame' in tree)) { const moved = moveSplit(tree, tree.id, .99); assert.ok(!('frame' in moved) && moved.ratio <= .85); assert.ok(Object.values(geometry(moved).frames).every(r => r.width >= .099 && r.height >= .099)); }
    }
});
test('color correction preserves alpha and neutral pixels', () => {
    const p = new Uint8ClampedArray([12, 80, 180, 90, 255, 0, 0, 0]);
    const original = new Uint8ClampedArray(p); colorPixels(p, neutralStyle()); assert.deepEqual(p, original);
    colorPixels(p, { ...neutralStyle(), exposure: 1, shadows: 20 }); assert.equal(p[3], 90); assert.equal(p[7], 0); assert.ok(p[0] > original[0]);
});
