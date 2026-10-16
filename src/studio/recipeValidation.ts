import { z } from 'zod';
import type { Recipe } from './registry';
const number = (min: number, max: number) => z.number().finite().min(min).max(max);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const cc = z.object({ exposure: number(-3, 3), highlights: number(-100, 100), shadows: number(-100, 100), whites: number(-100, 100), blacks: number(-100, 100), temperature: number(-100, 100), tint: number(-100, 100), vibrance: number(-100, 100), fade: number(0, 100), sharpen: number(0, 100) });
const options = z.object({
    format: z.enum(['png', 'jpeg', 'webp']), quality: number(1, 100), width: number(1, 16384).int(), height: number(1, 16384).int(), lock: z.boolean(),
    crop: z.object({ x: number(0, 16384).int(), y: number(0, 16384).int(), width: number(1, 16384).int(), height: number(1, 16384).int() }).strict(),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), flipH: z.boolean(), flipV: z.boolean(), brightness: number(0, 200), contrast: number(0, 200), saturation: number(0, 200), cc,
    watermarkMode: z.literal('text'), text: z.string().max(80), color, opacity: number(0, 100), scale: number(1, 20), position: z.enum(['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']),
    multiplier: z.union([z.literal(2), z.literal(4)]), targetKB: number(0, 25000), allowResize: z.boolean(), background: z.union([color, z.literal('transparent')]), padding: number(0, 40), shadow: number(0, 50),
    overlays: z.array(z.object({ id: z.string().max(100), kind: z.enum(['grain', 'vignette']), enabled: z.boolean(), opacity: number(0, 100), blend: z.enum(['source-over', 'multiply', 'screen', 'overlay']) }).strict()).max(5)
}).partial().strict();
const schema = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(60), description: z.string().max(200).optional(), steps: z.array(z.object({ tool: z.enum(['upscale', 'removebg', 'removewm', 'compress', 'resize', 'convert', 'crop', 'rotate', 'adjust', 'watermark', 'background', 'overlay']), options, fit: number(1, 4096).optional() }).strict()).min(1).max(8) }).strict();
export function parseRecipe(input: unknown): Recipe {
    const result = schema.safeParse(input); if (!result.success) throw new Error('INVALID_OPTIONS');
    return { ...result.data, id: crypto.randomUUID(), description: result.data.description || '' };
}
