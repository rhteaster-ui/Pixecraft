import { useState } from 'react';
import { ArrowUp, Copy, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { neutralStyle, type ColorStyle, type Overlay } from '../types';
import { looks } from '../studio/document';
import { validate } from '../engine';
import type { Lang } from '../i18n';
export function ColorControls({ style, change, commit, lang }: { style: ColorStyle; change: (s: ColorStyle) => void; commit?: () => void; lang: Lang }) {
    const id = lang === 'id', [issue, setIssue] = useState('');
    const [presets, setPresets] = useState<typeof looks>(() => { try { const p = JSON.parse(localStorage.getItem('pixcraft-looks') || '[]'); return Array.isArray(p) ? p.slice(0, 8) : []; } catch { return []; } });
    const controls: [string, [keyof ColorStyle, string, string, number, number, number?][]][] = [
        [id ? 'Dasar' : 'Basic', [['exposure', 'Eksposur', 'Exposure', -3, 3, .05], ['brightness', 'Kecerahan', 'Brightness', 0, 200], ['contrast', 'Kontras', 'Contrast', 0, 200], ['saturation', 'Saturasi', 'Saturation', 0, 200]]],
        ['Tone', [['highlights', 'Highlight', 'Highlights', -100, 100], ['shadows', 'Shadows', 'Shadows', -100, 100], ['whites', 'Whites', 'Whites', -100, 100], ['blacks', 'Blacks', 'Blacks', -100, 100], ['fade', 'Fade', 'Fade', 0, 100]]],
        [id ? 'Warna' : 'Color', [['temperature', 'Temperatur', 'Temperature', -100, 100], ['tint', 'Tint', 'Tint', -100, 100], ['vibrance', 'Vibrance', 'Vibrance', -100, 100]]],
        ['Detail', [['sharpen', 'Ketajaman', 'Sharpen', 0, 100]]]
    ];
    const save = () => {
        const name = prompt(id ? 'Nama look' : 'Look name'); if (!name?.trim()) return;
        try { const next = [...presets.slice(-7), { name: name.trim().slice(0, 30), style: { ...style } }]; localStorage.setItem('pixcraft-looks', JSON.stringify(next)); setPresets(next); }
        catch { setIssue(id ? 'Look tidak tersimpan: penyimpanan penuh.' : 'Look not saved: storage unavailable.'); }
    };
    return <div className="color-controls">
        <label className="field">Look<select aria-label="Look" value="" onChange={e => { const p = [...looks, ...presets][Number(e.target.value)]; if (p) change({ ...p.style }); }}><option value="">{id ? 'Pilih look' : 'Choose look'}</option>{[...looks, ...presets].map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select></label>
        <div className="style-actions"><button className="secondary" onClick={() => change(neutralStyle())}>Reset CC</button><button className="icon-button" title={id ? 'Simpan look' : 'Save look'} aria-label="Save look" onClick={save}><Plus size={15}/></button><button className="icon-button" title="Copy style" aria-label="Copy style" onClick={() => { try { localStorage.setItem('pixcraft-style', JSON.stringify(style)); setIssue(id ? 'Warna disalin.' : 'Style copied.'); } catch { setIssue('Storage unavailable'); } }}><Copy size={15}/></button><button className="icon-button" title="Paste style" aria-label="Paste style" onClick={() => { try { const p = JSON.parse(localStorage.getItem('pixcraft-style') || 'null'); if (p && Object.keys(neutralStyle()).every(k => Number.isFinite(p[k]))) change({ ...neutralStyle(), ...p }); } catch { setIssue('Style unavailable'); } }}><ClipboardPaste size={15}/></button></div>
        {controls.map(([name, rows], index) => <details className="cc-group" key={name} open={index === 0 ? true : undefined}><summary>{name}</summary>{rows.map(([key, a, b, min, max, step]) => <label className="range-control" key={key}><span>{id ? a : b}<b>{style[key]}</b></span><input aria-label={id ? a : b} type="range" min={min} max={max} step={step || 1} value={style[key]} onChange={e => change({ ...style, [key]: Number(e.target.value) })} onPointerUp={commit} onKeyUp={e => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') commit?.(); }}/></label>)}</details>)}
        {issue && <p role="status">{issue}</p>}
    </div>;
}
export function OverlayControls({ layers, change, lang }: { layers: Overlay[]; change: (layers: Overlay[]) => void; lang: Lang }) {
    const [error, setError] = useState(''), id = lang === 'id';
    const patch = (key: string, update: Partial<Overlay>) => change(layers.map(l => l.id === key ? { ...l, ...update } : l));
    const add = (kind: Overlay['kind'], image?: Blob) => { if (layers.length < 5) change([...layers, { id: crypto.randomUUID(), kind, image, enabled: true, opacity: 20, blend: kind === 'grain' ? 'overlay' : 'source-over' }]); };
    return <div className="overlay-controls"><div className="style-actions"><button className="secondary" disabled={layers.length >= 5} onClick={() => add('grain')}>+ Grain</button><button className="secondary" disabled={layers.length >= 5} onClick={() => add('vignette')}>+ Vignette</button></div><label className="file-label">{id ? 'Overlay dari gambar' : 'Custom image overlay'}<input aria-label="Custom overlay" disabled={layers.length >= 5} type="file" accept="image/png,image/webp,image/jpeg" onChange={async e => { const f = e.target.files?.[0]; if (f) try { await validate(f); add('custom', f); setError(''); } catch { setError(id ? 'Gambar overlay tidak valid.' : 'Invalid overlay image.'); } e.target.value = ''; }}/></label>
        {layers.map((l, i) => <div className="overlay-layer" key={l.id}><div className="overlay-heading"><label><input type="checkbox" checked={l.enabled} onChange={e => patch(l.id, { enabled: e.target.checked })}/>{l.kind}</label><button className="icon-button" aria-label={`Move overlay ${i + 1} up`} title="Move up" disabled={!i} onClick={() => { const next = [...layers]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; change(next); }}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`Remove overlay ${i + 1}`} title="Remove overlay" onClick={() => change(layers.filter(x => x.id !== l.id))}><Trash2 size={15}/></button></div><label className="range-control"><span>{id ? 'Opasitas' : 'Opacity'}<b>{l.opacity}%</b></span><input type="range" aria-label={`Overlay ${i + 1} opacity`} min={0} max={100} value={l.opacity} onChange={e => patch(l.id, { opacity: Number(e.target.value) })}/></label><label className="field">Blend<select value={l.blend} onChange={e => patch(l.id, { blend: e.target.value as Overlay['blend'] })}>{['source-over', 'multiply', 'screen', 'overlay'].map(x => <option key={x} value={x}>{x === 'source-over' ? 'Normal' : x}</option>)}</select></label></div>)}{error && <p role="alert">{error}</p>}
    </div>;
}
