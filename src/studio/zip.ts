// Small ZIP writer using STORE: image files are already compressed.
const table = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++)
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(bytes: Uint8Array) { let c = 0xffffffff; for (const b of bytes)
    c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export async function zipFiles(files: {
    name: string;
    blob: Blob;
}[], signal?: AbortSignal): Promise<Blob> {
    const parts: BlobPart[] = [], central: BlobPart[] = [];
    let offset = 0, centralSize = 0;
    const encoder = new TextEncoder();
    for (const f of files) {
        if (signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        const data = new Uint8Array(await f.blob.arrayBuffer()), name = encoder.encode(f.name), crc = crc32(data);
        const a = new Uint8Array(30 + name.length), v = new DataView(a.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 0x800, true);
        v.setUint32(14, crc, true);
        v.setUint32(18, data.length, true);
        v.setUint32(22, data.length, true);
        v.setUint16(26, name.length, true);
        a.set(name, 30);
        const b = new Uint8Array(46 + name.length), w = new DataView(b.buffer);
        w.setUint32(0, 0x02014b50, true);
        w.setUint16(4, 20, true);
        w.setUint16(6, 20, true);
        w.setUint16(8, 0x800, true);
        w.setUint32(16, crc, true);
        w.setUint32(20, data.length, true);
        w.setUint32(24, data.length, true);
        w.setUint16(28, name.length, true);
        w.setUint32(42, offset, true);
        b.set(name, 46);
        parts.push(a, f.blob);
        central.push(b);
        offset += a.length + data.length;
        centralSize += b.length;
        await new Promise(r => setTimeout(r, 0));
    }
    const end = new Uint8Array(22), v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, files.length, true);
    v.setUint16(10, files.length, true);
    v.setUint32(12, centralSize, true);
    v.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
