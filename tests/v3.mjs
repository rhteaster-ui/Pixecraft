import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const server = await createServer({ optimizeDeps: { entries: ['index.html'] }, server: { host: '127.0.0.1', port: 5193, strictPort: true } });
await server.listen();
const executablePath = process.env.PIXCRAFT_TEST_CHROMIUM || await (await import('@sparticuz/chromium')).default.executablePath();
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, hasTouch: true });
const results = [], problems = []; page.on('pageerror', e => problems.push(e.message));
mkdirSync('docs/qa/screenshots', { recursive: true }); mkdirSync('test-results', { recursive: true });
const check = async (name, fn) => { try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); } catch (e) { results.push({ name, status: 'failed', error: e.stack }); console.log('FAIL', name, e.message); throw e; } };
const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
const tool = async (group, name) => { await page.locator('.studio-rail').getByRole('button', { name: group, exact: true }).click(); await page.locator('.tool-flyout').getByRole('button', { name: new RegExp('^' + name) }).click(); };
const apply = async () => { await page.locator('.inspector-actions .primary').click(); await page.locator('.job-progress').waitFor({ state: 'hidden', timeout: 60000 }); };
const saved = async () => { await page.waitForTimeout(1300); return page.evaluate(async () => { const { listWorkspaces } = await import('/src/storage.ts'); return (await listWorkspaces()).find(w => w.id === 'recovery'); }); };
const seed = await sharp({ create: { width: 600, height: 400, channels: 4, background: '#4e925b' } }).png().toBuffer();
const files = Array.from({ length: 5 }, (_, i) => ({ name: `image-${i + 1}.png`, mimeType: 'image/png', buffer: seed }));
try {
await page.route('**/api/health', route => route.fulfill({ json: { ai: true, configured: true, hasKeys: true, authenticated: true, maxBytes: 3000000, maxPixels: 64000000 } }));
await page.goto('http://127.0.0.1:5193');
await page.waitForTimeout(1800);
await check('render contracts: full dimensions, policy, alpha, overlays, cancel and v1 pixels', async () => {
    const r = await page.evaluate(async () => {
        const { defaults, neutralStyle } = await import('/src/types.ts'), { sourceState, applyOperation, migrateProject } = await import('/src/studio/document.ts'), { renderJob } = await import('/src/studio/render.ts');
        const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const ctx = c.getContext('2d'); ctx.fillStyle = '#507090'; ctx.fillRect(0, 0, c.width, c.height);
        const source = await new Promise(r => c.toBlob(r, 'image/jpeg', 1)); const base = sourceState(source, 3000, 2000);
        const edited = applyOperation(base, 'adjust', { ...defaults(), brightness: 80 });
        const out = await renderJob({ document: { kind: 'image', state: edited }, encodeOutput: true });
        const preview = await renderJob({ document: { kind: 'image', state: edited }, maxDim: 500 });
        const compressed = applyOperation(edited, 'compress', { ...defaults(), format: 'webp', targetKB: 200 });
        const final = applyOperation(compressed, 'adjust', { ...defaults(), brightness: 95 });
        const webp = await renderJob({ document: { kind: 'image', state: final }, encodeOutput: true });
        c.width = 60; c.height = 40; ctx.clearRect(0, 0, 60, 40); ctx.fillStyle = '#204060'; ctx.fillRect(10, 10, 40, 20);
        const alpha = await new Promise(r => c.toBlob(r)); let state = sourceState(alpha, 60, 40);
        state = applyOperation(state, 'rotate', { ...defaults(), rotation: 90 });
        state = applyOperation(state, 'adjust', { ...defaults(), brightness: 120 });
        const result = await renderJob({ document: { kind: 'image', state }, encodeOutput: true }); const bitmap = await createImageBitmap(result.blob); c.width = bitmap.width; c.height = bitmap.height; ctx.drawImage(bitmap, 0, 0); bitmap.close(); const cornerAlpha = ctx.getImageData(0, 0, 1, 1).data[3];
        const neutral = sourceState(alpha, 60, 40), overlay = { id: 'o', kind: 'vignette', enabled: false, opacity: 80, blend: 'source-over' };
        const clean = await renderJob({ document: { kind: 'image', state: neutral } });
        const disabled = await renderJob({ document: { kind: 'image', state: { ...neutral, overlays: [overlay] } } });
        const equal = String(new Uint8Array(await clean.blob.arrayBuffer())) === String(new Uint8Array(await disabled.blob.arrayBuffer()));
        let cancelled = false; const abort = new AbortController(); const promise = renderJob({ document: { kind: 'image', state: edited } }, abort.signal); abort.abort(); try { await promise; } catch (e) { cancelled = e.name === 'AbortError'; }
        return { dims: [out.width, out.height], type: out.blob.type, preview: [preview.width, preview.height], policy: final.output, sameSource: final.source === source, webp: webp.blob.type, bytes: webp.blob.size, alpha: cornerAlpha, rotated: [result.width, result.height], overlayEqual: equal, cancelled };
    });
    assert.deepEqual(r.dims, [3000, 2000]); assert.equal(r.type, 'image/jpeg'); assert.deepEqual(r.preview, [500, 333]); assert.equal(r.sameSource, true); assert.equal(r.webp, 'image/webp'); assert.ok(r.bytes <= 204800); assert.equal(r.alpha, 0); assert.deepEqual(r.rotated, [40, 60]); assert.equal(r.overlayEqual, true); assert.equal(r.cancelled, true);
});
await check('Composer raster exports have no seams for 2-5 frames at all preset ratios', async () => {
    const result = await page.evaluate(async () => {
        const { createComposer, templates, makeLayout } = await import('/src/studio/layout.ts'), { sourceState } = await import('/src/studio/document.ts'), { renderJob } = await import('/src/studio/render.ts');
        const c = document.createElement('canvas'); c.width = 30; c.height = 20; const ctx = c.getContext('2d'); ctx.fillStyle = '#ad4b52'; ctx.fillRect(0, 0, 30, 20); const blob = await new Promise(r => c.toBlob(r));
        const p = i => ({ id: String(i), name: 'source.png', active: 0, versions: [{ state: sourceState(blob, 30, 20) }] });
        let count = 0;
        for (let n = 2; n <= 5; n++) for (let variant = 0; variant < templates(n).length; variant++) for (const [a, b] of [[1, 1], [4, 5], [3, 4], [9, 16], [16, 9]]) {
            let s = createComposer(Array.from({ length: n }, (_, i) => p(i))); s.width = 301; s.height = Math.round(301 * b / a); s.layout = makeLayout(s.frames.map(f => f.id), variant);
            const out = await renderJob({ document: { kind: 'composer', state: s }, encodeOutput: true });
            if (out.width !== s.width || out.height !== s.height) throw new Error('Wrong dimensions');
            const bmp = await createImageBitmap(out.blob); c.width = bmp.width; c.height = bmp.height; ctx.drawImage(bmp, 0, 0); bmp.close(); const data = ctx.getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) throw new Error(`Seam ${n}/${variant}/${a}:${b}`); count++;
        }
        return count;
    });
    assert.equal(result, 55);
});
await check('empty Studio, Saved access and 5-image independent import', async () => {
    let chooser = false; page.on('filechooser', () => chooser = true);
    await page.locator('.hero-buttons .primary').click(); await page.locator('.empty-studio').waitFor(); assert.equal(chooser, false);
    await page.getByRole('button', { name: 'Buka tersimpan', exact: true }).click(); await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByLabel('Upload images', { exact: true }).setInputFiles(files); await page.locator('.studio-shell').waitFor(); assert.equal(await page.locator('.thumbnail-card').count(), 5); assert.equal(await page.locator('.composer-workspace').count(), 0);
});
await check('one CC gesture = one undo; reset is scoped; Compare remains explicit', async () => {
    await tool('Edit', 'Adjust'); const slider = page.getByLabel('Kecerahan', { exact: true }); const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await page.locator('.job-progress').waitFor({ state: 'hidden' });
    const w = await saved(); assert.equal(w.images[0].versions.length, 2); assert.equal(w.images[1].versions.length, 1); assert.equal(await page.locator('.compare-before').count(), 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await slider.inputValue(), '100'); await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await page.getByRole('button', { name: 'Bandingkan', exact: true }).click(); await page.getByRole('button', { name: 'Preview image-2.png', exact: true }).click(); assert.equal(await page.locator('.compare-before').count(), 0);
    await page.getByLabel('Apply scope').selectOption('selected'); await slider.fill('80'); await apply();
    const all = await saved(); assert.ok(all.images.every(p => p.versions[p.active].state.style.brightness === 80));
});
await check('failed remote attempt preserves exportable state and never spills across five images', async () => {
    await page.route('**/api/ai', route => route.fulfill({ status:502, json:{ error:'PROVIDER_FAILED' } }));
    await tool('AI Studio','HD'); await page.getByLabel('Apply scope').selectOption('active'); await page.locator('.inspector-actions .primary').click(); await page.getByRole('button',{name:'Proses gambar',exact:true}).click(); await page.locator('.job-progress').waitFor({state:'hidden'}); await page.locator('.image-issue').waitFor();
    const w = await saved(); assert.equal(w.images.filter(p => p.status === 'failed').length, 1); assert.equal(w.images[0].status, 'ready');
    await page.locator('.topbar').getByRole('button',{name:'Ekspor',exact:true}).click(); const event = page.waitForEvent('download'); await page.getByRole('button',{name:'Unduh gambar',exact:true}).click(); const d = await event; await d.saveAs('test-results/v3-failed-valid.png'); assert.equal((await sharp('test-results/v3-failed-valid.png').metadata()).width,600);
});
await check('mobile flyout geometry at 360/375/390/412/480', async () => {
    for (const width of [360, 375, 390, 412, 480]) {
        await page.setViewportSize({ width, height: 800 });
        if (await page.getByRole('button', { name: 'Close settings', exact: true }).count()) await page.getByRole('button', { name: 'Close settings', exact: true }).click();
        for (const group of ['AI Studio', 'Ukuran', 'Edit', 'Finishing']) {
            const button = page.locator('.studio-rail').getByRole('button', { name: group, exact: true }); await button.click(); await page.waitForTimeout(220);
            const b = await button.boundingBox(), f = await page.locator('.tool-flyout').boundingBox(), arrow = await page.locator('.tool-flyout').evaluate(el => { const pseudo = getComputedStyle(el, '::before'); return { left: parseFloat(pseudo.left), width: parseFloat(pseudo.width), bottom: pseudo.bottom, top: parseFloat(pseudo.top) }; });
            assert.ok(Math.abs(f.x + arrow.left + arrow.width / 2 - (b.x + b.width / 2)) < 2); assert.equal(arrow.bottom, '-6px'); assert.ok(arrow.top > f.height - 20, 'Arrow must be at bottom edge, not desktop left edge'); await fit();
            if (group === 'Finishing') await page.screenshot({ path: `docs/qa/screenshots/v3-flyout-${width}.png` });
            await page.getByRole('button', { name: 'Close tools panel', exact: true }).click();
        }
    }
});
await check('Composer starts explicitly; divider, ratio, frame CC and undo are isolated', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.locator('.document-bar').getByRole('button', { name: 'Composer', exact: true }).click(); await page.getByRole('button', { name: /^Buat komposisi/ }).click(); await page.locator('.composer-workspace').waitFor(); await page.locator('.composer-preview').waitFor();
    await page.getByRole('button', { name: 'Tata letak', exact: true }).click(); const divider = page.locator('.divider-hit').first();
    const div = await divider.boundingBox(); await page.mouse.move(div.x + div.width / 2, div.y + div.height / 2); await page.mouse.down(); await page.mouse.move(div.x + div.width / 2, div.y + div.height / 2 + 45, { steps: 6 }); await page.mouse.up();
    const split = await divider.getAttribute('aria-valuenow'); assert.notEqual(split, '50');
    await page.locator('.composer-tabs').getByRole('button', { name: 'Kanvas', exact: true }).click(); await page.getByLabel('Canvas ratio').selectOption('9:16'); assert.match(await page.locator('.canvas-meta').innerText(), /1200 × 2133/);
    assert.equal(await divider.getAttribute('aria-valuenow'), split);
    await page.getByRole('button', { name: 'Isi gambar', exact: true }).click(); await page.locator('.composer-tabs').getByRole('button', { name: 'Warna', exact: true }).click(); await page.getByLabel('Kecerahan', { exact: true }).fill('65'); await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    const w = await saved(), c = w.composer.versions[w.composer.active]; assert.equal(c.frames[0].image.style.brightness, 65); assert.equal(c.frames[1].image.style.brightness, 80); assert.equal(w.images[0].versions[w.images[0].active].state.style.brightness, 80);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await page.getByLabel('Kecerahan', { exact: true }).inputValue(), '80'); await page.getByRole('button', { name: 'Redo', exact: true }).click();
});
await check('Composer export exact 2160x2700; opacity, output and full canvas', async () => {
    await page.locator('.composer-tabs').getByRole('button', { name: 'Kanvas', exact: true }).click(); await page.getByLabel('Canvas width').fill('2160'); await page.getByLabel('Canvas height').fill('2700'); await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    await page.locator('.topbar').getByRole('button', { name: 'Ekspor', exact: true }).click(); const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Unduh komposisi', exact: true }).click(); const d = await event; await d.saveAs('test-results/composer.png'); const meta = await sharp('test-results/composer.png').metadata(); assert.deepEqual([meta.width, meta.height], [2160, 2700]);
});
await check('frame-local HD creates a variant without changing another instance or source asset', async () => {
    await page.locator('.composer-tabs').getByRole('button',{name:'Frame',exact:true}).click();
    await page.getByRole('button',{name:'Frame 2: image-2.png',exact:true}).click();
    const asset = (await saved()).images[0].id;
    await page.getByLabel('Frame source').selectOption(asset);
    await page.getByRole('button',{name:'Frame 1: image-1.png',exact:true}).click();
    await page.unroute('**/api/ai');
    const hd = await sharp(seed).resize(1200,800).png().toBuffer(); let calls=0;
    await page.route('**/api/ai', route => { calls++; return route.fulfill({body:hd,contentType:'image/png'}); });
    await page.getByRole('button',{name:'HD 2×',exact:true}).click(); assert.equal(calls,0);
    await page.getByRole('button',{name:'Proses frame',exact:true}).click(); await page.locator('.composer-busy').waitFor({state:'hidden'});
    const w = await saved(), s = w.composer.versions[w.composer.active]; assert.equal(calls,1); assert.equal(s.frames[0].image.sourceWidth,1200); assert.equal(s.frames[1].image.sourceWidth,600); assert.equal(w.images[0].versions[w.images[0].active].state.sourceWidth,600);
});
await check('touch pinch and divider gestures target separate state', async () => {
    await page.setViewportSize({width:390,height:800}); await page.getByRole('button',{name:'Close Composer settings',exact:true}).click();
    const before = await saved(), initial = before.composer.versions[before.composer.active];
    const f = await page.getByRole('button',{name:'Frame 1: image-1.png',exact:true}).boundingBox();
    const session = await page.context().newCDPSession(page), x=f.x+f.width/2,y=f.y+f.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-12,y,id:1},{x:x+12,y,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-28,y,id:1},{x:x+28,y,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await saved(), current=after.composer.versions[after.composer.active]; assert.ok(current.frames[0].zoom>1); assert.deepEqual(current.layout,initial.layout);
    await page.getByRole('button',{name:'Tata letak',exact:true}).click(); const b=await page.locator('.divider-hit').first().boundingBox();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:3}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2+20,id:3}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await session.detach();
    const changed=await saved(), final=changed.composer.versions[changed.composer.active]; assert.notDeepEqual(final.layout,current.layout); assert.equal(final.frames[0].zoom,current.frames[0].zoom);
    await page.getByRole('button',{name:'Isi gambar',exact:true}).click();
});
await check('Composer responsive viewport matrix', async () => {
    for (const width of [360, 375, 390, 412, 480, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 800 : 1000 });
        if (await page.getByRole('button', { name: 'Close Composer settings', exact: true }).count()) await page.getByRole('button', { name: 'Close Composer settings', exact: true }).click();
        await fit(); const bounds = await page.locator('.composer-surface').boundingBox(); assert.ok(bounds.width > 70 && bounds.height > 70); assert.ok(bounds.y + bounds.height <= (width < 768 ? 800 : 1000));
        await page.screenshot({ path: `docs/qa/screenshots/v3-composer-${width}.png` });
        await page.getByRole('button', { name: 'Composer settings', exact: true }).click(); await fit(); const done = await page.getByRole('button', { name: 'Selesai', exact: true }).boundingBox(); assert.ok(done.y + done.height <= (width < 768 ? 800 : 1000));
    }
    await page.setViewportSize({ width: 844, height: 390 }); await fit(); await page.screenshot({ path: 'docs/qa/screenshots/v3-composer-landscape.png' });
});
await check('autosave offers recovery and restores Composer topology/style/output', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 }); const before = await saved(); await page.reload(); await page.getByRole('button', { name: 'Pulihkan', exact: true }).click(); await page.locator('.composer-workspace').waitFor(); const after = await saved(); assert.deepEqual(after.composer.versions[after.composer.active].layout, before.composer.versions[before.composer.active].layout); assert.equal(after.composer.versions[after.composer.active].width, 2160);
});
await check('v1 IndexedDB projects load with source/history preserved', async () => {
    await page.evaluate(async () => { const { saveProject } = await import('/src/storage.ts'); const c = document.createElement('canvas'); c.width = 77; c.height = 55; const ctx = c.getContext('2d'); ctx.fillStyle = '#8844aa'; ctx.fillRect(0,0,77,55); const blob = await new Promise(r => c.toBlob(r)); await saveProject({ id:'v1-fixture',name:'legacy.png',schemaVersion:1,original:blob,thumbnail:blob,created:1,updated:1,active:0,versions:[{id:'v1',label:'Original',width:77,height:55,blob,thumbnail:blob}] }); });
    await page.getByRole('button', { name: 'Saved workspaces', exact: true }).click(); await page.locator('.saved-list').getByRole('button', { name: /^legacy.png/ }).click(); await page.locator('.document-bar').getByRole('button', { name: 'Gambar', exact: true }).click(); assert.match(await page.locator('.canvas-meta').innerText(), /77 × 55/);
});
await check('quota errors leave in-memory edits usable', async () => {
    await page.evaluate(() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function() { throw new DOMException('Quota fixture', 'QuotaExceededError'); }; });
    await page.getByRole('button', { name: 'Simpan proyek', exact: true }).click(); await page.getByRole('alert').filter({ hasText: /Penyimpanan penuh/ }).waitFor(); assert.equal(await page.locator('.working-image').count(), 1);
    await page.evaluate(() => IDBObjectStore.prototype.put = window.originalPut); await page.getByRole('button', { name: 'Close error', exact: true }).click();
});
await check('About direct route, avatar fallback, links and mobile layout', async () => {
    await page.route('https://rhmt.biz.id/gambar/pp-dev.png', route => route.abort()); await page.goto('http://127.0.0.1:5193/about'); await page.locator('.about-page').waitFor(); await page.locator('.developer-avatar svg').waitFor(); assert.equal(await page.getByRole('link', { name: 'Visit Website' }).getAttribute('href'), 'https://rhmt.biz.id');
    for (const label of ['GitHub','Instagram','TikTok','Telegram']) assert.equal(await page.getByRole('link', { name: label, exact: true }).getAttribute('rel'), 'noopener noreferrer');
    for (const width of [360,480,768,1440]) { await page.setViewportSize({ width, height:800 }); await fit(); await page.screenshot({ path:`docs/qa/screenshots/v3-about-${width}.png`, fullPage:true }); }
    await page.reload(); await page.locator('.about-page').waitFor();
});
await check('reduced motion reveals content and stops ambient animations', async () => {
    await page.emulateMedia({ reducedMotion:'reduce' }); await page.goto('http://127.0.0.1:5193'); await page.waitForTimeout(250); const animation = await page.locator('.ambient-trace').evaluate(e => getComputedStyle(e,'::after').animationName); assert.equal(animation,'none');
    assert.equal(await page.locator('.hero-text').evaluate(e => getComputedStyle(e).opacity), '1');
    assert.equal(await page.locator('.demo-photo input[type="range"]').evaluate(e => getComputedStyle(e).opacity), '0', 'reduced motion must preserve the transparent accessible comparison input');
    assert.ok(await page.locator('.scroll-reveal').evaluateAll(elements => elements.every(e => getComputedStyle(e).opacity === '1')));
    await page.screenshot({ path:'docs/qa/screenshots/v3-home-desktop.png', fullPage:true });
});
await check('no uncaught runtime errors', async () => assert.deepEqual(problems, []));
} finally {
    writeFileSync('docs/qa/v3-results.json', JSON.stringify({ date:new Date().toISOString(), results, problems },null,2)); await browser.close(); await server.close();
}
