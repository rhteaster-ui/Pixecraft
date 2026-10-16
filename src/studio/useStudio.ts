import { useState, useRef } from 'react';
import { defaults, type Tool, type Options, type Project, type Workspace } from '../types';
import { localProcess, makeVersion, validate, thumb } from '../engine';
import { aiProcess } from '../api';
import { brand, type Recipe } from './registry';
import { applyOperation, checkpoint, migrateProject, optionsFor, sourceState, stateOf } from './document';
import { renderJob } from './render';
export type StudioImage = Project & {
    status?: 'ready' | 'processing' | 'failed';
    issue?: string;
};
export function useStudio() {
    const [images, setImages] = useState<StudioImage[]>([]), [activeId, setActive] = useState(''), [selected, setSelected] = useState<string[]>([]);
    const [tool, setTool] = useState<Tool>('compress'), [options, setOptions] = useState<Options>(defaults());
    const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
    const controller = useRef<AbortController | null>(null), items = useRef(images), working = useRef(false);
    items.current = images;
    const active = images.find(i => i.id === activeId), current = active?.versions[active.active];
    const change = (patch: Partial<Options>) => setOptions(o => ({ ...o, ...patch }));
    const resetFor = (p: Project, t: Tool = tool) => setOptions(optionsFor(p.versions[p.active], t));
    const select = (id: string) => { if (working.current)
        return; const p = items.current.find(i => i.id === id); if (p) {
        setActive(id);
        resetFor(p);
        setError('');
    } };
    const chooseTool = (t: Tool) => {
        if (working.current) return;
        if (t === tool) return;
        setTool(t);
        if (active) resetFor(active, t);
        setError('');
    };
    const totalBytes = (all: Project[]) => {
        const blobs = new Set<Blob>();
        all.forEach(p => { blobs.add(p.original); p.versions.forEach(v => { blobs.add(v.blob); blobs.add(stateOf(v).source); }); });
        return [...blobs].reduce((sum, b) => sum + b.size, 0);
    };
    const ingest = async (files: File[], replace: boolean | 'active' | 'all' | 'add' = false) => {
        if (working.current)
            return;
        working.current = true;
        setBusy('Membuka gambar… / Opening images…');
        setError('');
        try {
            const isReplaceAll = replace === 'all';
            const isReplaceActive = replace === true || replace === 'active';
            const accepted: StudioImage[] = [];
            const problems: string[] = [];
            const room = isReplaceAll
                ? brand.maxFiles
                : isReplaceActive
                    ? 1
                    : brand.maxFiles - items.current.length;
            for (const file of files.slice(0, room)) {
                try {
                    await validate(file);
                    const version = await makeVersion(file, 'Original');
                    version.state = sourceState(file, version.width, version.height);
                    const p: StudioImage = { id: crypto.randomUUID(), name: file.name, created: Date.now(), updated: Date.now(), original: file, versions: [version], active: 0, thumbnail: version.thumbnail, schemaVersion: 2, status: 'ready' };
                    const baselineImages = isReplaceAll
                        ? []
                        : isReplaceActive
                            ? items.current.filter(x => x.id !== activeId)
                            : items.current;
                    if (totalBytes([...baselineImages, ...accepted, p]) > brand.maxWorkspaceBytes)
                        throw new Error('WORKSPACE_LIMIT');
                    accepted.push(p);
                }
                catch (e) {
                    problems.push(`${file.name}: ${e instanceof Error ? e.message : 'FILE_TYPE'}`);
                }
            }
            if (files.length > room)
                problems.push(`Maksimal ${brand.maxFiles} gambar / Maximum ${brand.maxFiles} images`);
            if (accepted.length) {
                const next = isReplaceAll
                    ? accepted
                    : isReplaceActive
                        ? (items.current.length ? items.current.map(p => p.id === activeId ? accepted[0] : p) : accepted)
                        : [...items.current, ...accepted];
                items.current = next;
                setImages(next);
                setActive(accepted[0].id);
                setSelected(prev => (isReplaceAll || isReplaceActive ? accepted.map(p => p.id) : [...new Set([...prev, ...accepted.map(p => p.id)])]));
                resetFor(accepted[0]);
            }
            if (problems.length)
                setError(problems.join(' · '));
        }
        finally {
            working.current = false;
            setBusy('');
        }
    };
    const clearAll = () => {
        if (working.current) return;
        items.current = [];
        setImages([]);
        setActive('');
        setSelected([]);
        setOptions(defaults());
        setError('');
        setMessage('');
    };
    const patch = (id: string, p: Partial<StudioImage>) => { items.current = items.current.map(i => i.id === id ? { ...i, ...p } : i); setImages(items.current); };
    const restore = (input: Project) => { const p = migrateProject(input); if (items.current.some(i => i.id === p.id)) {
        select(p.id);
        return;
    } if (items.current.length >= brand.maxFiles || totalBytes([...items.current, p]) > brand.maxWorkspaceBytes) {
        setError('WORKSPACE_LIMIT');
        return;
    } items.current = [...items.current, p]; setImages(items.current); setActive(p.id); setSelected([p.id]); resetFor(p); };
    const restoreWorkspace = (w: Workspace) => {
        if (working.current) return;
        const images = w.images.map(migrateProject).map(p => ({ ...p, status: 'ready' as const }));
        if (images.length > brand.maxFiles || totalBytes(images) > brand.maxWorkspaceBytes) throw new Error('WORKSPACE_LIMIT');
        items.current = images; setImages(images); setActive(w.activeId); setSelected(w.selected.filter(id => images.some(p => p.id === id)));
        const active = images.find(p => p.id === w.activeId); if (active) resetFor(active);
    };
    const version = (n: number) => { if (active && !working.current && n >= 0 && n < active.versions.length) {
        patch(active.id, { active: n });
        resetFor({ ...active, active: n });
    } };
    const remove = (id: string) => { if (working.current)
        return; const next = items.current.filter(i => i.id !== id); items.current = next; setImages(next); setSelected(s => s.filter(x => x !== id)); if (id === activeId && next[0]) {
        setActive(next[0].id);
        resetFor(next[0]);
    } else if (id === activeId) setActive(''); };
    const run = async (ids: string[], recipe?: Recipe) => {
        if (working.current || !ids.length || !active)
            return;
        working.current = true;
        setError('');
        setMessage('');
        const abort = new AbortController();
        controller.current = abort;
        const input = items.current.filter(p => ids.includes(p.id));
        let successes = 0;
        for (let index = 0; index < input.length; index++) {
            if (abort.signal.aborted)
                break;
            const p = input[index];
            patch(p.id, { status: 'processing', issue: undefined });
            try {
                const base = p.versions[p.active];
                let state = stateOf(base), meta = base;
                const steps = recipe?.steps || [{ tool, options }];
                for (let n = 0; n < steps.length; n++) {
                    const step = steps[n];
                    let opt = { ...defaults(meta.width, meta.height), ...step.options };
                    if (step.fit) {
                        const ratio = Math.min(1, step.fit / meta.width, step.fit / meta.height);
                        opt.width = Math.round(meta.width * ratio);
                        opt.height = Math.round(meta.height * ratio);
                    }
                    if (!recipe && step.tool === 'resize' && opt.lock) {
                        opt.height = Math.max(1, Math.round(opt.width * meta.height / meta.width));
                    }
                    if (!recipe && step.tool === 'crop' && current) {
                        const c = opt.crop;
                        opt.crop = { x: Math.round(c.x / current.width * meta.width), y: Math.round(c.y / current.height * meta.height), width: Math.round(c.width / current.width * meta.width), height: Math.round(c.height / current.height * meta.height) };
                    }
                    const label = `${index + 1}/${input.length} · ${p.name} · ${n + 1}/${steps.length}`;
                    setBusy(label);
                    if (step.tool === 'upscale' || step.tool === 'removebg' || step.tool === 'removewm' || step.tool === 'removeobj' || step.tool === 'expand') {
                        const raster = await renderJob({ document: { kind: 'image', state }, encodeOutput: true }, abort.signal);
                        const result = await aiProcess(raster.blob, step.tool, opt, s => setBusy(`${label} · ${s}`), abort.signal);
                        const toolLabel = step.tool === 'removebg' ? 'Background Removed' : step.tool === 'removeobj' ? 'Object Removed' : step.tool === 'expand' ? 'Expanded' : step.tool;
                        const info = await makeVersion(result, toolLabel);
                        state = checkpoint(state, result, info.width, info.height);
                        if (step.tool === 'removebg' || step.tool === 'removeobj') {
                            state.output.format = 'png';
                        }
                    } else {
                        state = applyOperation(state, step.tool, opt);
                        if (step.tool === 'compress') {
                            const check = await renderJob({ document: { kind: 'image', state }, encodeOutput: true, allowResize: opt.allowResize }, abort.signal);
                            if (check.width !== state.width || check.height !== state.height) state = applyOperation(state, 'resize', { ...opt, width: check.width, height: check.height });
                        }
                    }
                    if (abort.signal.aborted)
                        throw new DOMException('Aborted', 'AbortError');
                    meta = { ...meta, width: state.width, height: state.height };
                }
                if (abort.signal.aborted)
                    throw new DOMException('Aborted', 'AbortError');
                // Commit only a complete operation. Editing an older version creates a new branch.
                const keep = p.versions.slice(0, p.active + 1);
                if (keep.length >= 50) keep.splice(1, keep.length - 49);
                const preview = await renderJob({ document: { kind: 'image', state }, maxDim: 1300 }, abort.signal);
                const cache = await makeVersion(preview.blob, recipe?.name || tool);
                if (totalBytes(items.current) + preview.blob.size > brand.maxWorkspaceBytes)
                    throw new Error('WORKSPACE_LIMIT');
                const v = { ...cache, width: state.width, height: state.height, state, parentId: base.id, targetBytes: state.output.targetKB * 1024 || undefined };
                patch(p.id, { versions: [...keep, v], active: keep.length, thumbnail: v.thumbnail, updated: Date.now(), status: 'ready', issue: undefined });
                successes++;
            }
            catch (e) {
                const aborted = e instanceof DOMException && e.name === 'AbortError';
                patch(p.id, { status: aborted ? undefined : 'failed', issue: aborted ? undefined : e instanceof Error ? e.message : 'PROCESS_FAILED' });
            }
        }
        const a = items.current.find(p => p.id === activeId);
        if (a)
            resetFor(a);
        setBusy('');
        working.current = false;
        setMessage(`${successes}/${input.length} selesai / completed${abort.signal.aborted ? ' · dibatalkan / cancelled' : ''}`);
    };
    return { images, active, current, activeId, selected, setSelected, tool, options, change, chooseTool, select, ingest, clearAll, restore, restoreWorkspace, version, remove, run, busy, error, setError, message, setMessage, cancel: () => controller.current?.abort(), reset: () => active && resetFor(active) };
}
