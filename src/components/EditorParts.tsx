import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, Upload, ImagePlus, Search, Download, SlidersHorizontal, Crop, RotateCw, ScanLine, Expand, FileImage, Minimize2, Stamp, Scissors, ChevronLeft, ChevronRight, Check, X, Menu, Sun, Moon, Undo2, Redo2, ShieldCheck, Trash2, FolderOpen, Minus, Plus, Move, FlipHorizontal, FlipVertical, Info, LoaderCircle, Image as ImageIcon, Aperture, Zap, Shield, Layers, CheckCircle2, HelpCircle, ChevronDown, ChevronUp, ArrowRight, ArrowUp, ArrowDown, Maximize2, RotateCcw, Paintbrush, Square, Lasso, Settings2, Eraser, GripHorizontal, GripVertical, LayoutGrid } from 'lucide-react';
import { copy, errors, toolInfo, type Copy, type Lang } from '../i18n';
import { defaults, type Options, type Project, type Tool, type Version } from '../types';
import { bytes, canvasBlob, download, localProcess, makeVersion, render, thumb, validate } from '../engine';
import { clearProjects, listProjects, removeProject, saveProject } from '../storage';
import { aiProcess, health, request, sharpProcess, type Health } from '../api';
// Icon HD Enhance diganti menjadi Aperture (kamera optik presisi tinggi) bukan bintang Sparkles
import { icons } from '../studio/registry';
import { ColorControls, OverlayControls } from './ColorControls';
import { applyOperation, stateOf, styleFrom } from '../studio/document';
import { renderJob } from '../studio/render';
const tools = Object.keys(toolInfo) as Tool[];
const emptyHealth: Health = { ai: false, configured: false, authenticated: false, maxBytes: 25000000, maxPixels: 64000000 };
function useUrl(blob?: Blob) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!blob) {
            setUrl(null);
            return;
        }
        const u = URL.createObjectURL(blob);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [blob]);
    return url;
}
export function LocalImage({ blob, ...props }: {
    blob?: Blob;
    alt: string;
    className?: string;
}) {
    const url = useUrl(blob);
    if (!url)
        return null;
    return <img src={url} {...props}/>;
}
const Brand = ({ onClick }: {
    onClick: () => void;
}) => (<button className="brand" onClick={onClick} aria-label="Pixcraft home">
    <img src="/favicon.svg" alt=""/>
    PIXCRAFT<span>.</span>
  </button>);
