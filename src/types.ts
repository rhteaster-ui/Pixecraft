export type Tool = 'upscale' | 'removebg' | 'removeobj' | 'removewm' | 'expand' | 'compress' | 'resize' | 'convert' | 'crop' | 'rotate' | 'adjust' | 'watermark' | 'background' | 'overlay';
export interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Options {
    cc: ColorCorrection;
    overlays: Overlay[];
    format: 'jpeg' | 'png' | 'webp';
    quality: number;
    width: number;
    height: number;
    lock: boolean;
    crop: CropArea;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
    brightness: number;
    contrast: number;
    saturation: number;
    watermarkMode: 'text' | 'logo';
    text: string;
    color: string;
    logo: File | Blob | null;
    opacity: number;
    scale: number;
    position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
    multiplier: 2 | 4;
    targetKB: number;
    allowResize: boolean;
    background: string;
    padding: number;
    shadow: number;
    maskMode: 'brush' | 'rect' | 'lasso' | 'eraser';
    brushSize: number;
    maskBlob: Blob | null;
    expandPrompt: string;
    expandRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'custom';
    expandWidth: number;
    expandHeight: number;
    expandAlignment: 'Middle' | 'Left' | 'Right' | 'Top' | 'Bottom' | 'TopLeft' | 'TopRight' | 'BottomLeft' | 'BottomRight' | 'Custom';
    expandScale: number;
    expandOffsetX: number;
    expandOffsetY: number;
    expandLeft: boolean;
    expandRight: boolean;
    expandTop: boolean;
    expandBottom: boolean;
    expandOverlap: number;
}
export function defaults(width = 1200, height = 800): Options {
    return {
        cc: neutralCC(),
        overlays: [],
        format: 'webp',
        quality: 85,
        width,
        height,
        lock: true,
        crop: {
            x: 0,
            y: 0,
            width,
            height
        },
        rotation: 0,
        flipH: false,
        flipV: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        watermarkMode: 'text',
        text: 'PIXCRAFT',
        color: '#ffffff',
        logo: null,
        opacity: 80,
        scale: 8,
        position: 'bottom-right',
        targetKB: 0,
        allowResize: false,
        background: "#f1eee6",
        padding: 8,
        shadow: 12,
        multiplier: 2,
        maskMode: 'brush',
        brushSize: 32,
        maskBlob: null,
        expandPrompt: '',
        expandRatio: '1:1',
        expandWidth: 1024,
        expandHeight: 1024,
        expandAlignment: 'Middle',
        expandScale: 80,
        expandOffsetX: 0,
        expandOffsetY: 0,
        expandLeft: true,
        expandRight: true,
        expandTop: true,
        expandBottom: true,
        expandOverlap: 10
    };
}
export interface Version {
    state?: ImageState;
    id: string;
    label: string;
    width: number;
    height: number;
    blob: Blob;
    thumbnail: Blob;
    parentId?: string;
    targetBytes?: number;
}
export interface ColorCorrection {
    exposure: number; highlights: number; shadows: number; whites: number; blacks: number;
    temperature: number; tint: number; vibrance: number; fade: number; sharpen: number;
}
export const neutralCC = (): ColorCorrection => ({ exposure: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, vibrance: 0, fade: 0, sharpen: 0 });
export type ColorStyle = ColorCorrection & { brightness: number; contrast: number; saturation: number };
export const neutralStyle = (): ColorStyle => ({ ...neutralCC(), brightness: 100, contrast: 100, saturation: 100 });
export interface Overlay {
    id: string; kind: 'grain' | 'vignette' | 'custom'; enabled: boolean; opacity: number;
    blend: 'source-over' | 'multiply' | 'screen' | 'overlay'; image?: Blob;
}
export interface OutputPolicy {
    format: Options['format']; quality: number; targetKB: number; jpegBackground: string;
}
export interface EditOperation { tool: 'crop' | 'resize' | 'rotate' | 'background' | 'watermark'; options: Options }
export interface ImageState {
    source: Blob; sourceWidth: number; sourceHeight: number; width: number; height: number;
    operations: EditOperation[]; style: ColorStyle; overlays: Overlay[]; output: OutputPolicy;
}
export type SplitTree = { frame: string } | { id: string; axis: 'x' | 'y'; ratio: number; a: SplitTree; b: SplitTree };
export interface Frame {
    id: string; assetId: string; name: string; image: ImageState;
    fit: 'cover' | 'contain'; x: number; y: number; zoom: number;
}
export interface ComposerState {
    id: string; name: string; width: number; height: number; background: string;
    layout: SplitTree; frames: Frame[]; gap: number; margin: number; border: number;
    borderColor: string; radius: number; output: OutputPolicy;
}
export interface ComposerProject { versions: ComposerState[]; active: number }
export interface Workspace {
    id: string; name: string; schemaVersion: 2; updated: number; images: Project[];
    activeId: string; selected: string[]; mode: 'single' | 'composer'; composer?: ComposerProject;
}
export interface Project {
    id: string;
    name: string;
    created: number;
    updated: number;
    original: Blob;
    versions: Version[];
    active: number;
    thumbnail: Blob;
    schemaVersion: number;
}
