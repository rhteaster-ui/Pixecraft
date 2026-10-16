import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AlertCircle, ArrowLeftRight, Check, ImagePlus, LoaderCircle, Settings2, X } from 'lucide-react';
import { defaults, type ComposerState, type Frame, type Project } from '../types';
import { clamp, framePlacement, geometry, makeLayout, moveSplit, pixelRect, templates } from '../studio/layout';
import { stateOf, checkpoint } from '../studio/document';
import { renderJob } from '../studio/render';
import { validate } from '../engine';
import { aiProcess, type Health } from '../api';
import { LocalImage, Modal } from './EditorParts';
import { ColorControls, OverlayControls } from './ColorControls';
import type { Lang } from '../i18n';

export default function Composer({ state: s, images, change, commit, lang, health, onBusy, error, importImages }: {
    state: ComposerState; images: Project[]; change: (s: ComposerState) => void; commit: (s?: ComposerState) => void;
    lang: Lang; health: Health; onBusy: (busy: boolean) => void; error: (message: string) => void; importImages: () => void;
}) {
    const id = lang === 'id', tx = (a: string, b: string) => id ? a : b;
    const [selected, select] = useState(s.frames[0].id), [mode, setMode] = useState<'content' | 'layout'>('content');
    const [tab, setTab] = useState('frame'), [settings, setSettings] = useState(innerWidth >= 1100);
    const [preview, setPreview] = useState<Blob>(), [pending, setPending] = useState(false), [ai, setAI] = useState<'upscale' | 'removebg'>(), [busy, setBusy] = useState(false);
    const surface = useRef<HTMLDivElement>(null), latest = useRef(s), controller = useRef<AbortController | null>(null);
    latest.current = s;
    const pointers = useRef(new Map<number, { x: number; y: number }>()), drag = useRef<{ kind: 'content' | 'divider'; id: string; startX: number; startY: number; x: number; y: number; distance: number; zoom: number } | undefined>(undefined);
    const frame = s.frames.find(f => f.id === selected) || s.frames[0], geo = geometry(s.layout);
    const update = (patch: Partial<ComposerState>, done = true) => { const next = { ...latest.current, ...patch }; change(next); if (done) commit(next); };
    const updateFrame = (patch: Partial<Frame>, done = true) => update({ frames: latest.current.frames.map(f => f.id === frame.id ? { ...f, ...patch } : f) }, done);
    const updateImage = (patch: Partial<Frame['image']>, done = false) => updateFrame({ image: { ...frame.image, ...patch } }, done);
    useEffect(() => {
        const abort = new AbortController(); setPending(true);
        const timer = setTimeout(() => renderJob({ document: { kind: 'composer', state: s }, maxDim: innerWidth < 768 ? 800 : 1400 }, abort.signal).then(r => { setPreview(r.blob); setPending(false); }).catch(e => { if (!abort.signal.aborted) { error(e.message); setPending(false); } }), 45);
        return () => { clearTimeout(timer); abort.abort(); };
    }, [s]);
    useEffect(() => () => controller.current?.abort(), []);
    const start = (e: PointerEvent<HTMLDivElement>) => {
        if (busy) return;
        const target = e.target as HTMLElement, divider = target.closest<HTMLElement>('[data-divider]'), hit = target.closest<HTMLElement>('[data-frame]');
        if (mode === 'layout' && divider) {
            const d = geo.dividers.find(d => d.id === divider.dataset.divider)!;
            drag.current = { kind: 'divider', id: d.id, startX: e.clientX, startY: e.clientY, x: 0, y: 0, distance: 0, zoom: 1 };
        } else if (mode === 'content' && hit) {
            const f = s.frames.find(f => f.id === (pointers.current.size && drag.current?.kind === 'content' ? drag.current.id : hit.dataset.frame))!; select(f.id); setTab('frame');
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const pts = [...pointers.current.values()];
            drag.current = { kind: 'content', id: f.id, startX: e.clientX, startY: e.clientY, x: f.x, y: f.y, zoom: f.zoom, distance: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 };
        } else return;
        e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
    };
    const move = (e: PointerEvent<HTMLDivElement>) => {
        const d = drag.current, box = surface.current?.getBoundingClientRect(); if (!d || !box) return;
        if (d.kind === 'divider' && mode === 'layout') {
            const div = geometry(latest.current.layout).dividers.find(x => x.id === d.id)!;
            const scale = box.width / s.width, margin = s.margin * scale;
            const x = (e.clientX - box.left - margin) / (box.width - 2 * margin), y = (e.clientY - box.top - margin) / (box.height - 2 * margin);
            let ratio = div.axis === 'x' ? (x - div.rect.x) / div.rect.width : (y - div.rect.y) / div.rect.height;
            for (const snap of [.25, 1 / 3, .5, 2 / 3, .75]) if (Math.abs(ratio - snap) < .012) ratio = snap;
            update({ layout: moveSplit(latest.current.layout, d.id, ratio) }, false);
        } else if (d.kind === 'content' && mode === 'content') {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const points = [...pointers.current.values()], f = latest.current.frames.find(f => f.id === d.id)!;
            let patch: Partial<Frame>;
            if (points.length === 2 && d.distance) patch = { zoom: clamp(d.zoom * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / d.distance, 1, 5) };
            else {
                const r = pixelRect(geometry(s.layout).frames[f.id], s), placement = framePlacement(f, r), k = box.width / s.width;
                patch = { x: clamp(d.x + (e.clientX - d.startX) / ((r.width - placement.width) * k || Infinity), 0, 1), y: clamp(d.y + (e.clientY - d.startY) / ((r.height - placement.height) * k || Infinity), 0, 1) };
            }
            update({ frames: latest.current.frames.map(f => f.id === d.id ? { ...f, ...patch } : f) }, false);
        }
    };
    const end = (e: PointerEvent<HTMLDivElement>) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) { drag.current = undefined; commit(); } if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); };
    const runAI = async () => {
        if (!ai) return;
        const tool = ai, target = frame, base = latest.current; setAI(undefined); setBusy(true); onBusy(true);
        const abort = new AbortController(); controller.current = abort;
        try {
            const raster = await renderJob({ document: { kind: 'image', state: target.image }, encodeOutput: true }, abort.signal);
            const blob = await aiProcess(raster.blob, tool, defaults(), () => {}, abort.signal), meta = await validate(blob);
            const next = { ...base, frames: base.frames.map(f => f.id === target.id ? { ...f, image: checkpoint(target.image, blob, meta.width, meta.height) } : f) };
            change(next); commit(next);
        } catch (e) { if (!abort.signal.aborted) error(e instanceof Error ? e.message : 'PROCESS_FAILED'); }
        finally { setBusy(false); onBusy(false); }
    };
    const range = (label: string, value: number, min: number, max: number, set: (v: number) => void, step = 1) => <label className="range-control"><span>{label}<b>{Number(value.toFixed(2))}</b></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} onPointerUp={() => commit()} onKeyUp={() => commit()} onBlur={() => commit()}/></label>;
    const warning = framePlacement(frame, pixelRect(geo.frames[frame.id], s)).lowResolution;
    return <div className={`composer-workspace ${settings ? 'composer-settings-open' : ''}`}>
        <section className="composer-center"><div className="studio-toolbar"><div className="segmented"><button className={mode === 'content' ? 'active' : ''} aria-pressed={mode === 'content'} onClick={() => { setMode('content'); setTab('frame'); }}>{tx('Isi gambar', 'Content')}</button><button className={mode === 'layout' ? 'active' : ''} aria-pressed={mode === 'layout'} onClick={() => { setMode('layout'); setTab('layout'); }}>{tx('Tata letak', 'Layout')}</button></div><span className="version-indicator">{s.frames.length} frames</span><button className="icon-button" aria-label="Composer settings" title="Composer settings" onClick={() => setSettings(!settings)}><Settings2 size={18}/></button></div>
        <div className="composer-stage"><div className="composer-surface checker" ref={surface} style={{ aspectRatio: `${s.width}/${s.height}`, maxWidth: `min(100%, calc((100dvh - 295px) * ${s.width / s.height}))` }} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            <LocalImage blob={preview} alt={tx('Pratinjau komposisi', 'Composition preview')} className="composer-preview"/>
            {s.frames.map((f, i) => { const r = pixelRect(geo.frames[f.id], s); return <button key={f.id} data-frame={f.id} aria-label={`Frame ${i + 1}: ${f.name}`} aria-pressed={frame.id === f.id} className={`frame-hit ${frame.id === f.id && mode === 'content' ? 'selected' : ''}`} style={{ left: `${r.x / s.width * 100}%`, top: `${r.y / s.height * 100}%`, width: `${r.width / s.width * 100}%`, height: `${r.height / s.height * 100}%` }} onClick={() => { select(f.id); setTab('frame'); }}><span>{i + 1}</span></button>; })}
            {mode === 'layout' && geo.dividers.map(d => {
                const w = s.width - 2 * s.margin, h = s.height - 2 * s.margin;
                const x = s.margin + (d.rect.x + (d.axis === 'x' ? d.rect.width * d.ratio : 0)) * w, y = s.margin + (d.rect.y + (d.axis === 'y' ? d.rect.height * d.ratio : 0)) * h;
                return <div key={d.id} data-divider={d.id} className={`divider-hit divider-${d.axis}`} role="slider" aria-label={`Divider ${d.id}`} aria-valuemin={15} aria-valuemax={85} aria-valuenow={Math.round(d.ratio * 100)} tabIndex={0} style={{ left: d.axis === 'y' ? `calc(${x / s.width * 100}% + 16px)` : `${x / s.width * 100}%`, top: d.axis === 'x' ? `calc(${y / s.height * 100}% + 16px)` : `${y / s.height * 100}%`, ...(d.axis === 'x' ? { height: `calc(${d.rect.height * h / s.height * 100}% - 32px)` } : { width: `calc(${d.rect.width * w / s.width * 100}% - 32px)` }) }} onKeyDown={e => { if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); update({ layout: moveSplit(s.layout, d.id, d.ratio + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -.01 : .01)) }); } }}><i/></div>;
            })}
            {pending && <span className="preview-status" aria-label="Rendering preview"><LoaderCircle className="spin" size={14}/></span>}
        </div></div>
        <div className="canvas-meta"><span>{s.width} × {s.height}<i/>{s.output.format.toUpperCase()}<i/>{s.background === 'transparent' ? 'Alpha' : s.background}</span><button onClick={() => { setTab('canvas'); setSettings(true); }}>{tx('Kanvas', 'Canvas')}<Settings2 size={13}/></button></div>
        <div className="composer-filmstrip">{s.frames.map((f, i) => <button key={f.id} className={f.id === frame.id ? 'active' : ''} onClick={() => { select(f.id); setTab('frame'); }}><span>{i + 1}</span>{f.name}</button>)}<button onClick={importImages} title={tx('Tambah ke koleksi', 'Add to collection')} aria-label="Import images"><ImagePlus size={17}/></button></div>
        {warning && <div className="quality-warning" role="status"><AlertCircle size={14}/>{tx('Resolusi sumber frame ini lebih kecil dari ukuran tampilnya. Tidak ada HD otomatis.', 'This frame exceeds source resolution. No automatic upscaling tool is run.')}</div>}
        <div className="editor-credit">© {new Date().getFullYear()} · Credit by <a href="https://rhmt.biz.id" target="_blank" rel="noopener noreferrer">r_hmt ofc</a></div></section>
        {settings && <aside className="composer-inspector"><div className="settings-top"><span>COMPOSER</span><button className="icon-button" aria-label="Close Composer settings" onClick={() => setSettings(false)}><X size={16}/></button></div><div className="composer-tabs">{[['frame', tx('Frame', 'Frame')], ['layout', tx('Layout', 'Layout')], ['canvas', tx('Kanvas', 'Canvas')], ['color', tx('Warna', 'Color')], ['overlay', 'Overlay']].map(([v, label]) => <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{label}</button>)}</div>
        <div className="composer-controls" onBlur={() => commit()}>
            {tab === 'canvas' && <><label className="field">{tx('Rasio kanvas', 'Canvas ratio')}<select aria-label="Canvas ratio" value="custom" onChange={e => { if (e.target.value !== 'custom') { const [a, b] = e.target.value.split(':').map(Number); update({ height: Math.round(s.width * b / a) }); } }}><option value="custom">Custom · {s.width} × {s.height}</option>{['1:1', '4:5', '3:4', '9:16', '16:9'].map(r => <option key={r}>{r}</option>)}</select></label><div className="two-fields">{(['width', 'height'] as const).map(k => <label className="field" key={k}>{k === 'width' ? tx('Lebar', 'Width') : tx('Tinggi', 'Height')}<input aria-label={`Canvas ${k}`} type="number" min={64} max={8000} value={s[k]} onChange={e => update({ [k]: clamp(Math.round(Number(e.target.value)), 64, 8000) }, false)}/></label>)}</div><label className="checkbox"><input type="checkbox" checked={s.background === 'transparent'} onChange={e => update({ background: e.target.checked ? 'transparent' : '#ffffff' })}/>{tx('Transparan', 'Transparent')}</label>{s.background !== 'transparent' && <label className="color-field">{tx('Latar', 'Background')}<input aria-label="Canvas background" type="color" value={s.background} onChange={e => update({ background: e.target.value }, false)}/></label>}<label className="field">{tx('Format ekspor', 'Export format')}<select aria-label="Composer format" value={s.output.format} onChange={e => update({ output: { ...s.output, format: e.target.value as 'png' | 'webp' | 'jpeg' } })}>{['png', 'webp', 'jpeg'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label>{s.output.format !== 'png' && range(tx('Kualitas output', 'Output quality'), s.output.quality, 1, 100, quality => update({ output: { ...s.output, quality } }, false))}{s.output.format === 'jpeg' && <p className="control-note">{tx('Transparansi akan menjadi putih saat ekspor JPEG.', 'Transparent pixels become white in JPEG.')}</p>}</>}
            {tab === 'layout' && <><label className="field">Template<select aria-label="Layout template" value="" onChange={e => update({ layout: makeLayout(s.frames.map(f => f.id), Number(e.target.value)) })}><option value="">{tx('Pilih susunan', 'Choose layout')}</option>{templates(s.frames.length).map((v, i) => <option key={v} value={i}>{v}</option>)}</select></label>{range('Gap (px)', s.gap, 0, 60, gap => update({ gap }, false))}{range(tx('Margin luar (px)', 'Outer margin (px)'), s.margin, 0, Math.min(100, Math.min(s.width, s.height) / 8), margin => update({ margin }, false))}{range('Border (px)', s.border, 0, 30, border => update({ border }, false))}<label className="color-field">{tx('Warna border', 'Border color')}<input type="color" value={s.borderColor} onChange={e => update({ borderColor: e.target.value }, false)}/></label>{range('Radius (px)', s.radius, 0, 100, radius => update({ radius }, false))}<p className="control-note">{tx('Divider: 15–85%. Pan gambar hanya aktif dalam mode Isi gambar.', 'Dividers: 15–85%. Image panning is only active in Content mode.')}</p></>}
            {tab === 'frame' && <><span className="overline">{tx('HANYA FRAME AKTIF', 'ACTIVE FRAME ONLY')} · {s.frames.indexOf(frame) + 1}</span><label className="field">{tx('Sumber gambar', 'Image source')}<select aria-label="Frame source" value={frame.assetId} onChange={e => { const p = images.find(p => p.id === e.target.value); if (p) updateFrame({ assetId: p.id, name: p.name, image: stateOf(p.versions[p.active]), x: .5, y: .5, zoom: 1 }); }}>{!images.some(p => p.id === frame.assetId) && <option value={frame.assetId}>{frame.name}</option>}{images.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="segmented">{(['cover', 'contain'] as const).map(v => <button key={v} className={frame.fit === v ? 'active' : ''} onClick={() => updateFrame({ fit: v })}>{v === 'cover' ? 'Fill' : 'Fit'}</button>)}</div>{range('Zoom frame', frame.zoom, 1, 5, zoom => updateFrame({ zoom }, false), .01)}{range('Position X', frame.x, 0, 1, x => updateFrame({ x }, false), .01)}{range('Position Y', frame.y, 0, 1, y => updateFrame({ y }, false), .01)}<button className="secondary" onClick={() => updateFrame({ x: .5, y: .5, zoom: 1 })}><ArrowLeftRight size={15}/>{tx('Tengahkan isi', 'Center content')}</button><div className="style-actions"><button className="secondary" disabled={!health.ai || busy || !navigator.onLine} onClick={() => setAI('upscale')}>HD 2×</button><button className="secondary" disabled={!health.ai || busy || !navigator.onLine} onClick={() => setAI('removebg')}>Remove BG</button></div><p className="control-note">{tx('Pemrosesan HD/Hapus BG hanya mengubah instance frame ini.', 'HD/Remove BG modifies this frame instance only.')}</p></>}
            {tab === 'color' && <><span className="overline">FRAME {s.frames.indexOf(frame) + 1} / CC</span><ColorControls lang={lang} style={frame.image.style} change={style => updateImage({ style })} commit={() => commit()}/></>}
            {tab === 'overlay' && <><span className="overline">FRAME {s.frames.indexOf(frame) + 1} / OVERLAY</span><OverlayControls lang={lang} layers={frame.image.overlays} change={overlays => updateImage({ overlays })}/></>}
        </div><div className="composer-actions"><button className="primary" disabled={busy} onClick={() => { commit(); if (innerWidth < 1100) setSettings(false); }}><Check size={16}/>{tx('Selesai', 'Done')}</button></div></aside>}
        {ai && <Modal title="Frame AI" onClose={() => setAI(undefined)}><h2>{ai === 'upscale' ? 'HD 2×' : 'Remove Background'}</h2><p>{tx('Hanya frame aktif dikirim untuk diproses. Frame lain, termasuk yang memakai sumber sama, tidak berubah.', 'Only this frame is sent for processing. Other frames, including uses of the same source, remain unchanged.')}</p><p>{health.hasKeys ? 'iLoveAPI Cloud' : tx('Mesin server dasar, bukan AI. Hapus latar hanya cocok untuk latar sederhana.', 'Basic server engine, not AI. Background isolation is suitable for simple backgrounds only.')}</p><button className="primary" onClick={runAI}>{tx('Proses frame', 'Process frame')}</button></Modal>}
        {busy && <div className="composer-busy" role="status"><LoaderCircle className="spin"/><span>{tx('Memproses frame', 'Processing frame')}</span><button className="secondary" onClick={() => controller.current?.abort()}>{tx('Batalkan', 'Cancel')}</button></div>}
    </div>;
}