function Range({ label, value, min = 0, max = 100, onChange }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (n: number) => void;
}) {
    return (<label className="range-control">
      <span>{label}<b>{value}{max === 200 ? '%' : ''}</b></span>
      <input aria-label={label} type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}/>
    </label>);
}
export function Modal({ children, title, onClose }: {
    children: React.ReactNode;
    title: string;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        const focus = () => ref.current?.querySelector<HTMLElement>('button,input,a')?.focus();
        focus();
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
            if (e.key === 'Tab') {
                const els = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a')];
                const first = els[0], last = els.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('keydown', key); previous?.focus(); };
    }, []);
    return (<div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={e => e.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close" onClick={onClose}><X /></button>
        {children}
      </div>
    </div>);
}
export function Inspector({ tool, o, set, t, lang, version, health: h, busy, onApply, onReset, detent, setDetent, scope, onScope, selectedCount }: {
    tool: Tool;
    o: Options;
    set: (x: Partial<Options>) => void;
    t: Copy;
    lang: Lang;
    version: Version;
    health: Health;
    busy: boolean;
    onApply: () => void;
    onReset: () => void;
    detent: number;
    setDetent: (n: number) => void;
    scope: string;
    onScope: (s: string) => void;
    selectedCount: number;
}) {
    const title = toolInfo[tool].name[lang === 'id' ? 0 : 1];
    const Icon = icons[tool];
    const ai = toolInfo[tool].category === 'ai';
    const drag = useRef(0);
    const number = (key: 'width' | 'height', label: string) => (<label className="field">
      {label}
      <span>
        <input type="number" min="1" max="16384" value={o[key]} onChange={e => {
            const n = Math.max(1, Math.round(Number(e.target.value)));
            set({
                [key]: n,
                ...(o.lock ? { [key === 'width' ? 'height' : 'width']: Math.max(1, Math.round(n * (key === 'width' ? version.height / version.width : version.width / version.height))) } : {})
            });
        }}/>
        <small>px</small>
      </span>
    </label>);
    return (<aside className={`inspector detent-${detent}`}>
      <button className="sheet-handle" aria-label={t.detent} onClick={() => setDetent((detent + 1) % 3)} onPointerDown={e => { drag.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => {
            const delta = e.clientY - drag.current;
            if (Math.abs(delta) > 25)
                setDetent(delta < 0 ? Math.min(2, detent + 1) : Math.max(0, detent - 1));
        }}>
        <i />
      </button>
      <div className="inspector-heading">
        <div className="tool-emblem"><Icon size={22}/></div>
        <div>
          <span className="eyebrow">{ai ? 'AI CLOUD TOOL' : t.workspace.toUpperCase()}</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button reset-small" onClick={onReset} title={t.reset} aria-label={t.reset}><Undo2 size={16}/></button>
      </div>

      <div className="inspector-content">
        <p className="tool-description">{toolInfo[tool].description[lang === 'id' ? 0 : 1]}</p>

        {(tool === 'compress' || tool === 'convert') && (<>
            <label className="field">
              {t.format}
              <select aria-label={t.format} value={o.format} onChange={e => set({ format: e.target.value as Options['format'] })}>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            {o.format !== 'png' && <Range label={t.quality} value={o.quality} min={1} onChange={n => set({ quality: n })}/>}
            {tool === 'compress' && <><label className="field">{lang === 'id' ? 'Target maksimum (KB)' : 'Maximum target (KB)'}<input type="number" aria-label="Target KB" min="0" max="25000" value={o.targetKB} onChange={e => set({ targetKB: Math.max(0, Math.min(25000, Number(e.target.value))) })}/><small>{lang === 'id' ? '0 = gunakan kualitas manual' : '0 = use manual quality'}</small></label><div className="ratio-chips">{[100, 200, 500].map(n => <button key={n} className={o.targetKB === n ? 'chip selected' : 'chip'} onClick={() => set({ targetKB: n })}>{n} KB</button>)}</div><label className="checkbox"><input type="checkbox" checked={o.allowResize} onChange={e => set({ allowResize: e.target.checked })}/>{lang === 'id' ? 'Boleh perkecil dimensi untuk mencapai target' : 'Allow smaller dimensions to meet target'}</label></>}
            <p className="control-note"><Info size={15}/>{tool === 'compress' ? t.compressNote : t.convertNote}</p>
          </>)}

        {(tool === 'resize' || tool === 'background') && (<>
            <div className="two-fields">{number('width', t.width)}{number('height', t.height)}</div>
            <label className="checkbox"><input type="checkbox" checked={o.lock} onChange={e => set({ lock: e.target.checked })}/>{t.ratio}</label>
            <label className="field">
              {t.preset}
              <select defaultValue="" onChange={e => {
                const [w, h] = e.target.value.split('x').map(Number);
                if (w && h)
                    set({ width: w, height: h, lock: false });
            }}>
                <option value="">—</option>
                <option value="1080x1080">1080 × 1080 (Square)</option>
                <option value="1080x1350">1080 × 1350 (Portrait)</option>
                <option value="1920x1080">1920 × 1080 (FHD 16:9)</option>
                <option value="720x1280">720 × 1280 (Story)</option>
              </select>
            </label>
            <p className="control-note">{t.resizeNote}</p>
          </>)}

        {tool === 'background' && <><label className="color-field">{lang === 'id' ? 'Warna latar' : 'Background color'}<input type="color" value={o.background} onChange={e => set({ background: e.target.value })}/></label><Range label={lang === 'id' ? 'Margin (%)' : 'Padding (%)'} value={o.padding} max={40} onChange={n => set({ padding: n })}/><Range label={lang === 'id' ? 'Bayangan' : 'Shadow'} value={o.shadow} max={50} onChange={n => set({ shadow: n })}/><p className="control-note">{lang === 'id' ? 'Bayangan mengikuti transparansi gambar. Gunakan hasil Hapus BG untuk bayangan subjek.' : 'Shadow follows image transparency. Use a background-removed image for a subject shadow.'}</p></>}
        {tool === 'crop' && (<>
            <div className="ratio-chips">
              {['Free', '1:1', '4:5', '9:16', '16:9'].map(r => (<button key={r} className="chip" onClick={() => {
                    if (r === 'Free') {
                        set({ crop: { x: 0, y: 0, width: version.width, height: version.height } });
                        return;
                    }
                    const [a, b] = r.split(':').map(Number);
                    const w = Math.min(version.width, Math.floor(version.height * a / b)), h = Math.floor(w * b / a);
                    set({ crop: { x: Math.floor((version.width - w) / 2), y: Math.floor((version.height - h) / 2), width: w, height: h } });
                }}>
                  {r === 'Free' ? t.free : r}
                </button>))}
            </div>
            <p className="control-note">{t.cropHint}</p>
            <div className="two-fields">
              {(['x', 'y', 'width', 'height'] as const).map(k => (<label className="field" key={k}>
                  {k === 'x' ? t.cropX : k === 'y' ? t.cropY : k === 'width' ? t.width : t.height}
                  <input type="number" min={k === 'x' || k === 'y' ? 0 : 1} max={k === 'x' || k === 'width' ? version.width : version.height} value={o.crop[k]} onChange={e => set({ crop: { ...o.crop, [k]: Math.round(Number(e.target.value)) } })}/>
                </label>))}
            </div>
          </>)}

        {tool === 'rotate' && (<>
            <button className="wide-button" onClick={() => set({ rotation: (o.rotation + 90) % 360 })}>
              <RotateCw size={18}/>{t.rotate90}<span>{o.rotation}°</span>
            </button>
            <button className={`wide-button ${o.flipH ? 'selected' : ''}`} onClick={() => set({ flipH: !o.flipH })}>
              <FlipHorizontal size={18}/>{t.flipH}
            </button>
            <button className={`wide-button ${o.flipV ? 'selected' : ''}`} onClick={() => set({ flipV: !o.flipV })}>
              <FlipVertical size={18}/>{t.flipV}
            </button>
          </>)}

        {tool === 'adjust' && <ColorControls lang={lang} style={styleFrom(o)} change={style => set({ brightness: style.brightness, contrast: style.contrast, saturation: style.saturation, cc: style })} commit={scope === 'active' ? onApply : undefined}/>}
        {tool === 'overlay' && <OverlayControls lang={lang} layers={o.overlays} change={overlays => set({ overlays })}/>}

        {tool === 'watermark' && (<>
            <div className="segmented">
              {(['text', 'logo'] as const).map(m => (<button className={o.watermarkMode === m ? 'active' : ''} key={m} onClick={() => set({ watermarkMode: m })}>
                  {t[m]}
                </button>))}
            </div>
            {o.watermarkMode === 'text' ? (<>
                <label className="field">{t.text}<input maxLength={80} value={o.text} onChange={e => set({ text: e.target.value })}/></label>
                <label className="color-field">{t.color}<input type="color" value={o.color} onChange={e => set({ color: e.target.value })}/></label>
              </>) : (<label className="file-label">
                {o.logo ? t.logo : t.logoUpload}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { if (e.target.files?.[0])
                set({ logo: e.target.files[0] }); }}/>
              </label>)}
            <Range label={t.opacity} value={o.opacity} onChange={n => set({ opacity: n })}/>
            <Range label={t.scale} value={o.scale} min={1} max={20} onChange={n => set({ scale: n })}/>
            <label className="field">
              {t.position}
              <select value={o.position} onChange={e => set({ position: e.target.value as Options['position'] })}>
                {['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].map(v => (<option key={v} value={v}>
                    {lang === 'id' ? { 'top-left': 'Kiri atas', 'top-right': 'Kanan atas', center: 'Tengah', 'bottom-left': 'Kiri bawah', 'bottom-right': 'Kanan bawah' }[v] : v.replace('-', ' ')}
                  </option>))}
              </select>
            </label>
            <p className="control-note">{t.watermarkNote}</p>
          </>)}

        {tool === 'upscale' && (<div className="segmented">
            {([2, 4] as const).map(m => (<button key={m} className={o.multiplier === m ? 'active' : ''} onClick={() => set({ multiplier: m })}>
                {m}× Multiplier
              </button>))}
          </div>)}

        {tool === 'removeobj' && (<>
            <div className="segmented">
              {(['brush', 'rect', 'lasso', 'eraser'] as const).map(m => (<button
                key={m}
                type="button"
                className={o.maskMode === m ? 'active' : ''}
                onClick={() => set({ maskMode: m })}
              >
                {m === 'brush' ? 'Brush' : m === 'rect' ? 'Rectangle' : m === 'lasso' ? 'Lasso' : 'Eraser'}
              </button>))}
            </div>
            {(o.maskMode === 'brush' || o.maskMode === 'eraser') && (
              <Range
                label={lang === 'id' ? 'Ukuran Kuas' : 'Brush Size'}
                value={o.brushSize}
                min={8}
                max={120}
                onChange={n => set({ brushSize: n })}
              />
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="secondary"
                style={{ flex: 1, minHeight: '34px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => set({ maskBlob: null })}
                title={lang === 'id' ? 'Hapus seleksi mask' : 'Clear mask selection'}
              >
                <Trash2 size={14}/> {lang === 'id' ? 'Bersihkan Mask' : 'Clear Mask'}
              </button>
            </div>
            <p className="control-note">
              <Info size={15}/>
              {lang === 'id'
                ? 'Tandai area objek yang ingin dihapus pada gambar menggunakan Brush, Rectangle, atau Lasso. Gunakan Eraser untuk memperbaiki.'
                : 'Highlight the unwanted object on canvas using Brush, Rectangle, or Lasso. Use Eraser to refine the mask.'}
            </p>
          </>)}

        {tool === 'expand' && (<>
            <div className="segmented" style={{ marginBottom: '14px' }}>
              {([
                ['1:1', '1:1', 1024, 1024],
                ['16:9', '16:9', 1280, 720],
                ['9:16', '9:16', 720, 1280],
                ['4:3', '4:3', 1024, 768],
                ['3:4', '3:4', 768, 1024]
              ] as const).map(([r, label, w, h]) => (
                <button
                  key={r}
                  type="button"
                  className={o.expandRatio === r ? 'active' : ''}
                  onClick={() => set({ expandRatio: r, expandWidth: w, expandHeight: h, expandOffsetX: 0, expandOffsetY: 0 })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <label className="field" style={{ margin: 0 }}>
                {lang === 'id' ? 'Lebar Target' : 'Target Width'}
                <input
                  type="number"
                  min={256}
                  max={1920}
                  step={32}
                  value={o.expandWidth}
                  onChange={e => set({ expandWidth: Number(e.target.value) || 1024, expandRatio: 'custom' })}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                {lang === 'id' ? 'Tinggi Target' : 'Target Height'}
                <input
                  type="number"
                  min={256}
                  max={1920}
                  step={32}
                  value={o.expandHeight}
                  onChange={e => set({ expandHeight: Number(e.target.value) || 1024, expandRatio: 'custom' })}
                />
              </label>
            </div>

            <label className="field" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{lang === 'id' ? 'Ukuran Gambar (Kecil / Besar)' : 'Source Image Scale'}</span>
                <b style={{ color: 'var(--accent)' }}>{o.expandScale || 80}%</b>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={o.expandScale || 80}
                onChange={e => set({ expandScale: Number(e.target.value) })}
                style={{ marginTop: '6px' }}
              />
              <small>{lang === 'id' ? 'Atur seberapa besar gambar di dalam kanvas perluasan (kecil = lebih luas latar baru).' : 'Scale image inside canvas (smaller = more expansion area).'}</small>
            </label>

            <div className="field" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span>{lang === 'id' ? 'Tata Letak Sudut & Posisi' : 'Corner & Position Layout'}</span>
                {(o.expandOffsetX !== 0 || o.expandOffsetY !== 0) && (
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: '10px', padding: '0 4px', height: 'auto', color: 'var(--accent)' }}
                    onClick={() => set({ expandOffsetX: 0, expandOffsetY: 0 })}
                  >
                    {lang === 'id' ? 'Reset Geser' : 'Reset Offset'}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxWidth: '210px', margin: '4px 0 8px' }}>
                {([
                  ['TopLeft', '↖', lang === 'id' ? 'Kiri Atas' : 'Top Left'],
                  ['Top', '↑', lang === 'id' ? 'Atas Tengah' : 'Top Center'],
                  ['TopRight', '↗', lang === 'id' ? 'Kanan Atas' : 'Top Right'],
                  ['Left', '←', lang === 'id' ? 'Kiri Tengah' : 'Center Left'],
                  ['Middle', '⏺', lang === 'id' ? 'Tengah' : 'Center'],
                  ['Right', '→', lang === 'id' ? 'Kanan Tengah' : 'Center Right'],
                  ['BottomLeft', '↙', lang === 'id' ? 'Kiri Bawah' : 'Bottom Left'],
                  ['Bottom', '↓', lang === 'id' ? 'Bawah Tengah' : 'Bottom Center'],
                  ['BottomRight', '↘', lang === 'id' ? 'Kanan Bawah' : 'Bottom Right'],
                ] as const).map(([pos, icon, label]) => {
                  const isActive = o.expandAlignment === pos && !o.expandOffsetX && !o.expandOffsetY;
                  return (
                    <button
                      key={pos}
                      type="button"
                      className={isActive ? 'active' : ''}
                      title={label}
                      onClick={() => set({ expandAlignment: pos, expandOffsetX: 0, expandOffsetY: 0 })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '14px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: isActive ? 'var(--soft)' : 'var(--bg)',
                        color: isActive ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600
                      }}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
              <small>{lang === 'id' ? 'Pilih salah satu dari 9 posisi sudut/tengah, atau langsung geser/drag gambar pada kanvas.' : 'Select one of 9 corner/center positions, or drag the image directly on the canvas.'}</small>
            </div>

            <div className="field" style={{ marginBottom: '14px' }}>
              <span style={{ display: 'block', marginBottom: '6px' }}>{lang === 'id' ? 'Arah Perluasan Latar' : 'Expand Directions'}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {([
                  ['expandLeft', lang === 'id' ? 'Kiri' : 'Left'],
                  ['expandRight', lang === 'id' ? 'Kanan' : 'Right'],
                  ['expandTop', lang === 'id' ? 'Atas' : 'Top'],
                  ['expandBottom', lang === 'id' ? 'Bawah' : 'Bottom']
                ] as const).map(([prop, label]) => (
                  <button
                    key={prop}
                    type="button"
                    className={o[prop] ? 'active' : ''}
                    onClick={() => set({ [prop]: !o[prop] })}
                    style={{
                      padding: '6px 4px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      background: o[prop] ? 'var(--soft)' : 'var(--bg)',
                      color: o[prop] ? 'var(--accent)' : 'var(--muted)',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {o[prop] ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field" style={{ marginBottom: '14px' }}>
              {lang === 'id' ? 'Prompt Suasana (Opsional)' : 'Prompt (Optional)'}
              <input
                type="text"
                placeholder={lang === 'id' ? 'misal: beautiful scenic nature landscape, cozy room...' : 'e.g. beautiful scenic nature landscape, cozy room...'}
                value={o.expandPrompt}
                onChange={e => set({ expandPrompt: e.target.value })}
                maxLength={250}
              />
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                {[
                  lang === 'id' ? 'Pemandangan alam asri' : 'Scenic nature landscape',
                  lang === 'id' ? 'Studio minimalis modern' : 'Modern minimalist studio',
                  lang === 'id' ? 'Ruangan hangat & nyaman' : 'Warm cozy room',
                  lang === 'id' ? 'Latar belakang putih bersih' : 'Clean minimal backdrop',
                  lang === 'id' ? 'Pantai matahari terbenam' : 'Sunset beach scenery'
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    className="chip"
                    onClick={() => set({ expandPrompt: suggestion })}
                    style={{ fontSize: '9px', padding: '3px 7px', minHeight: '22px', borderRadius: '4px' }}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </label>
          </>)}

        {ai && (<>
            <div className="privacy-note">
              <ShieldCheck size={18}/>
              <p>{tool === 'removewm'
                ? (lang === 'id' ? 'Gambar dikirim ke provider MagicEraser melalui server Pixcraft secara aman untuk menghapus watermark.' : 'Image is sent securely to the MagicEraser provider via Pixcraft server to remove watermarks.')
                : tool === 'removeobj'
                ? (lang === 'id' ? 'Gambar dan mask diproses melalui LaMa AI Inpainting (Large Mask Inpainting) untuk menghapus objek secara natural tanpa bekas.' : 'Image and mask are processed via LaMa AI Inpainting to seamlessly erase unwanted objects.')
                : tool === 'expand'
                ? (lang === 'id' ? 'Gambar diperluas menggunakan model FLUX.1 Fill AI Outpainting untuk mengisi kanvas baru secara fotorealistik.' : 'Image is expanded using FLUX.1 Fill AI Outpainting for photorealistic canvas and scenery extension.')
                : (h.hasKeys ? t.remotePrivacy : (lang === 'id' ? 'Gambar dikirim ke server Pixcraft untuk interpolasi / isolasi latar dasar, bukan AI.' : 'Images are sent to the Pixcraft server for basic interpolation / isolation, not AI.'))}</p>
            </div>
            <p className="control-note">{tool === 'removewm' ? (lang === 'id' ? 'Mendukung format PNG, JPG, JPEG, WEBP.' : 'Supports PNG, JPG, JPEG, WEBP.') : tool === 'removeobj' ? (lang === 'id' ? 'Output PNG berkualitas tinggi dengan model LaMa inpainting.' : 'High-fidelity PNG output via LaMa inpainting.') : tool === 'expand' ? (lang === 'id' ? 'Mendukung perluasan hingga resolusi 1920px dengan FLUX.1 Fill.' : 'Supports up to 1920px resolution via FLUX.1 Fill.') : t.remoteLimit}</p>
            {tool !== 'removewm' && tool !== 'removeobj' && tool !== 'expand' && !h.hasKeys && (<div className="notice">
                <Info size={16}/>
                {lang === 'id'
                    ? 'Mesin server dasar. Aktifkan iLoveAPI dengan dua kunci server untuk pemrosesan AI.'
                    : 'Basic server engine. Configure the two server keys to enable iLoveAPI AI.'}
              </div>)}
          </>)}

        <dl className="image-metadata">
          <div><dt>{t.input}</dt><dd>{bytes(version.blob.size)}</dd></div>
          <div><dt>{t.size}</dt><dd>{version.width} × {version.height}</dd></div>
          <div><dt>{lang === 'id' ? 'Mesin' : 'Engine'}</dt><dd>{tool === 'removewm' ? 'MagicEraser AI' : tool === 'removeobj' ? 'LaMa AI Inpainting' : tool === 'expand' ? 'FLUX.1 Fill Outpainting AI' : ai ? (h.hasKeys ? 'iLoveAPI Cloud' : 'Basic server') : t.localEngine}</dd></div>
        </dl>
      </div>

      <div className="scope-control"><span>{lang === 'id' ? 'Terapkan ke' : 'Apply to'}</span><select aria-label="Apply scope" value={scope} onChange={e => onScope(e.target.value)} disabled={busy}><option value="active">{lang === 'id' ? 'Gambar aktif' : 'Active image'}</option><option value="selected">{lang === 'id' ? 'Terpilih' : 'Selected'} ({selectedCount})</option></select></div>
      <div className="inspector-actions">
        <button className="primary" disabled={busy || (ai && (!h.ai || !navigator.onLine)) || (scope === 'selected' && !selectedCount) || (tool === 'watermark' && o.watermarkMode === 'logo' && !o.logo) || (tool === 'removeobj' && !o.maskBlob)} onClick={onApply}>
          {busy ? <LoaderCircle className="spin" size={18}/> : <Check size={18}/>} {t.apply}
        </button>
        <button className="text-button" onClick={onReset} disabled={busy}>{t.reset}</button>
      </div>
    </aside>);
}
export function Stage({ version, original, tool, o, set, compare, zoom, setZoom, t, pan: extPan, setPan: extSetPan, busy = false, onApply, lang = 'id', onOpenSettings }: {
    version: Version;
    original: Blob;
    tool: Tool;
    o: Options;
    set: (x: Partial<Options>) => void;
    compare: boolean;
    zoom: number;
    setZoom: (n: number | ((prev: number) => number)) => void;
    t: Copy;
    pan?: { x: number; y: number };
    setPan?: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    busy?: boolean;
    onApply?: () => void;
    lang?: Lang;
    onOpenSettings?: () => void;
}) {
    const source = useUrl(version.blob), before = useUrl(original);
    const [preview, setPreview] = useState<Blob>();
    const url = useUrl(preview);
    const [split, setSplit] = useState(50);
    const [box, setBox] = useState({ w: 600, h: 500 });
    const ref = useRef<HTMLDivElement>(null);

    // Pan state & drag tracking
    const [internalPan, setInternalPan] = useState({ x: 0, y: 0 });
    const pan = extPan ?? internalPan;
    const setPan = extSetPan ?? setInternalPan;
    const [isPanning, setIsPanning] = useState(false);
    const [spaceDown, setSpaceDown] = useState(false);
    const panStart = useRef<{
        pointerId: number;
        x: number;
        y: number;
        startPanX: number;
        startPanY: number;
    } | null>(null);

    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const panRef = useRef(pan);
    panRef.current = pan;

    const drag = useRef<{
        mode: string;
        x: number;
        y: number;
        crop: Options['crop'];
    } | null>(null);
    const pinch = useRef(new Map<number, {
        x: number;
        y: number;
    }>());
    const lastPinch = useRef(0);

    // Object Remover mask canvas state & refs
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const draftCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingMask = useRef(false);
    const maskStartPos = useRef<{ x: number; y: number } | null>(null);
    const lassoPoints = useRef<Array<{ x: number; y: number }>>([]);
    const activeMaskPointers = useRef<Set<number>>(new Set());

    // Stroke undo/redo stack
    const maskUndoStack = useRef<ImageData[]>([]);
    const maskRedoStack = useRef<ImageData[]>([]);
    const lastCommittedBlob = useRef<Blob | null>(null);
    const [canUndoMask, setCanUndoMask] = useState(false);
    const [canRedoMask, setCanRedoMask] = useState(false);

    const updateMaskStackStatus = () => {
        setCanUndoMask(maskUndoStack.current.length > 0);
        setCanRedoMask(maskRedoStack.current.length > 0);
    };

    const pushMaskSnapshot = () => {
        const c = maskCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        try {
            const data = ctx.getImageData(0, 0, c.width, c.height);
            maskUndoStack.current.push(data);
            if (maskUndoStack.current.length > 25) maskUndoStack.current.shift();
            maskRedoStack.current = [];
            updateMaskStackStatus();
        } catch {}
    };

    const handleMaskUndo = () => {
        const c = maskCanvasRef.current;
        if (!c || maskUndoStack.current.length === 0) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const currentData = ctx.getImageData(0, 0, c.width, c.height);
        maskRedoStack.current.push(currentData);
        const prevData = maskUndoStack.current.pop()!;
        ctx.putImageData(prevData, 0, 0);
        updateMaskStackStatus();
        commitMaskBlob();
    };

    const handleMaskRedo = () => {
        const c = maskCanvasRef.current;
        if (!c || maskRedoStack.current.length === 0) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const currentData = ctx.getImageData(0, 0, c.width, c.height);
        maskUndoStack.current.push(currentData);
        const nextData = maskRedoStack.current.pop()!;
        ctx.putImageData(nextData, 0, 0);
        updateMaskStackStatus();
        commitMaskBlob();
    };

    useEffect(() => {
        if (tool !== 'removeobj') return;
        if (!o.maskBlob && maskCanvasRef.current) {
            if (lastCommittedBlob.current !== null) {
                const c = maskCanvasRef.current;
                const ctx = c.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, c.width, c.height);
                draftCanvasRef.current = null;
                maskUndoStack.current = [];
                maskRedoStack.current = [];
                lastCommittedBlob.current = null;
                updateMaskStackStatus();
            }
            return;
        }
        if (o.maskBlob && o.maskBlob !== lastCommittedBlob.current && maskCanvasRef.current) {
            lastCommittedBlob.current = o.maskBlob;
            const c = maskCanvasRef.current;
            const ctx = c.getContext('2d');
            if (ctx) {
                const img = new Image();
                const blobUrl = URL.createObjectURL(o.maskBlob);
                img.onload = () => {
                    const temp = document.createElement('canvas');
                    temp.width = c.width;
                    temp.height = c.height;
                    const tCtx = temp.getContext('2d');
                    if (tCtx) {
                        tCtx.drawImage(img, 0, 0, c.width, c.height);
                        const tData = tCtx.getImageData(0, 0, c.width, c.height);
                        const d = tData.data;
                        for (let i = 0; i < d.length; i += 4) {
                            if (d[i] > 120 && d[i + 1] > 120 && d[i + 2] > 120) {
                                d[i] = 255;
                                d[i + 1] = 45;
                                d[i + 2] = 85;
                                d[i + 3] = 165;
                            } else {
                                d[i + 3] = 0;
                            }
                        }
                        ctx.putImageData(tData, 0, 0);
                        pushMaskSnapshot();
                    }
                    URL.revokeObjectURL(blobUrl);
                };
                img.src = blobUrl;
            }
        }
    }, [o.maskBlob, tool]);

    const getCanvasCoords = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        const c = maskCanvasRef.current;
        if (!c) return { x: 0, y: 0 };
        const rect = c.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * c.width;
        const y = ((e.clientY - rect.top) / rect.height) * c.height;
        return {
            x: Math.max(0, Math.min(c.width, x)),
            y: Math.max(0, Math.min(c.height, y))
        };
    };

    const commitMaskBlob = () => {
        const c = maskCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        let marked = false;

        const expCanvas = document.createElement('canvas');
        expCanvas.width = c.width;
        expCanvas.height = c.height;
        const expCtx = expCanvas.getContext('2d');
        if (!expCtx) return;
        const expData = expCtx.createImageData(c.width, c.height);
        const expD = expData.data;

        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 15) {
                marked = true;
                expD[i] = 255;
                expD[i + 1] = 255;
                expD[i + 2] = 255;
                expD[i + 3] = 255;
            } else {
                expD[i] = 0;
                expD[i + 1] = 0;
                expD[i + 2] = 0;
                expD[i + 3] = 0;
            }
        }
        expCtx.putImageData(expData, 0, 0);

        if (marked) {
            expCanvas.toBlob(blob => {
                if (blob) {
                    lastCommittedBlob.current = blob;
                    set({ maskBlob: blob });
                }
            }, 'image/png');
        } else {
            lastCommittedBlob.current = null;
            set({ maskBlob: null });
        }
    };

    const onMaskPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (spaceDown) return;
        if (e.button !== 0) return;
        activeMaskPointers.current.add(e.pointerId);
        if (activeMaskPointers.current.size > 1) {
            isDrawingMask.current = false;
            return;
        }

        const c = maskCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        pushMaskSnapshot();
        isDrawingMask.current = true;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}

        const coords = getCanvasCoords(e);
        const brushPx = Math.max(4, o.brushSize * (version.width / sw));

        if (o.maskMode === 'brush') {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = brushPx;
            ctx.strokeStyle = 'rgba(255, 45, 85, 0.65)';
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
            ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
            ctx.stroke();
        } else if (o.maskMode === 'eraser') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = brushPx;
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
            ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
            ctx.stroke();
        } else if (o.maskMode === 'rect') {
            maskStartPos.current = coords;
            if (!draftCanvasRef.current) draftCanvasRef.current = document.createElement('canvas');
            draftCanvasRef.current.width = c.width;
            draftCanvasRef.current.height = c.height;
            const draftCtx = draftCanvasRef.current.getContext('2d');
            if (draftCtx) {
                draftCtx.clearRect(0, 0, c.width, c.height);
                draftCtx.drawImage(c, 0, 0);
            }
        } else if (o.maskMode === 'lasso') {
            lassoPoints.current = [coords];
            if (!draftCanvasRef.current) draftCanvasRef.current = document.createElement('canvas');
            draftCanvasRef.current.width = c.width;
            draftCanvasRef.current.height = c.height;
            const draftCtx = draftCanvasRef.current.getContext('2d');
            if (draftCtx) {
                draftCtx.clearRect(0, 0, c.width, c.height);
                draftCtx.drawImage(c, 0, 0);
            }
        }
    };

    const onMaskPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingMask.current) return;
        const c = maskCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const coords = getCanvasCoords(e);

        if (o.maskMode === 'brush' || o.maskMode === 'eraser') {
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
        } else if (o.maskMode === 'rect' && maskStartPos.current && draftCanvasRef.current) {
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(draftCanvasRef.current, 0, 0);
            const start = maskStartPos.current;
            const rx = Math.min(start.x, coords.x);
            const ry = Math.min(start.y, coords.y);
            const rw = Math.abs(coords.x - start.x);
            const rh = Math.abs(coords.y - start.y);
            ctx.fillStyle = 'rgba(255, 45, 85, 0.65)';
            ctx.fillRect(rx, ry, rw, rh);
        } else if (o.maskMode === 'lasso' && draftCanvasRef.current) {
            lassoPoints.current.push(coords);
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(draftCanvasRef.current, 0, 0);
            const pts = lassoPoints.current;
            if (pts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.fillStyle = 'rgba(255, 45, 85, 0.55)';
                ctx.strokeStyle = 'rgba(255, 45, 85, 0.95)';
                ctx.lineWidth = Math.max(2, (version.width / sw) * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    };

    const onMaskPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        activeMaskPointers.current.delete(e.pointerId);
        if (!isDrawingMask.current) return;
        isDrawingMask.current = false;
        const c = maskCanvasRef.current;
        if (c) {
            const ctx = c.getContext('2d');
            if (ctx) {
                if (o.maskMode === 'brush' || o.maskMode === 'eraser') {
                    ctx.restore();
                } else if (o.maskMode === 'lasso' && draftCanvasRef.current && lassoPoints.current.length > 2) {
                    ctx.clearRect(0, 0, c.width, c.height);
                    ctx.drawImage(draftCanvasRef.current, 0, 0);
                    const pts = lassoPoints.current;
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(255, 45, 85, 0.65)';
                    ctx.fill();
                }
            }
        }
        lassoPoints.current = [];
        maskStartPos.current = null;
        try {
            if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
        commitMaskBlob();
    };

    useLayoutEffect(() => {
        const obs = new ResizeObserver(entries => {
            const r = entries[0].contentRect;
            setBox({ w: r.width - 48, h: r.height - 48 });
        });
        if (ref.current)
            obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    // Smooth mouse wheel zoom centered at cursor position
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const currentZoom = zoomRef.current;
            const currentPan = panRef.current;

            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            const nextZoom = Math.min(5, Math.max(0.15, Number((currentZoom * factor).toFixed(2))));
            if (nextZoom === currentZoom) return;

            const mouseX = e.clientX - (rect.left + rect.width / 2);
            const mouseY = e.clientY - (rect.top + rect.height / 2);

            const scaleRatio = nextZoom / currentZoom;
            const nextPanX = mouseX - (mouseX - currentPan.x) * scaleRatio;
            const nextPanY = mouseY - (mouseY - currentPan.y) * scaleRatio;

            setZoom(nextZoom);
            setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [setZoom, setPan]);

    // Spacebar detection for hand tool / panning
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
                setSpaceDown(true);
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setSpaceDown(false);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useEffect(() => {
        let alive = true;
        setPreview(undefined);
        const controller = new AbortController();
        if (['adjust', 'rotate', 'watermark', 'overlay', 'background'].includes(tool)) {
            const timer = setTimeout(() => {
                renderJob({ document: { kind: 'image', state: applyOperation(stateOf(version), tool, o) }, maxDim: 1300 }, controller.signal)
                    .then(result => result.blob)
                    .then(b => { if (alive)
                    setPreview(b); })
                    .catch(() => { });
            }, 120);
            return () => { alive = false; controller.abort(); clearTimeout(timer); };
        }
    }, [version, tool, o]);

    const isExpand = tool === 'expand' && !compare;
    const expandTargetW = o.expandWidth || 1024;
    const expandTargetH = o.expandHeight || 1024;

    let w = version.width, h = version.height;
    if (tool === 'rotate' && o.rotation % 180 !== 0) {
        w = version.height;
        h = version.width;
    }
    const displayW = isExpand ? expandTargetW : w;
    const displayH = isExpand ? expandTargetH : h;
    const scale = Math.min(Math.max(1, box.w) / displayW, Math.max(1, box.h) / displayH);
    const sw = Math.max(1, displayW * scale), sh = Math.max(1, displayH * scale);

    // Expand mode: compute inner image dimensions and positioning
    const innerScaleFactor = Math.min(1, Math.max(0.15, (o.expandScale || 80) / 100));
    const maxBoxW = expandTargetW * innerScaleFactor;
    const maxBoxH = expandTargetH * innerScaleFactor;
    const imgAspect = version.width / version.height;
    let innerImgW: number, innerImgH: number;
    if (maxBoxW / maxBoxH > imgAspect) {
        innerImgH = maxBoxH;
        innerImgW = maxBoxH * imgAspect;
    } else {
        innerImgW = maxBoxW;
        innerImgH = maxBoxW / imgAspect;
    }

    let defaultLeft = (expandTargetW - innerImgW) / 2;
    let defaultTop = (expandTargetH - innerImgH) / 2;

    switch (o.expandAlignment) {
        case 'TopLeft':
            defaultLeft = 0; defaultTop = 0; break;
        case 'Top':
            defaultLeft = (expandTargetW - innerImgW) / 2; defaultTop = 0; break;
        case 'TopRight':
            defaultLeft = expandTargetW - innerImgW; defaultTop = 0; break;
        case 'Left':
            defaultLeft = 0; defaultTop = (expandTargetH - innerImgH) / 2; break;
        case 'Right':
            defaultLeft = expandTargetW - innerImgW; defaultTop = (expandTargetH - innerImgH) / 2; break;
        case 'BottomLeft':
            defaultLeft = 0; defaultTop = expandTargetH - innerImgH; break;
        case 'Bottom':
            defaultLeft = (expandTargetW - innerImgW) / 2; defaultTop = expandTargetH - innerImgH; break;
        case 'BottomRight':
            defaultLeft = expandTargetW - innerImgW; defaultTop = expandTargetH - innerImgH; break;
        case 'Middle':
        default:
            defaultLeft = (expandTargetW - innerImgW) / 2; defaultTop = (expandTargetH - innerImgH) / 2; break;
    }

    const currentLeft = Math.max(0, Math.min(expandTargetW - innerImgW, defaultLeft + ((o.expandOffsetX || 0) / 100) * expandTargetW));
    const currentTop = Math.max(0, Math.min(expandTargetH - innerImgH, defaultTop + ((o.expandOffsetY || 0) / 100) * expandTargetH));

    const innerLeftPct = (currentLeft / expandTargetW) * 100;
    const innerTopPct = (currentTop / expandTargetH) * 100;
    const innerWidthPct = (innerImgW / expandTargetW) * 100;
    const innerHeightPct = (innerImgH / expandTargetH) * 100;

    // Interactive dragging of inner image in expand mode
    const expandDrag = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        initialOffsetX: number;
        initialOffsetY: number;
    } | null>(null);

    const onExpandPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (spaceDown) return;
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        expandDrag.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            initialOffsetX: o.expandOffsetX || 0,
            initialOffsetY: o.expandOffsetY || 0
        };
    };

    const onExpandPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!expandDrag.current || expandDrag.current.pointerId !== e.pointerId) return;
        e.stopPropagation();
        const d = expandDrag.current;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        const pctX = (dx / (sw * zoomRef.current)) * 100;
        const pctY = (dy / (sh * zoomRef.current)) * 100;
        const nextX = Math.round(Math.max(-48, Math.min(48, d.initialOffsetX + pctX)));
        const nextY = Math.round(Math.max(-48, Math.min(48, d.initialOffsetY + pctY)));
        set({ expandOffsetX: nextX, expandOffsetY: nextY });
    };

    const onExpandPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (expandDrag.current?.pointerId === e.pointerId) {
            expandDrag.current = null;
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
    };

    // Draggable floating toolbar state & handlers
    const [toolbarOffset, setToolbarOffset] = useState<{ x: number; y: number } | null>(null);
    const toolbarDrag = useRef<{ pointerId: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
    const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
    const [toolbarDockedTop, setToolbarDockedTop] = useState(false);
    const [isToolbarMinimized, setIsToolbarMinimized] = useState(false);

    const startToolbarDrag = (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button, input, select, label, .chip, a')) return;
        e.stopPropagation();

        const pointerId = e.pointerId;
        const targetEl = e.currentTarget;
        try {
            targetEl.setPointerCapture(pointerId);
        } catch {}

        const startX = e.clientX;
        const startY = e.clientY;
        const initX = toolbarOffset?.x || 0;
        const initY = toolbarOffset?.y || 0;

        toolbarDrag.current = { pointerId, startX, startY, initX, initY };
        setIsDraggingToolbar(true);

        const onGlobalMove = (ev: PointerEvent) => {
            if (!toolbarDrag.current || toolbarDrag.current.pointerId !== ev.pointerId) return;
            const dx = ev.clientX - toolbarDrag.current.startX;
            const dy = ev.clientY - toolbarDrag.current.startY;
            const stageW = ref.current?.clientWidth || window.innerWidth;
            const stageH = ref.current?.clientHeight || window.innerHeight;
            const limitX = Math.round(stageW * 0.42);
            const limitY = Math.round(stageH * 0.42);
            setToolbarOffset({
                x: Math.max(-limitX, Math.min(limitX, toolbarDrag.current.initX + dx)),
                y: Math.max(-limitY, Math.min(limitY, toolbarDrag.current.initY + dy))
            });
        };

        const onGlobalUp = (ev: PointerEvent) => {
            if (toolbarDrag.current?.pointerId === ev.pointerId) {
                try {
                    if (targetEl.hasPointerCapture(pointerId)) {
                        targetEl.releasePointerCapture(pointerId);
                    }
                } catch {}
                toolbarDrag.current = null;
                setIsDraggingToolbar(false);
                window.removeEventListener('pointermove', onGlobalMove);
                window.removeEventListener('pointerup', onGlobalUp);
                window.removeEventListener('pointercancel', onGlobalUp);
            }
        };

        window.addEventListener('pointermove', onGlobalMove, { passive: true });
        window.addEventListener('pointerup', onGlobalUp);
        window.addEventListener('pointercancel', onGlobalUp);
    };

    // Interactive corner resizing of inner image in expand mode
    const expandResizeDrag = useRef<{
        pointerId: number;
        direction: 'nw' | 'ne' | 'sw' | 'se';
        startX: number;
        startY: number;
        initialScale: number;
    } | null>(null);

    const onExpandResizeStart = (direction: 'nw' | 'ne' | 'sw' | 'se', e: ReactPointerEvent<HTMLSpanElement>) => {
        if (spaceDown) return;
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        expandResizeDrag.current = {
            pointerId: e.pointerId,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            initialScale: o.expandScale || 80
        };
    };

    const onExpandResizeMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
        if (!expandResizeDrag.current || expandResizeDrag.current.pointerId !== e.pointerId) return;
        e.stopPropagation();
        const d = expandResizeDrag.current;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        let delta = 0;
        if (d.direction === 'se') delta = (dx + dy) / 2;
        else if (d.direction === 'nw') delta = (-dx - dy) / 2;
        else if (d.direction === 'ne') delta = (dx - dy) / 2;
        else if (d.direction === 'sw') delta = (-dx + dy) / 2;

        const scaleChange = (delta / (Math.min(sw, sh) * (zoomRef.current || 1))) * 140;
        const nextScale = Math.round(Math.max(20, Math.min(100, d.initialScale + scaleChange)));
        set({ expandScale: nextScale });
    };

    const onExpandResizeEnd = (e: ReactPointerEvent<HTMLSpanElement>) => {
        if (expandResizeDrag.current?.pointerId === e.pointerId) {
            expandResizeDrag.current = null;
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
    };

    const cropDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current)
            return;
        const r = e.currentTarget.getBoundingClientRect(), d = drag.current;
        const dx = Math.round((e.clientX - d.x) / r.width * version.width);
        const dy = Math.round((e.clientY - d.y) / r.height * version.height);
        let c = { ...d.crop };
        if (d.mode === 'move') {
            c.x = Math.max(0, Math.min(version.width - c.width, c.x + dx));
            c.y = Math.max(0, Math.min(version.height - c.height, c.y + dy));
        }
        else {
            let left = c.x, right = c.x + c.width, top = c.y, bottom = c.y + c.height;
            if (d.mode.includes('w'))
                left = Math.max(0, Math.min(right - 1, left + dx));
            if (d.mode.includes('e'))
                right = Math.min(version.width, Math.max(left + 1, right + dx));
            if (d.mode.includes('n'))
                top = Math.max(0, Math.min(bottom - 1, top + dy));
            if (d.mode.includes('s'))
                bottom = Math.min(version.height, Math.max(top + 1, bottom + dy));
            c = { x: left, y: top, width: right - left, height: bottom - top };
        }
        set({ crop: c });
    };

    const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (!spaceDown && target.closest('.compare-range, .crop-handle, .crop-frame, .canvas-pan-bar, .mask-canvas-overlay, .mask-floating-toolbar, .expand-floating-toolbar, .expand-inner-wrapper')) {
            return;
        }
        if (e.button !== 0 && e.button !== 1) return;

        pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current.size === 1) {
            panStart.current = {
                pointerId: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y
            };
            setIsPanning(true);
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
        } else if (pinch.current.size === 2) {
            const a = [...pinch.current.values()];
            lastPinch.current = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            panStart.current = null;
            setIsPanning(false);
        }
    };

    const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (pinch.current.has(e.pointerId)) {
            pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pinch.current.size === 2) {
            const a = [...pinch.current.values()];
            const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            if (lastPinch.current && d > 0) {
                const ratio = d / lastPinch.current;
                setZoom(z => Math.max(0.15, Math.min(5, Number((z * ratio).toFixed(2)))));
            }
            lastPinch.current = d;
            return;
        }
        if (panStart.current && panStart.current.pointerId === e.pointerId) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            setPan({
                x: Math.round(panStart.current.startPanX + dx),
                y: Math.round(panStart.current.startPanY + dy)
            });
        }
    };

    const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        pinch.current.delete(e.pointerId);
        if (pinch.current.size < 2) lastPinch.current = 0;
        if (panStart.current?.pointerId === e.pointerId) {
            panStart.current = null;
            setIsPanning(false);
        }
        try {
            if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
    };

    const onStageDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.compare-range, input, button, .crop-handle, .crop-frame, .mask-floating-toolbar, .expand-floating-toolbar')) return;
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const activeSrc = compare ? source : (url || source);

    return (
        <div
            className={`canvas-stage ${isPanning ? 'is-panning' : ''} ${tool === 'crop' ? 'is-crop' : ''} ${spaceDown ? 'space-down' : ''}`}
            ref={ref}
            onDoubleClick={onStageDoubleClick}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
        >
            <div
                className={`image-surface checker ${isExpand ? 'is-expand-canvas' : ''}`}
                style={{
                    width: sw,
                    height: sh,
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.08s ease-out'
                }}
            >
                {isExpand ? (
                    <div className="expand-canvas-stage-box" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        {activeSrc && (
                            <img
                                src={activeSrc}
                                alt="ambient-preview"
                                className="expand-ambient-preview"
                                draggable="false"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    filter: 'blur(35px) brightness(0.92)',
                                    opacity: 0.65,
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                        <div className="expand-canvas-grid-pattern" />
                        {o.expandTop && <div className="expand-zone-indicator expand-zone-top">↑ {lang === 'id' ? 'Perluas Atas' : 'Expand Top'}</div>}
                        {o.expandBottom && <div className="expand-zone-indicator expand-zone-bottom">↓ {lang === 'id' ? 'Perluas Bawah' : 'Expand Bottom'}</div>}
                        {o.expandLeft && <div className="expand-zone-indicator expand-zone-left">← {lang === 'id' ? 'Perluas Kiri' : 'Expand Left'}</div>}
                        {o.expandRight && <div className="expand-zone-indicator expand-zone-right">→ {lang === 'id' ? 'Perluas Kanan' : 'Expand Right'}</div>}
                        <div
                            className="expand-inner-wrapper"
                            style={{
                                position: 'absolute',
                                left: `${innerLeftPct}%`,
                                top: `${innerTopPct}%`,
                                width: `${innerWidthPct}%`,
                                height: `${innerHeightPct}%`,
                                cursor: spaceDown ? 'grab' : 'move',
                                touchAction: 'none',
                                zIndex: 12
                            }}
                            onPointerDown={onExpandPointerDown}
                            onPointerMove={onExpandPointerMove}
                            onPointerUp={onExpandPointerUp}
                            onPointerCancel={onExpandPointerUp}
                        >
                            {activeSrc && (
                                <img
                                    className="expand-inner-img"
                                    src={activeSrc}
                                    alt={t.result}
                                    draggable="false"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        pointerEvents: 'none',
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.45)'
                                    }}
                                />
                            )}
                            <div className="expand-inner-border">
                                <span
                                    className="expand-drag-pill"
                                    style={{
                                        transform: `translate(-50%, 0) scale(${1 / Math.max(0.4, zoom)})`,
                                        transformOrigin: 'top center'
                                    }}
                                >
                                    <Move size={11}/> {o.expandScale || 80}%
                                </span>
                            </div>
                            <span
                                className="expand-resize-handle nw"
                                style={{ transform: `scale(${1 / Math.max(0.4, zoom)})` }}
                                onPointerDown={e => onExpandResizeStart('nw', e)}
                                onPointerMove={onExpandResizeMove}
                                onPointerUp={onExpandResizeEnd}
                                onPointerCancel={onExpandResizeEnd}
                                title={lang === 'id' ? 'Tarik sudut untuk ubah ukuran' : 'Drag corner to resize'}
                            />
                            <span
                                className="expand-resize-handle ne"
                                style={{ transform: `scale(${1 / Math.max(0.4, zoom)})` }}
                                onPointerDown={e => onExpandResizeStart('ne', e)}
                                onPointerMove={onExpandResizeMove}
                                onPointerUp={onExpandResizeEnd}
                                onPointerCancel={onExpandResizeEnd}
                                title={lang === 'id' ? 'Tarik sudut untuk ubah ukuran' : 'Drag corner to resize'}
                            />
                            <span
                                className="expand-resize-handle sw"
                                style={{ transform: `scale(${1 / Math.max(0.4, zoom)})` }}
                                onPointerDown={e => onExpandResizeStart('sw', e)}
                                onPointerMove={onExpandResizeMove}
                                onPointerUp={onExpandResizeEnd}
                                onPointerCancel={onExpandResizeEnd}
                                title={lang === 'id' ? 'Tarik sudut untuk ubah ukuran' : 'Drag corner to resize'}
                            />
                            <span
                                className="expand-resize-handle se"
                                style={{ transform: `scale(${1 / Math.max(0.4, zoom)})` }}
                                onPointerDown={e => onExpandResizeStart('se', e)}
                                onPointerMove={onExpandResizeMove}
                                onPointerUp={onExpandResizeEnd}
                                onPointerCancel={onExpandResizeEnd}
                                title={lang === 'id' ? 'Tarik sudut untuk ubah ukuran' : 'Drag corner to resize'}
                            />
                        </div>
                    </div>
                ) : (
                    activeSrc ? (<img className="working-image" src={activeSrc} alt={t.result} draggable="false"/>) : null
                )}

                {tool === 'removeobj' && !compare && (
                    <canvas
                        ref={maskCanvasRef}
                        className="mask-canvas-overlay"
                        width={version.width}
                        height={version.height}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            cursor: spaceDown ? 'grab' : o.maskMode === 'eraser' ? 'cell' : 'crosshair',
                            pointerEvents: spaceDown ? 'none' : 'auto',
                            touchAction: 'none',
                            zIndex: 10
                        }}
                        onPointerDown={onMaskPointerDown}
                        onPointerMove={onMaskPointerMove}
                        onPointerUp={onMaskPointerUp}
                        onPointerCancel={onMaskPointerUp}
                    />
                )}
                {compare && before ? (<>
                    <img className="compare-before" src={before} alt={t.source} draggable="false" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}/>
                    <div className="compare-line" style={{ left: `${split}%` }}><span><Move size={12}/></span></div>
                    <div className="compare-labels"><span>{t.original}</span><span>{t.output}</span></div>
                    <input className="compare-range" aria-label={t.compare} type="range" min={0} max={100} value={split} onChange={e => setSplit(Number(e.target.value))}/>
                </>) : null}
                {tool === 'crop' && !compare && (<div className="crop-layer" onPointerDown={e => {
                    if (spaceDown) return;
                    const mode = (e.target as HTMLElement).dataset.mode || 'move';
                    drag.current = { mode, x: e.clientX, y: e.clientY, crop: { ...o.crop } };
                    e.currentTarget.setPointerCapture(e.pointerId);
                    e.stopPropagation();
                }} onPointerMove={cropDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
                    <div className="crop-frame" data-mode="move" style={{
                        left: `${o.crop.x / version.width * 100}%`,
                        top: `${o.crop.y / version.height * 100}%`,
                        width: `${o.crop.width / version.width * 100}%`,
                        height: `${o.crop.height / version.height * 100}%`
                    }}>
                        <i className="grid-v"/><i className="grid-h"/>
                        {['nw', 'ne', 'sw', 'se'].map(d => (<button key={d} className={`crop-handle ${d}`} data-mode={d} aria-label={`Crop ${d}`}/>))}
                    </div>
                </div>)}
            </div>

            {tool === 'removeobj' && !compare && (
                <div
                    className={`mask-floating-toolbar ${isDraggingToolbar ? 'is-dragging' : ''} ${isToolbarMinimized ? 'is-minimized' : ''}`}
                    role="toolbar"
                    aria-label={lang === 'id' ? 'Alat Object Remover' : 'Object Remover Tools'}
                    onPointerDown={e => { if (!(e.target as HTMLElement).closest('button, input, select, label, .chip, a, canvas')) startToolbarDrag(e); }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: toolbarDockedTop ? 'auto' : '16px',
                        top: toolbarDockedTop ? '16px' : 'auto',
                        transform: `translate(calc(-50% + ${toolbarOffset?.x || 0}px), ${toolbarOffset?.y || 0}px)`,
                        zIndex: 35
                    }}
                >
                    <div
                        className="toolbar-drag-handle"
                        onPointerDown={startToolbarDrag}
                        title={lang === 'id' ? 'Geser posisi toolbar' : 'Drag to reposition toolbar'}
                        aria-label="Drag toolbar"
                    >
                        <GripHorizontal size={14}/>
                    </div>

                    {!isToolbarMinimized ? (<>
                        <div className="mask-mode-group">
                            <button
                                type="button"
                                className={o.maskMode === 'brush' ? 'active' : ''}
                                onClick={() => set({ maskMode: 'brush' })}
                                title="Brush (Kuas)"
                                aria-label="Brush"
                            >
                                <Paintbrush size={14}/>
                                <span>Brush</span>
                            </button>
                            <button
                                type="button"
                                className={o.maskMode === 'rect' ? 'active' : ''}
                                onClick={() => set({ maskMode: 'rect' })}
                                title="Rectangle (Kotak)"
                                aria-label="Rectangle"
                            >
                                <Square size={14}/>
                                <span>Rect</span>
                            </button>
                            <button
                                type="button"
                                className={o.maskMode === 'lasso' ? 'active' : ''}
                                onClick={() => set({ maskMode: 'lasso' })}
                                title="Lasso (Seleksi Bebas)"
                                aria-label="Lasso"
                            >
                                <Lasso size={14}/>
                                <span>Lasso</span>
                            </button>
                            <button
                                type="button"
                                className={o.maskMode === 'eraser' ? 'active' : ''}
                                onClick={() => set({ maskMode: 'eraser' })}
                                title="Eraser (Hapus Mask)"
                                aria-label="Eraser"
                            >
                                <Eraser size={14}/>
                                <span>Hapus</span>
                            </button>
                        </div>

                        {(o.maskMode === 'brush' || o.maskMode === 'eraser') && (
                            <div className="mask-size-control">
                                <span className="mask-size-val">{o.brushSize}px</span>
                                <input
                                    type="range"
                                    min={8}
                                    max={120}
                                    value={o.brushSize}
                                    onChange={e => set({ brushSize: Number(e.target.value) })}
                                    title={lang === 'id' ? `Ukuran kuas: ${o.brushSize}px` : `Brush size: ${o.brushSize}px`}
                                    aria-label="Brush size"
                                />
                            </div>
                        )}

                        <div className="mask-history-group">
                            <button
                                type="button"
                                disabled={!canUndoMask || busy}
                                onClick={handleMaskUndo}
                                title={lang === 'id' ? 'Undo goresan mask' : 'Undo mask stroke'}
                                aria-label="Undo mask stroke"
                            >
                                <Undo2 size={14}/>
                            </button>
                            <button
                                type="button"
                                disabled={!canRedoMask || busy}
                                onClick={handleMaskRedo}
                                title={lang === 'id' ? 'Redo goresan mask' : 'Redo mask stroke'}
                                aria-label="Redo mask stroke"
                            >
                                <Redo2 size={14}/>
                            </button>
                            <button
                                type="button"
                                disabled={!o.maskBlob || busy}
                                onClick={() => set({ maskBlob: null })}
                                title={lang === 'id' ? 'Bersihkan mask' : 'Clear mask'}
                                aria-label="Clear mask"
                                className="mask-clear-btn"
                            >
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </>) : (
                        <span className="minimized-label">Object Remover</span>
                    )}

                    {onApply && (
                        <button
                            type="button"
                            className="mask-apply-btn"
                            disabled={!o.maskBlob || busy}
                            onClick={onApply}
                            title={lang === 'id' ? 'Hapus objek yang ditandai' : 'Remove marked objects'}
                        >
                            {busy ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}
                            <span>{lang === 'id' ? 'Hapus' : 'Remove'}</span>
                        </button>
                    )}

                    {onOpenSettings && (
                        <button
                            type="button"
                            className="mask-settings-toggle"
                            onClick={onOpenSettings}
                            title={lang === 'id' ? 'Pengaturan' : 'Settings'}
                            aria-label="Settings"
                        >
                            <Settings2 size={14}/>
                        </button>
                    )}

                    <button
                        type="button"
                        className="toolbar-dock-btn"
                        onClick={() => setToolbarDockedTop(v => !v)}
                        title={toolbarDockedTop ? (lang === 'id' ? 'Pindah ke bawah' : 'Dock to bottom') : (lang === 'id' ? 'Pindah ke atas' : 'Dock to top')}
                    >
                        {toolbarDockedTop ? <ArrowDown size={13}/> : <ArrowUp size={13}/>}
                    </button>

                    {toolbarOffset && (
                        <button
                            type="button"
                            className="toolbar-dock-btn"
                            onClick={() => setToolbarOffset(null)}
                            title={lang === 'id' ? 'Tengahkan posisi' : 'Center position'}
                            aria-label="Reset position"
                        >
                            <RotateCcw size={12}/>
                        </button>
                    )}

                    <button
                        type="button"
                        className="toolbar-dock-btn"
                        onClick={() => setIsToolbarMinimized(v => !v)}
                        title={isToolbarMinimized ? (lang === 'id' ? 'Perluas toolbar' : 'Expand toolbar') : (lang === 'id' ? 'Perkecil toolbar' : 'Minimize toolbar')}
                    >
                        {isToolbarMinimized ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                </div>
            )}

            {tool === 'expand' && !compare && (
                <div
                    className={`expand-floating-toolbar ${isDraggingToolbar ? 'is-dragging' : ''} ${isToolbarMinimized ? 'is-minimized' : ''}`}
                    role="toolbar"
                    aria-label={lang === 'id' ? 'Alat Perluas Gambar' : 'Expand Image Tools'}
                    onPointerDown={e => { if (!(e.target as HTMLElement).closest('button, input, select, label, .chip, a, canvas')) startToolbarDrag(e); }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: toolbarDockedTop ? 'auto' : '16px',
                        top: toolbarDockedTop ? '16px' : 'auto',
                        transform: `translate(calc(-50% + ${toolbarOffset?.x || 0}px), ${toolbarOffset?.y || 0}px)`,
                        zIndex: 35
                    }}
                >
                    <div
                        className="toolbar-drag-handle"
                        onPointerDown={startToolbarDrag}
                        title={lang === 'id' ? 'Geser posisi toolbar' : 'Drag to reposition toolbar'}
                        aria-label="Drag toolbar"
                    >
                        <GripHorizontal size={14}/>
                    </div>

                    {!isToolbarMinimized ? (<>
                        <div className="expand-ratio-mini">
                            {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    className={o.expandRatio === r ? 'active' : ''}
                                    onClick={() => {
                                        const dims = r === '1:1' ? [1024, 1024] : r === '16:9' ? [1280, 720] : r === '9:16' ? [720, 1280] : r === '4:3' ? [1024, 768] : [768, 1024];
                                        set({ expandRatio: r, expandWidth: dims[0], expandHeight: dims[1], expandOffsetX: 0, expandOffsetY: 0 });
                                    }}
                                    title={`Rasio ${r}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        <div className="expand-scale-mini">
                            <span className="expand-scale-label">{o.expandScale || 80}%</span>
                            <input
                                type="range"
                                min={20}
                                max={100}
                                step={5}
                                value={o.expandScale || 80}
                                onChange={e => set({ expandScale: Number(e.target.value) })}
                                title={lang === 'id' ? `Ukuran gambar: ${o.expandScale || 80}% (Tarik sudut kanvas untuk atur langsung)` : `Image scale: ${o.expandScale || 80}% (Drag canvas corners to resize)`}
                                aria-label="Expand Scale"
                            />
                        </div>

                        {(o.expandOffsetX !== 0 || o.expandOffsetY !== 0 || o.expandAlignment !== 'Middle') && (
                            <button
                                type="button"
                                className="expand-center-btn"
                                onClick={() => set({ expandAlignment: 'Middle', expandOffsetX: 0, expandOffsetY: 0 })}
                                title={lang === 'id' ? 'Tengahkan posisi gambar' : 'Center image'}
                            >
                                <RotateCcw size={11}/>
                                <span>Tengah</span>
                            </button>
                        )}
                    </>) : (
                        <span className="minimized-label">{lang === 'id' ? 'Perluas Gambar' : 'Expand Image'}</span>
                    )}

                    {onApply && (
                        <button
                            type="button"
                            className="expand-apply-btn"
                            disabled={busy}
                            onClick={onApply}
                            title={lang === 'id' ? 'Jalankan Perluas Gambar AI' : 'Run Expand AI'}
                        >
                            {busy ? <LoaderCircle className="spin" size={14}/> : <Expand size={14}/>}
                            <span>{lang === 'id' ? 'Perluas AI' : 'Expand AI'}</span>
                        </button>
                    )}

                    {onOpenSettings && (
                        <button
                            type="button"
                            className="mask-settings-toggle"
                            onClick={onOpenSettings}
                            title={lang === 'id' ? 'Pengaturan Lengkap' : 'Full Settings'}
                            aria-label="Settings"
                        >
                            <Settings2 size={14}/>
                        </button>
                    )}

                    <button
                        type="button"
                        className="toolbar-dock-btn"
                        onClick={() => setToolbarDockedTop(v => !v)}
                        title={toolbarDockedTop ? (lang === 'id' ? 'Pindah toolbar ke bawah' : 'Dock toolbar to bottom') : (lang === 'id' ? 'Pindah toolbar ke atas' : 'Dock toolbar to top')}
                    >
                        {toolbarDockedTop ? <ArrowDown size={13}/> : <ArrowUp size={13}/>}
                    </button>

                    {toolbarOffset && (
                        <button
                            type="button"
                            className="toolbar-dock-btn"
                            onClick={() => setToolbarOffset(null)}
                            title={lang === 'id' ? 'Tengahkan posisi toolbar' : 'Center position'}
                            aria-label="Reset position"
                        >
                            <RotateCcw size={12}/>
                        </button>
                    )}

                    <button
                        type="button"
                        className="toolbar-dock-btn"
                        onClick={() => setIsToolbarMinimized(v => !v)}
                        title={isToolbarMinimized ? (lang === 'id' ? 'Perluas toolbar' : 'Expand toolbar') : (lang === 'id' ? 'Perkecil toolbar' : 'Minimize toolbar')}
                    >
                        {isToolbarMinimized ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                </div>
            )}
        </div>
    );
}
