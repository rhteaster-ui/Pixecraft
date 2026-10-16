/**
 * Object Remover / Inpainting Tool (LaMa AI Engine)
 * --------------------------------------------------
 * Menghapus objek yang ditandai dari gambar menggunakan model LaMa (Large Mask Inpainting).
 * Model ini adalah engine AI inpainting yang sama dengan yang digunakan oleh cleanup.pictures.
 *
 * Fitur:
 * - 100% Mandiri (Zero external dependency berat, menggunakan native fetch & FormData Node.js)
 * - Multi-Endpoint Failover (otomatis beralih ke server cadangan jika server utama sibuk)
 * - Menerima Input: File lokal, URL web, Buffer, atau Base64
 * - Output: File tersimpan, Buffer, Base64 Data URL (siap dipakai langsung di frontend web)
 * - Dapat digunakan sebagai modul backend atau langsung dijalankan via CLI
 *
 * Penggunaan CLI:
 *   node object-remover.js <image-path-or-url> <mask-path-or-url> [output-path]
 *
 * Contoh:
 *   node object-remover.js ./photo.jpg ./mask.png ./output-clean.png
 */

const fs = require('fs');
const path = require('path');

// Daftar server backup untuk keandalan maksimal (High Availability)
const SERVERS = [
    'https://dsxailab-lama-cleaner-lama-12.hf.space',
    'https://chow-q-lama-cleaner-lama.hf.space'
];

/**
 * Mendapatkan mime type dari nama file / buffer
 */
function getMimeType(filePath, defaultType = 'image/png') {
    if (typeof filePath !== 'string') return defaultType;
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    };
    return map[ext] || defaultType;
}

/**
 * Helper untuk menormalkan input (File lokal, URL, Buffer, atau Base64) menjadi Blob
 */
async function toBlob(input, defaultFilename = 'image.png') {
    if (!input) {
        throw new Error(`Input "${defaultFilename}" tidak boleh kosong.`);
    }

    // 1. Jika input adalah Buffer atau Uint8Array
    if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
        return new Blob([input], { type: 'image/png' });
    }

    // 2. Jika input adalah string
    if (typeof input === 'string') {
        // 2a. Data URL / Base64
        if (input.startsWith('data:')) {
            const match = input.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                const mime = match[1];
                const buffer = Buffer.from(match[2], 'base64');
                return new Blob([buffer], { type: mime });
            }
        }

        // 2b. URL Web (http / https)
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const res = await fetch(input);
            if (!res.ok) {
                throw new Error(`Gagal mengunduh gambar dari URL ${input}: HTTP ${res.status}`);
            }
            const arrayBuffer = await res.arrayBuffer();
            const mime = res.headers.get('content-type') || getMimeType(input);
            return new Blob([arrayBuffer], { type: mime });
        }

        // 2c. Path file lokal
        const resolvedPath = path.resolve(input);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File lokal tidak ditemukan: ${resolvedPath}`);
        }
        const buffer = fs.readFileSync(resolvedPath);
        const mime = getMimeType(resolvedPath);
        return new Blob([buffer], { type: mime });
    }

    throw new Error('Format input tidak didukung. Gunakan path file, URL, Buffer, atau Base64.');
}

/**
 * Fungsi Utama: Menghapus Objek dari Gambar
 *
 * @param {string|Buffer} imageInput - Gambar asli (path file, URL, buffer, atau base64)
 * @param {string|Buffer} maskInput - Mask area objek (warna putih = objek yang dihapus)
 * @param {Object} [options]
 * @param {string} [options.outputPath] - Path untuk menyimpan hasil (opsional)
 * @param {string} [options.hdStrategy="Original"] - Strategi resolusi: "Original" | "Resize" | "Crop"
 * @param {number} [options.timeout=90000] - Batas waktu request (milidetik)
 * @returns {Promise<{success: boolean, buffer: Buffer, base64: string, dataUrl: string, mimeType: string, durationMs: number}>}
 */
async function removeObject(imageInput, maskInput, options = {}) {
    const {
        outputPath = null,
        hdStrategy = 'Original',
        timeout = 90000
    } = options;

    const startTime = Date.now();

    const [imageBlob, maskBlob] = await Promise.all([
        toBlob(imageInput, 'image.png'),
        toBlob(maskInput, 'mask.png')
    ]);

    let lastError = null;

    // Mencoba server-server yang tersedia secara berurutan
    for (let i = 0; i < SERVERS.length; i++) {
        const serverUrl = SERVERS[i];
        try {
            const form = new FormData();
            form.append('image', imageBlob, 'image.png');
            form.append('mask', maskBlob, 'mask.png');
            form.append('ldmSteps', '25');
            form.append('ldmSampler', 'plms');
            form.append('zitsWireframe', 'true');
            form.append('hdStrategy', hdStrategy);
            form.append('hdStrategyCropMargin', '128');
            form.append('hdStrategyCropTrigerSize', '2048');
            form.append('hdStrategyResizeLimit', '2048');
            form.append('prompt', '');
            form.append('negativePrompt', '');
            form.append('croperX', '0');
            form.append('croperY', '0');
            form.append('croperHeight', '512');
            form.append('croperWidth', '512');
            form.append('useCroper', 'false');
            form.append('sdMaskBlur', '11');
            form.append('sdStrength', '1');
            form.append('sdSteps', '50');
            form.append('sdGuidanceScale', '7.5');
            form.append('sdSampler', 'pndm');
            form.append('sdSeed', '-1');
            form.append('sdMatchHistograms', 'false');
            form.append('sdScale', '1');
            form.append('cv2Radius', '5');
            form.append('cv2Flag', 'INPAINT_NS');
            form.append('paintByExampleSteps', '50');
            form.append('paintByExampleGuidanceScale', '7.5');
            form.append('paintByExampleSeed', '-1');
            form.append('paintByExampleMaskBlur', '5');
            form.append('paintByExampleMatchHistograms', 'false');
            form.append('p2pSteps', '50');
            form.append('p2pImageGuidanceScale', '1.5');
            form.append('p2pGuidanceScale', '7.5');
            form.append('controlnet_conditioning_scale', '0.4');
            form.append('controlnet_method', 'control_v11p_sd15_canny');

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`${serverUrl}/inpaint`, {
                method: 'POST',
                body: form,
                signal: controller.signal
            });

            clearTimeout(timer);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get('content-type') || 'image/png';
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;

            // Simpan file jika outputPath ditentukan
            if (outputPath) {
                const destDir = path.dirname(path.resolve(outputPath));
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                fs.writeFileSync(path.resolve(outputPath), buffer);
            }

            const durationMs = Date.now() - startTime;

            return {
                success: true,
                buffer,
                base64,
                dataUrl,
                mimeType,
                serverUsed: serverUrl,
                durationMs,
                outputPath: outputPath ? path.resolve(outputPath) : null
            };
        } catch (err) {
            lastError = err;
        }
    }

    throw new Error(`Semua server object remover gagal diproses. Error terakhir: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
    removeObject,
    SERVERS
};

