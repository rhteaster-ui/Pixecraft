import { useRef, useState } from 'react';
import type { ComposerProject, ComposerState } from '../types';
export function useComposer() {
    const [project, setProject] = useState<ComposerProject>();
    const [draft, setDraft] = useState<ComposerState>();
    const draftRef = useRef<ComposerState | undefined>(undefined);
    const change = (state: ComposerState) => { draftRef.current = state; setDraft(state); };
    const commit = (state = draftRef.current) => {
        if (!state) return;
        setProject(p => {
            if (p?.versions[p.active] === state) return p;
            const versions = p ? p.versions.slice(0, p.active + 1) : [];
            if (versions.length >= 50) versions.splice(1, versions.length - 49);
            return { versions: [...versions, state], active: versions.length };
        });
        draftRef.current = undefined; setDraft(undefined);
    };
    const restore = (value?: ComposerProject) => { draftRef.current = undefined; setDraft(undefined); setProject(value); };
    const version = (n: number) => { draftRef.current = undefined; setDraft(undefined); setProject(p => p ? { ...p, active: Math.max(0, Math.min(p.versions.length - 1, n)) } : p); };
    return { project, current: draft || project?.versions[project.active], change, commit, restore, version };
}
