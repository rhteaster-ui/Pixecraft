import { Aperture, Scissors, Eraser, Minimize2, Expand, Maximize2, FileImage, Crop, RotateCw, SlidersHorizontal, Stamp, Layers, Workflow, Paintbrush } from 'lucide-react';
import type { Tool, Options } from '../types';
export const icons = { upscale: Aperture, removebg: Scissors, removeobj: Paintbrush, removewm: Eraser, expand: Maximize2, compress: Minimize2, resize: Expand, convert: FileImage, crop: Crop, rotate: RotateCw, adjust: SlidersHorizontal, watermark: Stamp, background: Layers, overlay: Layers };
export const groups = [
    { id: 'ai', name: ['AI Studio', 'AI Studio'], icon: Aperture, tools: ['upscale', 'removebg', 'removeobj', 'removewm', 'expand'] as Tool[] },
    { id: 'size', name: ['Ukuran', 'Size & format'], icon: Minimize2, tools: ['compress', 'resize', 'convert'] as Tool[] },
    { id: 'edit', name: ['Edit', 'Edit'], icon: SlidersHorizontal, tools: ['crop', 'rotate', 'adjust'] as Tool[] },
    { id: 'finish', name: ['Finishing', 'Finishing'], icon: Layers, tools: ['background', 'watermark', 'overlay'] as Tool[] }
];
export interface RecipeStep {
    tool: Tool;
    options: Partial<Options>;
    fit?: number;
}
export interface Recipe {
    id: string;
    name: string;
    description: string;
    steps: RecipeStep[];
}
export const recipes: Recipe[] = [
    { id: 'web', name: 'Web ready', description: '1600 px · WebP ≤ 200 KB', steps: [{ tool: 'resize', options: {}, fit: 1600 }, { tool: 'compress', options: { format: 'webp', quality: 90, targetKB: 200, allowResize: true } }] },
    { id: 'catalog', name: 'Product canvas', description: '1200 × 1200 · WebP ≤ 300 KB', steps: [{ tool: 'background', options: { width: 1200, height: 1200, background: '#f2efe8', padding: 8, shadow: 12 } }, { tool: 'compress', options: { format: 'webp', quality: 92, targetKB: 300, allowResize: true } }] },
    { id: 'document', name: 'Form ready', description: '1200 px · JPEG ≤ 200 KB', steps: [{ tool: 'resize', options: {}, fit: 1200 }, { tool: 'compress', options: { format: 'jpeg', quality: 92, targetKB: 200, allowResize: true } }] }
];
export const brand = { name: 'PIXCRAFT', credit: 'r_hmt ofc', maxFiles: 12, maxWorkspaceBytes: 150 * 1024 * 1024 };
export { Workflow };
