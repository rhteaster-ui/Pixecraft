import { openDB, type IDBPDatabase } from 'idb';
import type { Project, Workspace } from './types';
import { migrateProject } from './studio/document';
const DB_NAME = 'pixcraft-db';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
async function getDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', { keyPath: 'id' });
        }
    });
}
export async function listProjects(): Promise<Project[]> {
    try {
        const db = await getDB();
        const all = await db.getAll(STORE_NAME);
        return (all as Project[]).map(migrateProject).sort((a, b) => b.updated - a.updated);
    }
    catch (e) {
        throw new Error('STORAGE_UNAVAILABLE');
    }
}
export async function saveProject(project: Project): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, project);
}
export async function removeProject(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}
export async function clearProjects(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
}
export async function saveWorkspace(workspace: Workspace) {
    try { const db = await getDB(); await db.put('workspaces', workspace); }
    catch (e) { throw new Error(e instanceof DOMException && e.name === 'QuotaExceededError' ? 'STORAGE_QUOTA' : 'STORAGE_UNAVAILABLE'); }
}
export async function listWorkspaces(): Promise<Workspace[]> {
    const db = await getDB();
    return ((await db.getAll('workspaces')) as Workspace[]).sort((a, b) => b.updated - a.updated);
}
export async function removeWorkspace(id: string) { const db = await getDB(); await db.delete('workspaces', id); }
