import sharp from 'sharp';
import { AppError, imageBuffer, maxPixels } from './core.js';
export async function processImage(body: any): Promise<{
    output: Buffer;
    type: string;
}> {
    const { image, tool, options } = body || {};
    if (!image)
        throw new AppError('FILE_LIMIT', 400);
    const { buffer } = await imageBuffer(image);
    let pipeline = sharp(buffer, { limitInputPixels: maxPixels() }).rotate();
    let mimeType = 'image/png';
    if (tool === 'resize' && options?.width && options?.height) {
        pipeline = pipeline.resize(options.width, options.height, { fit: 'fill' });
    }
    const format = options?.format || 'webp';
    const quality = Math.min(100, Math.max(1, Number(options?.quality) || 85));
    if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality });
        mimeType = 'image/jpeg';
    }
    else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
        mimeType = 'image/webp';
    }
    else {
        pipeline = pipeline.png();
        mimeType = 'image/png';
    }
    const output = await pipeline.toBuffer();
    return { output, type: mimeType };
}
