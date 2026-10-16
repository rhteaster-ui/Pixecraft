// Parse dimensions before allocating decoded pixels. Only static PNG/JPEG/WebP.
export function inspectHeader(data: Uint8Array) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength), str = (i: number, n: number) => String.fromCharCode(...data.subarray(i, i + n));
    let width = 0, height = 0, mime = '';
    if (data.length >= 24 && data[0] === 137 && str(1, 3) === 'PNG' && str(12, 4) === 'IHDR') {
        mime = 'image/png';
        width = view.getUint32(16);
        height = view.getUint32(20);
        for (let i = 8; i + 12 <= data.length;) {
            const len = view.getUint32(i);
            if (str(i + 4, 4) === 'acTL')
                throw new Error('FILE_TYPE');
            i += 12 + len;
        }
    }
    else if (data[0] === 255 && data[1] === 216) {
        mime = 'image/jpeg';
        let i = 2;
        while (i + 4 < data.length) {
            if (data[i] !== 255) {
                i++;
                continue;
            }
            while (data[i] === 255)
                i++;
            const marker = data[i++];
            if (marker === 217 || marker === 218)
                break;
            if (marker === 1 || (marker >= 208 && marker <= 215))
                continue;
            if (i + 2 > data.length)
                break;
            const len = view.getUint16(i);
            if (len < 2)
                break;
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && i + 7 < data.length) {
                height = view.getUint16(i + 3);
                width = view.getUint16(i + 5);
                break;
            }
            i += len;
        }
    }
    else if (data.length >= 30 && str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') {
        mime = 'image/webp';
        const mode = str(12, 4);
        if (mode === 'VP8X') {
            if (data[20] & 2)
                throw new Error('FILE_TYPE');
            width = 1 + data[24] + (data[25] << 8) + (data[26] << 16);
            height = 1 + data[27] + (data[28] << 8) + (data[29] << 16);
        }
        else if (mode === 'VP8 ' && data[23] === 157 && data[24] === 1 && data[25] === 42) {
            width = view.getUint16(26, true) & 0x3fff;
            height = view.getUint16(28, true) & 0x3fff;
        }
        else if (mode === 'VP8L' && data[20] === 47) {
            const b = view.getUint32(21, true);
            width = 1 + (b & 0x3fff);
            height = 1 + ((b >>> 14) & 0x3fff);
        }
    }
    if (!width || !height)
        throw new Error('FILE_TYPE');
    return { width, height, mime };
}