// CLI Execution Handler
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('\n=======================================================');
        console.log('       AI OBJECT REMOVER (LAMA INPAINTING) CLI         ');
        console.log('=======================================================\n');
        console.log('Penggunaan:');
        console.log('  node object-remover.js <image> <mask> [output.png]\n');
        console.log('Parameter:');
        console.log('  <image>      Path file lokal atau URL gambar asli.');
        console.log('  <mask>       Path file lokal atau URL mask gambar.');
        console.log('               (Catatan: Mask berwarna putih = area objek yang dihapus)');
        console.log('  [output.png] Lokasi penyimpanan file hasil (opsional).\n');
        console.log('Contoh:');
        console.log('  node object-remover.js ./photo.jpg ./mask.png ./hasil.png\n');
        process.exit(1);
    }

    const [imageInput, maskInput, outputPathArg] = args;
    const defaultOutput = outputPathArg || path.join(process.cwd(), `cleaned_${Date.now()}.png`);

    console.log('Mengirim permintaan Object Remover ke AI backend...');
    console.log(`- Gambar Input : ${imageInput}`);
    console.log(`- Mask Input   : ${maskInput}`);
    console.log(`- Output Target: ${defaultOutput}`);

    removeObject(imageInput, maskInput, { outputPath: defaultOutput })
        .then(result => {
            console.log('\n Berhasil menghapus objek!');
            console.log(`- Waktu Proses : ${(result.durationMs / 1000).toFixed(2)} detik`);
            console.log(`- Server Dipakai: ${result.serverUsed}`);
            console.log(`- File Tersimpan: ${result.outputPath}`);
            console.log(`- Ukuran Data  : ${(result.buffer.length / 1024).toFixed(1)} KB\n`);
        })
        .catch(err => {
            console.error('\n Gagal memproses gambar:', err.message);
            process.exit(1);
        });
}
