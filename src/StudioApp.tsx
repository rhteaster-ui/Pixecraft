import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ImagePlus, Download, Sun, Moon, Undo2, Redo2, Check, X, Plus, Minus, Settings2, History, FolderOpen, Trash2, Workflow, ChevronDown, LoaderCircle, CheckCircle2, AlertCircle, Save, Layers, Menu, RotateCcw, Upload } from 'lucide-react';
import { copy, errors, toolInfo, type Lang } from './i18n';
import { defaults, type Tool, type Project, type Workspace } from './types';
import { bytes, download } from './engine';
import { health, type Health } from './api';
import { saveProject, listProjects, removeProject, saveWorkspace, listWorkspaces, removeWorkspace } from './storage';
import { Inspector, Stage, Modal, LocalImage } from './components/EditorParts';
import Landing, { CraftMark } from './components/Landing';
import { useStudio } from './studio/useStudio';
import { groups, icons, recipes, brand, type Recipe } from './studio/registry';
import { zipFiles } from './studio/zip';
import { stateOf } from './studio/document';
import { renderJob } from './studio/render';
import { useComposer } from './studio/useComposer';
import { createComposer } from './studio/layout';
import Composer from './components/Composer';
import About from './components/About';
const stored = (k: string, f: string) => { try {
    return localStorage.getItem(k) || f;
}
catch {
    return f;
} };
const initialHealth: Health = { ai: false, configured: false, authenticated: false, maxBytes: 3000000, maxPixels: 64000000 };
export default function StudioApp() {
    const [lang, setLang] = useState<Lang>(() => stored('pixcraft-lang', 'id') === 'en' ? 'en' : 'id'), [theme, setTheme] = useState(() => stored('pixcraft-theme', 'dark'));
    const id = lang === 'id', t = copy[lang], idx = id ? 0 : 1, s = useStudio(), tx = (a: string, b: string) => id ? a : b;
    const [screen, setScreenState] = useState(location.pathname === '/about' ? 'about' : location.pathname === '/studio' ? 'editor' : 'home'), [h, setH] = useState(initialHealth), [menu, setMenu] = useState(false), [group, setGroup] = useState('size'), [groupOpen, setGroupOpen] = useState(false), [flyoutTop, setFlyoutTop] = useState(15), [settings, setSettings] = useState(() => innerWidth >= 1100), [scope, setScope] = useState('active'), [detent, setDetent] = useState(1);
    const setScreen = (next: string) => { setScreenState(next); setMenu(false); history.pushState(null, '', next === 'about' ? '/about' : next === 'editor' ? '/studio' : '/'); };
    const comp = useComposer(), [mode, setMode] = useState<'single' | 'composer'>('single'), [composerBusy, setComposerBusy] = useState(false);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [recovery, setRecovery] = useState<Workspace>(), [recoveryChecked, setRecoveryChecked] = useState(false), [saving, setSaving] = useState('');
    const workspaceId = useRef<string>(crypto.randomUUID()), saveQueue = useRef(Promise.resolve()), [pointerX, setPointerX] = useState(24);
    const flyoutRef = useRef<HTMLDivElement>(null), railRef = useRef<HTMLElement>(null);
    const [compare, setCompare] = useState(false), [baseline, setBaseline] = useState('previous'), [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 }), [versionsOpen, setVersionsOpen] = useState(false);
    const [modal, setModal] = useState(''), [saved, setSaved] = useState<Project[]>([]), [exportScope, setExportScope] = useState('active'), [exportBusy, setExportBusy] = useState(false);
    const [sheetY, setSheetY] = useState(0), [sheetDragging, setSheetDragging] = useState(false);
    const sheetDragStart = useRef<{ startY: number; pointerId: number } | null>(null);

    const onSheetDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        sheetDragStart.current = { startY: e.clientY, pointerId: e.pointerId };
        setSheetDragging(true);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
    };

    const onSheetDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!sheetDragStart.current || sheetDragStart.current.pointerId !== e.pointerId) return;
        const dy = e.clientY - sheetDragStart.current.startY;
        if (dy > 0) {
            setSheetY(dy);
        } else {
            setSheetY(Math.max(-12, dy * 0.2));
        }
    };

    const onSheetDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!sheetDragStart.current || sheetDragStart.current.pointerId !== e.pointerId) return;
        const dy = e.clientY - sheetDragStart.current.startY;
        sheetDragStart.current = null;
        setSheetDragging(false);
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
        if (dy > 65) {
            setSheetY(450);
            setTimeout(() => {
                setSettings(false);
                setSheetY(0);
            }, 180);
        } else {
            setSheetY(0);
        }
    };
    const [custom, setCustom] = useState<Recipe[]>(() => { try {
        return JSON.parse(stored('pixcraft-recipes', '[]'));
    }
    catch {
        return [];
    } }), [draft, setDraft] = useState<Recipe>({ id: '', name: 'My workflow', description: '', steps: [] });
    const [pendingRecipe, setPendingRecipe] = useState<Recipe>(), [pendingAI, setPendingAI] = useState<{
        ids: string[];
        recipe?: Recipe;
    }>();
    const input = useRef<HTMLInputElement>(null), recipeInput = useRef<HTMLInputElement>(null), intent = useRef<'add' | 'active' | 'all'>('add');
    const c = s.current, p = s.active, isBusy = !!s.busy || exportBusy || composerBusy;
    const workspace = (): Workspace => ({ id: workspaceId.current, name: comp.current && mode === 'composer' ? comp.current.name : p?.name || 'Workspace', schemaVersion: 2, updated: Date.now(), images: s.images, activeId: s.activeId, selected: s.selected, mode, composer: comp.project });
    const recover = (w: Workspace) => { try { s.restoreWorkspace(w); comp.restore(w.composer); setMode(w.mode); workspaceId.current = w.id === 'recovery' ? crypto.randomUUID() : w.id; setRecovery(undefined); setScreen('editor'); setModal(''); } catch (e) { report(e); } };
    useEffect(() => { const cb = () => setScreenState(location.pathname === '/about' ? 'about' : location.pathname === '/studio' ? 'editor' : 'home'); window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); }, []);
    useEffect(() => { listWorkspaces().then(all => setRecovery(all.find(w => w.id === 'recovery'))).catch(() => s.setError('STORAGE_UNAVAILABLE')).finally(() => setRecoveryChecked(true)); }, []);
    useEffect(() => {
        if (!recoveryChecked || recovery || isBusy || (!s.images.length && !comp.project)) return;
        const w = { ...workspace(), id: 'recovery' };
        const timer = setTimeout(() => { setSaving(tx('Menyimpan...', 'Saving...')); saveQueue.current = saveQueue.current.then(() => saveWorkspace(w)).then(() => setSaving(tx('Tersimpan otomatis', 'Autosaved'))).catch(e => { setSaving(''); s.setError(e.message); }); }, 800);
        return () => clearTimeout(timer);
    }, [s.images, s.activeId, s.selected, comp.project, mode, isBusy, recovery, recoveryChecked]);
    useEffect(() => { if (screen !== 'editor') return; const paste = (e: ClipboardEvent) => { if (isBusy || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return; const files = Array.from(e.clipboardData?.files || []); if (files.length) { e.preventDefault(); intent.current = s.images.length === 0 ? 'all' : 'add'; onFiles(files); } }; window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste); }, [screen, isBusy, s.images]);
    useLayoutEffect(() => { if (!groupOpen) return; const position = () => { const b = railRef.current?.querySelector(`[data-group="${group}"]`)?.getBoundingClientRect(), f = flyoutRef.current?.getBoundingClientRect(); if (b && f) setPointerX(Math.max(16, Math.min(f.width - 16, b.left + b.width / 2 - f.left))); }; position(); window.addEventListener('resize', position); window.visualViewport?.addEventListener('resize', position); return () => { window.removeEventListener('resize', position); window.visualViewport?.removeEventListener('resize', position); }; }, [groupOpen, group]);
    useEffect(() => { health().then(setH); }, []);
    useEffect(() => { document.documentElement.dataset.theme = theme; try {
        localStorage.setItem('pixcraft-theme', theme);
    }
    catch { } }, [theme]);
    useEffect(() => { document.documentElement.lang = lang; try {
        localStorage.setItem('pixcraft-lang', lang);
    }
    catch { } }, [lang]);
    useEffect(() => { if (!s.message)
        return; const timer = setTimeout(() => s.setMessage(''), 5000); return () => clearTimeout(timer); }, [s.message]);
    useEffect(() => { setCompare(false); setZoom(1); setPan({ x: 0, y: 0 }); }, [s.activeId, mode]);
    useEffect(() => { const cb = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setGroupOpen(false);
        setMenu(false);
    } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isBusy && (p || mode === 'composer' && comp.project) && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (mode === 'composer' && comp.project) comp.version(comp.project.active + (e.shiftKey ? 1 : -1));
        else if (p) s.version(Math.max(0, Math.min(p.versions.length - 1, p.active + (e.shiftKey ? 1 : -1))));
    } }; window.addEventListener('keydown', cb); return () => window.removeEventListener('keydown', cb); }, [p, isBusy, mode, comp.project]);
    const errorText = (code: string) => ({ STORAGE_QUOTA: tx('Penyimpanan penuh. Pekerjaan masih ada di memori. Hapus proyek tersimpan lalu simpan kembali.', 'Storage full. Work remains in memory. Delete saved projects and save again.'), STORAGE_UNAVAILABLE: tx('Penyimpanan browser tidak tersedia. Pekerjaan belum tersimpan; ekspor sebelum menutup.', 'Browser storage unavailable. Work is not saved; export before closing.'), RENDER_MEMORY: tx('Render tidak selesai. Coba lagi atau pilih dimensi lebih kecil secara manual.', 'Render could not complete. Retry or explicitly choose smaller dimensions.'), COMPOSER_COUNT: tx('Pilih 2 hingga 5 gambar untuk Composer.', 'Select 2 to 5 images for Composer.'), TARGET_UNREACHABLE: tx('Target belum tercapai. Izinkan dimensi lebih kecil atau naikkan target KB.', 'Target could not be reached. Allow smaller dimensions or increase the KB limit.'), WORKSPACE_LIMIT: tx('Ruang kerja penuh (12 gambar / 150 MB). Hapus gambar yang tidak diperlukan.', 'Workspace full (12 images / 150 MB). Remove unused images.'), VERSION_LIMIT: tx('Batas 20 versi tercapai. Ekspor lalu buka hasil sebagai gambar baru.', '20-version limit reached. Export and reopen the result.'), AI_INPUT_LIMIT: tx('Input AI maksimum 3 MB. Kompres atau resize hasil aktif terlebih dahulu.', 'AI input is limited to 3 MB. Compress or resize the active result first.') }[code] || errors[code]?.[idx] || code);
    const report = (e: unknown) => s.setError(e instanceof Error ? e.message : 'PROCESS_FAILED');
    const askUpload = (mode: 'add' | 'active' | 'all' = 'add') => { if (isBusy)
        return; intent.current = mode; if (input.current) {
        input.current.multiple = mode === 'add' || mode === 'all';
        input.current.click();
    } };
    const choose = (tool: Tool) => { if (s.tool !== tool) s.chooseTool(tool); setGroup(groups.find(g => g.tools.includes(tool))!.id); setGroupOpen(false); if (tool === 'removeobj' && innerWidth < 1100) setSettings(false); else setSettings(true); setDetent(1); };
    const onFiles = async (files: File[]) => { if (!files.length)
        return; const uploadMode = intent.current; if (uploadMode === 'all') removeWorkspace('recovery').catch(() => {}); await s.ingest(files, uploadMode); intent.current = 'add'; setScreen('editor'); setCompare(false); setZoom(1); setPan({ x: 0, y: 0 }); if (input.current)
        input.current.value = ''; };
    const sample = async () => { try {
        const r = await fetch('/media/architecture.webp');
        if (!r.ok)
            throw new Error('PROCESS_FAILED');
        await onFiles([new File([await r.blob()], 'architecture.webp', { type: 'image/webp' })]);
    }
    catch (e) {
        report(e);
    } };
    const run = (recipe?: Recipe) => {
        if (innerWidth < 1100 && s.tool !== 'adjust') setSettings(false);
        const ids = scope === 'selected' ? s.selected : p ? [p.id] : [];
        if (!ids.length) return;
        // Hanya resep workflow multi-step yang membutuhkan popup konfirmasi
        const requiresConfirmation = !!recipe && recipe.steps.some(x => ['upscale', 'removebg'].includes(x.tool));
        if (requiresConfirmation) {
            setPendingAI({ ids, recipe });
            setModal('ai');
            return;
        }
        s.run(ids, recipe);
    };
    const save = async () => { try {
        await saveQueue.current;
        await saveWorkspace(workspace());
        s.setMessage(tx('Proyek tersimpan di perangkat ini.', 'Project saved on this device.'));
    }
    catch (e) {
        report(e);
    } };
    const openHistory = async () => { try { setSaved(await listProjects()); setWorkspaces(await listWorkspaces()); setModal('history'); } catch (e) { report(e); } };
    const remember = (next: Recipe[]) => { setCustom(next); try {
        localStorage.setItem('pixcraft-recipes', JSON.stringify(next));
    }
    catch (e) {
        report(e);
    } };
    const addStep = () => { if (draft.steps.length >= 8)
        return; const { logo, ...options } = s.options; if (s.options.overlays.some(l => l.kind === 'custom') || (s.tool === 'watermark' && s.options.watermarkMode === 'logo')) {
        s.setError(tx('Resep JSON mendukung watermark teks dan overlay bawaan. Simpan workspace untuk menyertakan logo atau overlay custom.', 'JSON recipes support text watermarks and built-in overlays. Save a workspace to include logos or custom overlays.'));
        return;
    } setDraft(d => ({ ...d, steps: [...d.steps, { tool: s.tool, options }] })); };
    const exportImages = s.images.filter(x => exportScope === 'all' || exportScope === 'selected' && s.selected.includes(x.id) || exportScope === 'active' && x.id === s.activeId), exportReady = exportImages.filter(x => x.status !== 'processing');
    const doExport = async () => { if (!exportReady.length)
        return; setExportBusy(true); try {
        const names = new Set<string>();
        const files: { name: string; blob: Blob }[] = [];
        for (const [i, x] of exportReady.entries()) {
            const v = x.versions[x.active];
            const state = stateOf(v);
            const isTransparent = v.label?.toLowerCase().includes('background') ||
                                  v.label?.toLowerCase().includes('removebg') ||
                                  v.label?.toLowerCase().includes('object') ||
                                  v.blob.type === 'image/png' ||
                                  state.output.format === 'png' ||
                                  state.source.type === 'image/png';

            let exportBlob: Blob;
            let ext = isTransparent ? 'png' : 'jpg';

            // If there are no pending edit operations, color adjustments, or overlays,
            // we can directly export the pristine state.source (the exact full-res AI output)!
            const hasOperations = state.operations && state.operations.length > 0;
            const hasStyleChanges = state.style && (state.style.brightness !== 100 || state.style.contrast !== 100 || state.style.saturation !== 100);
            const hasOverlays = state.overlays && state.overlays.length > 0;

            if (!hasOperations && !hasStyleChanges && !hasOverlays && state.source instanceof Blob) {
                exportBlob = state.source;
                ext = isTransparent ? 'png' : (state.source.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            } else {
                if (isTransparent) {
                    state.output.format = 'png';
                }
                const output = await renderJob({ document: { kind: 'image', state }, encodeOutput: true });
                exportBlob = output.blob;
                ext = isTransparent ? 'png' : output.blob.type.split('/')[1].replace('jpeg', 'jpg');
            }

            const stem = x.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_. -]/gu, '_').slice(0, 100) || `image-${i + 1}`;
            let name = `${stem}-pixcraft.${ext}`, n = 2;
            while (names.has(name)) name = `${stem}-pixcraft-${n++}.${ext}`;
            names.add(name);
            files.push({ name, blob: exportBlob });
        }
        if (exportScope === 'active')
            download(files[0].blob, files[0].name);
        else {
            const receipt = exportReady.map((x, i) => { const v = x.versions[x.active]; return { file: files[i].name, width: v.width, height: v.height, bytes: files[i].blob.size, format: files[i].blob.type, targetBytes: v.targetBytes || null, targetMet: !v.targetBytes || files[i].blob.size <= v.targetBytes, version: v.label, lastJobIssue: x.issue || null }; });
            files.push({ name: '_pixcraft-report.json', blob: new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }) });
            download(await zipFiles(files), 'pixcraft-export.zip');
        }
        setModal('');
        s.setMessage(tx('Unduhan disiapkan.', 'Download prepared.'));
    }
    catch (e) {
        report(e);
    }
    finally {
        setExportBusy(false);
    } };
    const importRecipe = async (f?: File) => { if (!f)
        return; try {
        if (f.size > 20000)
            throw new Error('INVALID_OPTIONS');
        const { parseRecipe } = await import('./studio/recipeValidation');
        const r = parseRecipe(JSON.parse(await f.text()));
        setDraft({ ...r, id: crypto.randomUUID(), name: r.name.slice(0, 60) });
    }
    catch (e) {
        report(e);
    } if (recipeInput.current)
        recipeInput.current.value = ''; };
    const studioOpen = screen === 'editor', showing = studioOpen && mode === 'single' && p && c, activeGroup = groups.find(g => g.id === group)!;
    const makeComposer = () => { try { const state = createComposer(s.images.filter(p => s.selected.includes(p.id))); comp.restore({ versions: [state], active: 0 }); setMode('composer'); setModal(''); } catch (e) { report(e); } };
    const exportComposer = async () => { if (!comp.current) return; setExportBusy(true); try { const result = await renderJob({ document: { kind: 'composer', state: comp.current }, encodeOutput: true }); download(result.blob, `pixcraft-composition.${comp.current.output.format === 'jpeg' ? 'jpg' : comp.current.output.format}`); setModal(''); } catch (e) { report(e); } finally { setExportBusy(false); } };
    const historyIndex = mode === 'composer' ? comp.project?.active || 0 : p?.active || 0, historyLength = mode === 'composer' ? comp.project?.versions.length || 0 : p?.versions.length || 0;
    const changeVersion = (n: number) => mode === 'composer' ? comp.version(n) : s.version(n);
    return <div className={studioOpen ? 'app editing studio-v2' : 'app'}>
  <input className="hidden-input" aria-label="Upload images" ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e => onFiles(Array.from(e.target.files || []))}/><input hidden ref={recipeInput} type="file" accept="application/json" onChange={e => importRecipe(e.target.files?.[0])}/>
  <header className="topbar">
    <button className="wordmark" aria-label="Pixcraft home" onClick={() => !isBusy && setScreen('home')}><CraftMark />{brand.name}<span>.</span></button>
    {studioOpen ? (
      <>
        <div className="segmented studio-mode-switch">
          <button disabled={isBusy} className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>{tx('Gambar', 'Images')}</button>
          <button disabled={isBusy} className={mode === 'composer' ? 'active' : ''} onClick={() => comp.current ? setMode('composer') : setModal('composer-start')}>Composer</button>
        </div>
        {mode === 'composer' && <button className="icon-button" aria-label="New composition" title={tx('Komposisi baru', 'New composition')} disabled={isBusy} onClick={() => setModal('composer-start')}><Plus size={16}/></button>}
        <div className="file-title"><span>{mode === 'composer' ? comp.current?.name : p?.name || 'Studio'}</span><small>{s.images.length} {tx('gambar', 'images')}</small></div>
        <div className="header-history-controls">
          <button className="icon-button" title="Undo" aria-label="Undo" disabled={isBusy || historyIndex === 0} onClick={() => changeVersion(historyIndex - 1)}><Undo2 size={17}/></button>
          <button className="icon-button" title="Redo" aria-label="Redo" disabled={isBusy || historyIndex >= historyLength - 1} onClick={() => changeVersion(historyIndex + 1)}><Redo2 size={17}/></button>
          {saving && <span className="autosave-status">{saving}</span>}
        </div>
        <div className="header-actions">
          <button className="icon-button" title={tx('Proyek tersimpan', 'Saved projects')} aria-label="Saved projects" onClick={openHistory}><FolderOpen size={16}/></button>
          <button className="lang-button" onClick={() => setLang(id ? 'en' : 'id')} aria-label="Switch language">{lang.toUpperCase()}</button>
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="secondary compact-header-btn replace-btn" title={tx('Ganti gambar / buka file baru', 'Replace / open new file')} onClick={() => setModal('replace')} disabled={isBusy}><Upload size={14}/><span>{tx('Ganti file', 'Replace')}</span></button>
          <button className="secondary desktop-save compact-header-btn" onClick={save} disabled={isBusy || !historyLength}><Save size={15}/><span>{tx('Simpan', 'Save')}</span></button>
          <button className="primary compact-header-btn export-btn" disabled={isBusy || !historyLength} onClick={() => { setExportScope('active'); setModal(mode === 'composer' ? 'composer-export' : 'export'); }}><Download size={15}/><span>{tx('Ekspor', 'Export')}</span></button>
        </div>
      </>
    ) : (
      <><nav className={menu ? 'site-nav open' : 'site-nav'}><a href="/#tools" onClick={() => { setScreen('home'); setMenu(false); }}>{tx('Alat', 'Tools')}</a><a href="/#workflow" onClick={() => { setScreen('home'); setMenu(false); }}>{tx('Alur kerja', 'Workflow')}</a><button onClick={openHistory}>{tx('Tersimpan', 'Saved')}</button><a href="/about" onClick={e => { e.preventDefault(); setScreen('about'); }}>About</a><button onClick={() => setScreen('editor')}>{tx('Masuk Studio', 'Open Studio')}<ArrowUpRight size={14}/></button></nav><div className="header-actions"><button className="lang-button" onClick={() => setLang(id ? 'en' : 'id')} aria-label="Switch language">{lang.toUpperCase()}</button><button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-button mobile-menu-button" aria-label="Menu" onClick={() => setMenu(!menu)}><Menu size={20}/></button></div></>
    )}
  </header>
  {s.error && <div role="alert" className="error-banner"><AlertCircle size={17}/><span>{errorText(s.error)}</span><button className="icon-button" aria-label="Close error" onClick={() => s.setError('')}><X size={17}/></button></div>}
  {recovery && <div className="recovery-banner" role="status"><History size={16}/><span>{tx('Sesi sebelumnya tersedia.', 'Previous workspace available.')}</span><button onClick={() => recover(recovery)}>{tx('Pulihkan', 'Recover')}</button><button onClick={() => { setRecovery(undefined); removeWorkspace('recovery').catch(report); s.clearAll(); }}>{tx('Hapus sesi lama', 'Discard old session')}</button><button aria-label="Dismiss recovery" onClick={() => { setRecovery(undefined); removeWorkspace('recovery').catch(report); }}><X size={15}/></button></div>}
  {screen === 'home' && <Landing lang={lang} upload={() => setScreen('editor')} choose={tool => { choose(tool); setMode('single'); setScreen('editor'); }} sample={sample} preset={r => { setPendingRecipe(recipes.find(x => x.id === r)); setScreen('editor'); }} about={() => setScreen('about')} composer={() => { setScreen('editor'); if (s.images.length >= 2) setModal('composer-start'); }}/ >}
  {screen === 'about' && <About lang={lang} enter={() => setScreen('editor')}/>}
  {studioOpen && mode === 'single' && !p && <main className="empty-studio" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); intent.current = 'all'; onFiles(Array.from(e.dataTransfer.files)); }}><div className="empty-studio-mark"><CraftMark/></div><span className="overline">STUDIO / {toolInfo[s.tool].name[idx]}</span><h1>{tx('Ruang untuk gambarmu.', 'Space for your images.')}</h1><p>{tx('JPG, PNG, WebP · Maks. 12 gambar · 50 MB per file', 'JPG, PNG, WebP · Up to 12 images · 50 MB per file')}</p><button className="primary" onClick={() => askUpload('all')}><ImagePlus size={18}/>{tx('Pilih gambar baru', 'Select new image')}</button><button className="secondary" onClick={openHistory}><FolderOpen size={16}/>{tx('Buka tersimpan', 'Open saved')}</button><small>{tx('Tarik file ke sini atau tempel gambar dari clipboard.', 'Drop files here or paste an image from the clipboard.')}</small></main>}
  {studioOpen && mode === 'composer' && comp.current && <Composer state={comp.current} images={s.images} change={comp.change} commit={comp.commit} lang={lang} health={h} onBusy={setComposerBusy} error={s.setError} importImages={() => askUpload()}/>}
  {showing && <main className={`studio-shell ${settings ? 'settings-open' : ''}`}>
   <nav ref={railRef} className="studio-rail" aria-label={tx('Kelompok alat', 'Tool groups')}><button aria-label="Back" onClick={() => setScreen('home')} disabled={isBusy}><ArrowLeft size={19}/><span>{tx('Beranda', 'Home')}</span></button><div className="rail-divider"/>{groups.map(g => <button data-group={g.id} key={g.id} aria-expanded={groupOpen && group === g.id} className={g.tools.includes(s.tool) ? 'active' : ''} disabled={isBusy} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const shell = e.currentTarget.closest('.studio-shell')?.getBoundingClientRect(); if (shell) { const topRel = rect.top - shell.top; setFlyoutTop(Math.max(10, Math.min(topRel - 12, Math.max(12, shell.height - 280)))); } setGroup(g.id); setGroupOpen(!(groupOpen && group === g.id)); }}><g.icon size={20}/><span>{g.name[idx]}</span></button>)}<button onClick={() => setModal('recipes')} disabled={isBusy}><Workflow size={20}/><span>{tx('Resep', 'Recipes')}</span></button><button onClick={openHistory} disabled={isBusy}><FolderOpen size={20}/><span>{tx('Tersimpan', 'Saved')}</span></button></nav>
   {groupOpen && (
     <>
       <button className="tools-dismiss" aria-label="Close tools" onClick={() => setGroupOpen(false)}/>
       <div ref={flyoutRef} className="tool-flyout" style={{ ...(innerWidth >= 768 ? { top: `${flyoutTop}px` } : {}), '--pointer-x': `${pointerX}px` } as CSSProperties}>
         <div className="flyout-drag-handle" onClick={() => setGroupOpen(false)} title={tx('Tutup panel', 'Close panel')}>
           <span className="flyout-grab-pill" />
         </div>
         <div className="flyout-header">
           <div className="flyout-title-wrap">
             <span className="overline">{activeGroup.name[idx]}</span>
             <span className="flyout-count">{activeGroup.tools.length} {tx('alat', 'tools')}</span>
           </div>
           <button className="icon-button flyout-close-btn" aria-label="Close tools panel" onClick={() => setGroupOpen(false)}>
             <X size={16}/>
           </button>
         </div>
         <div className="flyout-tools-list">
           {activeGroup.tools.map(k => {
             const Icon = icons[k];
             return (
               <button
                 key={k}
                 className={`flyout-tool-item ${s.tool === k ? 'active' : ''}`}
                 onClick={() => choose(k)}
               >
                 <span className="flyout-tool-icon"><Icon size={18}/></span>
                 <span className="flyout-tool-info">
                   <strong>{toolInfo[k].name[idx]}</strong>
                   <small>{toolInfo[k].description[idx]}</small>
                 </span>
                 <ArrowRight size={15} className="flyout-tool-arrow"/>
               </button>
             );
           })}
         </div>
       </div>
     </>
   )}
   <section className="studio-center">
     <div className="studio-toolbar"><button className={`secondary compare-button ${compare ? 'selected' : ''}`} disabled={isBusy || p.active === 0} onClick={() => setCompare(!compare)}><Layers size={15}/>{tx('Bandingkan', 'Compare')}</button>{compare && <select aria-label="Comparison source" value={baseline} onChange={e => setBaseline(e.target.value)}><option value="previous">{tx('Langkah sebelumnya', 'Previous step')}</option><option value="original">{tx('Gambar asli', 'Original image')}</option></select>}<span className="version-indicator">{p.active === 0 ? tx('Asli', 'Original') : c.label}</span><div className="zoom-control"><button className="icon-button" aria-label="Zoom out" title={tx('Perkecil zoom', 'Zoom out')} onClick={() => setZoom(z => Math.max(.15, Number((z - .25).toFixed(2))))}><Minus size={16}/></button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title={tx('Fit / Reset zoom & posisi', 'Fit / Reset zoom & pan')}>{zoom === 1 && pan.x === 0 && pan.y === 0 ? 'Fit' : `${Math.round(zoom * 100)}%`}</button><button className="icon-button" aria-label="Zoom in" title={tx('Perbesar zoom', 'Zoom in')} onClick={() => setZoom(z => Math.min(5, Number((z + .25).toFixed(2))))}><Plus size={16}/></button>{(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && <button className="icon-button" aria-label="Reset pan & zoom" title={tx('Tengahkan & reset zoom', 'Center & reset zoom')} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw size={14}/></button>}</div><button className={`icon-button settings-toggle ${settings ? 'selected' : ''}`} aria-label="Toggle settings" onClick={() => setSettings(!settings)}><Settings2 size={18}/></button></div>
    {pendingRecipe && <div className="recipe-notice"><Workflow size={17}/><span>{pendingRecipe.name}<small>{pendingRecipe.description}</small></span><button className="secondary" disabled={isBusy} onClick={() => run(pendingRecipe)}>{tx('Jalankan', 'Run')}</button><button className="icon-button" aria-label="Close recipe" onClick={() => setPendingRecipe(undefined)}><X size={16}/></button></div>}
    <Stage version={c} original={baseline === 'original' ? p.original : p.versions.find(v => v.id === c.parentId)?.blob || p.versions[Math.max(0, p.active - 1)].blob} tool={s.tool} o={s.options} set={s.change} compare={compare} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} busy={isBusy} onApply={() => run()} lang={lang} onOpenSettings={() => setSettings(true)} t={{ ...t, original: baseline === 'original' ? tx('Asli', 'Original') : tx('Sebelum', 'Before') }}/>
    {p.issue && <div className="image-issue" role="status"><AlertCircle size={15}/>{errorText(p.issue)}</div>}
    <div className="canvas-meta"><span>{c.width} × {c.height}<i />{tx('Pratinjau', 'Preview')} {bytes(c.blob.size)}<i />{stateOf(c).output.format.toUpperCase()}{c.targetBytes && <b>Target ≤ {bytes(c.targetBytes)}</b>}</span><button disabled={isBusy || p.active === 0} onClick={() => s.version(0)} title={tx('Pulihkan sumber asli', 'Restore original')}>Reset</button><button onClick={() => setVersionsOpen(!versionsOpen)}><History size={15}/>{tx('Riwayat', 'History')} ({p.versions.length})<ChevronDown size={13}/></button></div>
    {versionsOpen && <div className="version-filmstrip">{p.versions.map((v, n) => <button key={v.id} disabled={isBusy} className={p.active === n ? 'active' : ''} onClick={() => s.version(n)}><LocalImage blob={v.thumbnail || v.blob} alt={v.label}/><span>{n === 0 ? tx('Asli', 'Original') : `${n} · ${v.label}`}</span></button>)}</div>}
    <section className="image-tray">
      <div className="tray-heading">
        <div className="tray-heading-left">
          <span>{tx('KOLEKSI', 'COLLECTION')} <b>{s.images.length.toString().padStart(2, '0')}</b></span>
          {s.images.length > 1 && (
            <button
              type="button"
              className="tray-text-link"
              disabled={isBusy}
              onClick={() => s.setSelected(s.selected.length === s.images.length ? [] : s.images.map(p => p.id))}
            >
              {s.selected.length === s.images.length ? tx('Batal pilih', 'Deselect') : tx('Pilih semua', 'Select all')}
            </button>
          )}
        </div>
        <div className="tray-actions">
          <button
            type="button"
            className="tray-action-btn"
            disabled={isBusy}
            onClick={() => askUpload('add')}
            title={tx('Tambah gambar baru ke koleksi', 'Add image')}
          >
            <Plus size={13}/>
            <span>{tx('Tambah', 'Add')}</span>
          </button>
          <button
            type="button"
            className="tray-action-btn"
            disabled={isBusy}
            onClick={() => setModal('replace')}
            title={tx('Ganti gambar aktif atau buka file baru', 'Replace active or open new')}
          >
            <Upload size={13}/>
            <span>{tx('Ganti...', 'Replace...')}</span>
          </button>
          {s.images.length > 0 && (
            <button
              type="button"
              className="tray-action-btn danger-hover"
              disabled={isBusy}
              title={tx('Kosongkan semua file dari sesi ini', 'Clear all files from session')}
              onClick={() => {
                if (confirm(tx('Hapus semua file lama dari sesi ini?', 'Delete all old files from this session?'))) {
                  s.clearAll();
                  removeWorkspace('recovery').catch(report);
                  setCompare(false);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }
              }}
            >
              <Trash2 size={13}/>
              <span>{tx('Bersihkan', 'Clear')}</span>
            </button>
          )}
        </div>
      </div>
      <div className="thumbnail-list">{s.images.map(x => <div className={`thumbnail-card ${x.id === s.activeId ? 'active' : ''}`} key={x.id}><button className="thumbnail-preview" disabled={isBusy} onClick={() => s.select(x.id)} aria-label={`Preview ${x.name}`}><LocalImage blob={x.versions[x.active].thumbnail} alt={x.name}/><span>{x.name}</span></button><button type="button" className={`thumb-check-btn ${s.selected.includes(x.id) ? 'checked' : ''}`} disabled={isBusy} onClick={e => { e.stopPropagation(); s.setSelected(s.selected.includes(x.id) ? s.selected.filter(v => v !== x.id) : [...new Set([...s.selected, x.id])]); }} aria-label={`Select ${x.name}`} title={tx('Pilih / Batal pilih gambar', 'Select / Deselect image')}><span className="thumb-check-mark"/></button><span className={`thumb-status ${x.status || ''}`}>{x.status === 'processing' ? <LoaderCircle className="spin" size={13}/> : x.status === 'failed' ? <AlertCircle size={13}/> : x.active > 0 ? <Check size={13}/> : null}</span><button className="thumb-remove" aria-label={`Remove ${x.name}`} disabled={isBusy} onClick={() => { if (confirm(tx('Hapus gambar dan riwayat yang belum disimpan dari sesi ini?', 'Remove this image and its unsaved history from this session?')))
            s.remove(x.id); }}><X size={12}/></button></div>)}<button className="add-thumbnail" aria-label="Add images" onClick={() => askUpload()} disabled={isBusy}><ImagePlus size={22}/><span>{tx('Tambah', 'Add')}</span></button></div></section>
    <div className="editor-credit">© {new Date().getFullYear()} · Credit by <a href="https://rhmt.biz.id" target="_blank" rel="noopener noreferrer">{brand.credit}</a><button onClick={save} disabled={isBusy}>{tx('Simpan proyek', 'Save project')}</button></div>
    {s.busy && <div className="job-progress" role="status"><LoaderCircle className="spin" size={22}/><strong>{s.busy}</strong><span>{tx('Setiap gambar diproses berurutan.', 'Images are processed sequentially.')}</span><button className="secondary" onClick={s.cancel}>{tx('Batalkan', 'Cancel')}</button></div>}
   </section>
   {settings && <div className={`settings-wrap ${sheetDragging ? 'is-dragging' : ''}`} style={sheetY !== 0 ? { transform: `translateY(${sheetY}px)`, transition: sheetDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)' } : undefined}><div className="sheet-drag-handle" onPointerDown={onSheetDragDown} onPointerMove={onSheetDragMove} onPointerUp={onSheetDragEnd} onPointerCancel={onSheetDragEnd}><span className="sheet-grab-pill" /></div><div className="settings-top" onPointerDown={onSheetDragDown} onPointerMove={onSheetDragMove} onPointerUp={onSheetDragEnd} onPointerCancel={onSheetDragEnd}><span>IMAGE SETTINGS</span><button className="icon-button" aria-label="Close settings" onClick={() => setSettings(false)}><X size={16}/></button></div><Inspector tool={s.tool} o={s.options} set={s.change} t={t} lang={lang} version={c} health={h} busy={isBusy} onApply={() => run()} onReset={s.reset} detent={detent} setDetent={setDetent} scope={scope} onScope={setScope} selectedCount={s.selected.length}/></div>}
  </main>}
  {modal === 'export' && <Modal title={tx('Ekspor gambar', 'Export images')} onClose={() => !exportBusy && setModal('')}><span className="overline">FINISH & DELIVER</span><h2>{tx('Siap dibawa keluar.', 'Ready to go.')}</h2><p>{tx('Ekspor memakai versi yang sudah diterapkan pada setiap gambar.', 'Export uses the applied version of each image.')}</p><div className="export-options">{[['active', tx('Gambar aktif', 'Active image')], ['selected', `${tx('Gambar terpilih', 'Selected images')} · ZIP`], ['all', `${tx('Semua gambar', 'All images')} · ZIP`]].map(([v, label]) => <label key={v}><input type="radio" name="exportScope" value={v} checked={exportScope === v} disabled={exportBusy} onChange={() => setExportScope(v)}/><span>{label}</span><strong>{v === 'active' ? 1 : v === 'all' ? s.images.length : s.selected.length}</strong></label>)}</div>{exportImages.some(x => x.issue) && <p role="status">{tx('Proses terakhir gagal pada sebagian gambar. Yang diekspor adalah hasil valid terakhirnya.', 'The latest job failed for some images. Their last valid results will be exported.')}</p>}<div className="export-review">{s.images.map(x => { const isSelected = s.selected.includes(x.id); const isIncluded = exportScope === 'all' || (exportScope === 'selected' && isSelected) || (exportScope === 'active' && x.id === s.activeId); const v = x.versions[x.active]; return <div key={x.id} className={`export-review-item ${isIncluded ? 'active' : ''}`} onClick={() => { if (exportBusy) return; if (exportScope === 'active') { s.select(x.id); } else { s.setSelected(isSelected ? s.selected.filter(id => id !== x.id) : [...s.selected, x.id]); if (exportScope !== 'selected') setExportScope('selected'); } }} style={{ cursor: 'pointer', opacity: isIncluded ? 1 : 0.45 }}><input type="checkbox" checked={exportScope === 'all' || (exportScope === 'active' ? x.id === s.activeId : isSelected)} disabled={exportBusy} onChange={e => { e.stopPropagation(); s.setSelected(e.target.checked ? [...new Set([...s.selected, x.id])] : s.selected.filter(id => id !== x.id)); if (exportScope !== 'selected') setExportScope('selected'); }} style={{ width: '16px', height: '16px', marginRight: '8px', cursor: 'pointer', accentColor: 'var(--accent)' }}/><LocalImage blob={v.thumbnail} alt=""/><span>{x.name}<small>{v.width} × {v.height} · {stateOf(v).output.format.toUpperCase()}{x.active === 0 ? ' · Original' : ''}</small></span>{x.status === 'failed' ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}</div>; })}</div>{exportImages.length !== exportReady.length && <p>{tx('Gambar yang masih diproses belum disertakan.', 'Images still processing are not included.')}</p>}<div className="export-total"><span>{exportReady.length} {tx('file siap', 'files ready')}</span><strong>{tx('Ukuran akhir dihitung saat ekspor', 'Final size calculated at export')}</strong></div><button className="primary" disabled={!exportReady.length || exportBusy} onClick={doExport}>{exportBusy ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>}{exportScope === 'active' ? tx('Unduh gambar', 'Download image') : tx('Unduh ZIP', 'Download ZIP')}</button></Modal>}
  {modal === 'replace' && <Modal title={tx('Ganti file', 'Replace files')} onClose={() => setModal('')}><h2>{tx('Ganti file di ruang kerja?', 'Replace files in workspace?')}</h2><p>{tx('Pilih apakah ingin menghapus semua file lama atau hanya mengganti gambar yang sedang aktif.', 'Choose whether to delete all old files and open new, or replace only the active image.')}</p><div className="modal-choice-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}><button className="primary" onClick={() => { setModal(''); askUpload('all'); }}><Trash2 size={16}/>{tx('Hapus file lama & ganti ke file baru', 'Delete old files & replace with new')}</button><button className="secondary" onClick={() => { setModal(''); askUpload('active'); }}>{tx('Pilih pengganti', 'Choose replacement')}</button></div></Modal>}
  {modal === 'composer-start' && <Modal title="Create Composer" onClose={() => setModal('')}><span className="overline">COMPOSER / NEW DOCUMENT</span><h2>{tx('Beberapa gambar. Satu komposisi.', 'Multiple images. One composition.')}</h2><p>{tx('Pilih 2–5 gambar. Koleksi aslinya tetap terpisah.', 'Choose 2–5 images. The original collection stays independent.')}{comp.current && tx(' Komposisi aktif akan diganti; simpan dulu bila ingin mempertahankannya.', ' The current composition will be replaced; save first to keep it.')}</p><div className="composer-picker">{s.images.map(p => <label key={p.id}><input type="checkbox" checked={s.selected.includes(p.id)} onChange={e => s.setSelected(e.target.checked ? [...s.selected, p.id] : s.selected.filter(id => id !== p.id))}/><LocalImage blob={p.thumbnail} alt=""/><span>{p.name}</span></label>)}</div><div className="style-actions"><button className="secondary" onClick={() => askUpload()}><ImagePlus size={16}/>{tx('Tambah gambar', 'Add images')}</button><button className="primary" disabled={s.selected.length < 2 || s.selected.length > 5} onClick={makeComposer}>{tx('Buat komposisi', 'Create composition')} ({s.selected.length})</button></div></Modal>}
  {modal === 'composer-export' && comp.current && <Modal title="Export composition" onClose={() => !exportBusy && setModal('')}><span className="overline">COMPOSER / EXPORT</span><h2>{tx('Satu kanvas. Hasil utuh.', 'One canvas. Complete result.')}</h2><p>{comp.current.width} × {comp.current.height} px · {comp.current.output.format.toUpperCase()} · {comp.current.output.format === 'jpeg' ? tx('Latar transparan menjadi putih', 'Transparent background becomes white') : comp.current.background}</p><p>{tx('Tidak ada resize, kompresi target, atau HD tambahan saat ekspor.', 'No extra resize, target compression or HD is applied during export.')}</p><button className="primary" disabled={exportBusy} onClick={exportComposer}>{exportBusy ? <LoaderCircle className="spin" size={16}/> : <Download size={16}/>} {tx('Unduh komposisi', 'Download composition')}</button></Modal>}
  {modal === 'ai' && pendingAI && <Modal title="Run AI" onClose={() => setModal('')}><span className="overline">AI STUDIO</span><h2>{tx('Jalankan peningkatan HD / AI?', 'Run HD / AI enhancement?')}</h2><p>{pendingAI.ids.length} {tx('gambar aktif/terpilih akan dikirim untuk diproses hanya setelah konfirmasi ini.', 'active/selected images will be sent for processing only after this confirmation.')}</p>{!h.hasKeys && <p>{tx('Tanpa kunci iLoveAPI: mesin dasar berjalan di server, bukan AI. HD menggunakan interpolasi; Hapus BG cocok untuk latar sederhana.', 'Without iLoveAPI keys: a basic server engine, not AI. HD uses interpolation; background isolation suits simple backgrounds.')}</p>}<button className="primary" onClick={() => { setModal(''); s.run(pendingAI.ids, pendingAI.recipe); }}>{tx('Proses gambar', 'Process images')}</button></Modal>}
  {modal === 'history' && <Modal title="Saved projects" onClose={() => setModal('')}><span className="overline">ON THIS DEVICE</span><h2>{tx('Ruang untuk kembali.', 'Pick up where you left off.')}</h2><p>{tx('Proyek disimpan di browser ini. Membersihkan penyimpanan browser akan menghapusnya.', 'Projects are stored in this browser. Clearing browser storage removes them.')}</p>{!saved.length && !workspaces.length && <p>{tx('Belum ada proyek tersimpan.', 'No saved projects yet.')}</p>}<div className="saved-list">{workspaces.map(w => <div key={w.id}><button onClick={() => recover(w)}><FolderOpen size={22}/><span>{w.id === 'recovery' ? tx('Pemulihan sesi', 'Session recovery') : w.name}<small>{w.images.length} {tx('gambar', 'images')} · {w.composer ? 'Composer + ' : ''}Studio</small></span></button><button className="icon-button" aria-label={`Delete workspace ${w.name}`} onClick={async () => { try { await removeWorkspace(w.id); setWorkspaces(await listWorkspaces()); if (w.id === 'recovery') setRecovery(undefined); } catch (e) { report(e); } }}><Trash2 size={17}/></button></div>)}{saved.map(x => <div key={x.id}><button onClick={() => { s.restore(x); setMode('single'); setScreen('editor'); setModal(''); }}><LocalImage blob={x.thumbnail} alt=""/><span>{x.name}<small>{x.versions.length} {tx('versi', 'versions')}</small></span></button><button className="icon-button" aria-label={`Delete saved ${x.name}`} onClick={async () => { await removeProject(x.id); setSaved(await listProjects()); }}><Trash2 size={17}/></button></div>)}</div></Modal>}
  {modal === 'recipes' && <Modal title="Workflows" onClose={() => setModal('')}><span className="overline">YOUR REPEATABLE WORKFLOW</span><h2>{tx('Simpan langkahmu.', 'Save your steps.')}</h2><div className="recipe-list">{[...recipes, ...custom].map(r => <div key={r.id}><button onClick={() => { setPendingRecipe(r); setModal(''); }}><Workflow size={18}/><span>{r.name}<small>{r.description || `${r.steps.length} steps`}</small></span><ArrowRight size={16}/></button><button className="icon-button" aria-label={`Edit recipe ${r.name}`} onClick={() => setDraft({ ...r, id: crypto.randomUUID() })}><Settings2 size={16}/></button>{custom.includes(r) && <button className="icon-button" aria-label={`Delete recipe ${r.name}`} onClick={() => remember(custom.filter(v => v.id !== r.id))}><Trash2 size={15}/></button>}</div>)}</div><div className="recipe-builder"><h3>{tx('Rakit resep sendiri', 'Build your own recipe')}</h3><label className="field">{tx('Nama resep', 'Recipe name')}<input maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><ol>{draft.steps.map((step, n) => <li key={n}><span>{toolInfo[step.tool].name[idx]}<small>{step.fit ? `Fit ${step.fit}px` : step.options.targetKB ? `≤ ${step.options.targetKB} KB` : step.options.format || ''}</small></span><button aria-label={`Move step ${n + 1} up`} disabled={n === 0} onClick={() => setDraft(d => { const steps = [...d.steps]; [steps[n - 1], steps[n]] = [steps[n], steps[n - 1]]; return { ...d, steps }; })}>↑</button><button aria-label={`Remove step ${n + 1}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== n) })}><X size={14}/></button></li>)}</ol><p>{tx('Atur alat di editor, lalu tambahkan pengaturannya ke resep. Maksimal 8 langkah.', 'Configure a tool in the editor, then add its settings here. Up to 8 steps.')}</p><button className="secondary" disabled={draft.steps.length >= 8} onClick={addStep}><Plus size={15}/>{tx('Tambahkan', 'Add')} {toolInfo[s.tool].name[idx]}</button><div className="recipe-actions"><button className="primary" disabled={!draft.steps.length || !draft.name.trim() || custom.length >= 20} onClick={() => { remember([...custom, { ...draft, id: crypto.randomUUID() }]); s.setMessage(tx('Resep tersimpan.', 'Recipe saved.')); setDraft({ id: '', name: 'My workflow', description: '', steps: [] }); }}>{tx('Simpan resep', 'Save recipe')}</button><button className="secondary" disabled={!draft.steps.length} onClick={() => download(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }), 'pixcraft-recipe.json')}>JSON ↓</button><button className="secondary" onClick={() => recipeInput.current?.click()}>JSON ↑</button></div></div></Modal>}
  {s.message && <div className="toast" role="status"><Check size={17}/><span>{s.message}</span><button className="icon-button" aria-label="Close notification" onClick={() => s.setMessage('')}><X size={15}/></button></div>}
 </div>;
}
