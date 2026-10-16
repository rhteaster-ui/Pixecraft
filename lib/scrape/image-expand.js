/**
 * AI Image Expand / Outpainting Scraper (FLUX.1 Fill)
 * Target: Backend Outpainting AI (FLUX Fill Zero-A10G)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const BASE = "https://multimodalart-flux-fill-outpaint.hf.space";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function randomSessionHash() {
  return crypto.randomBytes(8).toString("hex").slice(0, 11);
}

// Konversi input (path lokal, URL web, atau Buffer) menjadi format siap upload
async function prepareImagePayload(input) {
  let buffer;
  let filename = "input.jpg";
  let mimeType = "image/jpeg";

  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const res = await axios.get(input, {
        responseType: "arraybuffer",
        headers: { "user-agent": UA },
        timeout: 30000
      });
      buffer = Buffer.from(res.data);
      filename = path.basename(input.split("?")[0]) || "image.jpg";
      const contentType = res.headers["content-type"];
      if (contentType && contentType.startsWith("image/")) {
        mimeType = contentType;
      }
    } else {
      if (!fs.existsSync(input)) {
        throw new Error(`File input tidak ditemukan: ${input}`);
      }
      buffer = fs.readFileSync(input);
      filename = path.basename(input);
      const ext = path.extname(input).toLowerCase();
      const mimeMap = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
      };
      if (mimeMap[ext]) mimeType = mimeMap[ext];
    }
  } else {
    throw new Error("Format input tidak valid. Gunakan path file, URL, atau Buffer.");
  }

  return { buffer, filename, mimeType };
}

// Upload gambar ke server
async function uploadToGradio(buffer, filename, mimeType) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  form.append("files", blob, filename);

  const res = await axios.post(`${BASE}/gradio_api/upload`, form, {
    headers: {
      "user-agent": UA,
      origin: BASE,
      referer: `${BASE}/`
    },
    timeout: 60000
  });

  if (!Array.isArray(res.data) || !res.data[0]) {
    throw new Error("Gagal mengupload gambar ke server: " + JSON.stringify(res.data));
  }

  return res.data[0];
}

// Fungsi utama AI Outpainting
async function expandImage(input, options = {}) {
  const {
    prompt = "",
    width = 1024,
    height = 1024,
    overlap = 10,
    steps = 15,
    alignment = "Middle",
    resizeMode = "Full",
    customResize = 50,
    expandLeft = true,
    expandRight = true,
    expandTop = true,
    expandBottom = true,
    outputPath = null,
    onProgress = null
  } = options;

  const sessionHash = randomSessionHash();

  if (onProgress) onProgress({ status: "uploading", message: "Mengunggah gambar..." });
  const { buffer, filename, mimeType } = await prepareImagePayload(input);
  const uploadedPath = await uploadToGradio(buffer, filename, mimeType);

  if (onProgress) onProgress({ status: "queued", message: "Memasuki antrean AI..." });

  const payload = {
    data: [
      { path: uploadedPath, meta: { _type: "gradio.FileData" } },
      Number(width) || 1024,
      Number(height) || 1024,
      Number(overlap) || 10,
      Number(steps) || 15,
      resizeMode,
      Number(customResize) || 50,
      String(prompt || ""),
      alignment,
      Boolean(expandLeft),
      Boolean(expandRight),
      Boolean(expandTop),
      Boolean(expandBottom)
    ],
    event_data: null,
    fn_index: 6,
    trigger_id: 11,
    session_hash: sessionHash
  };

  await axios.post(`${BASE}/gradio_api/queue/join`, payload, {
    headers: {
      "user-agent": UA,
      "content-type": "application/json",
      origin: BASE,
      referer: `${BASE}/`
    },
    timeout: 30000
  });

  return new Promise(async (resolve, reject) => {
    let timeoutTimer = null;

    try {
      const sseRes = await axios.get(
        `${BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
        {
          responseType: "stream",
          headers: {
            "user-agent": UA,
            accept: "text/event-stream"
          },
          timeout: 180000
        }
      );

      timeoutTimer = setTimeout(() => {
        try { sseRes.data.destroy(); } catch {}
        reject(new Error("Timeout: Proses AI Outpaint melebihi batas waktu."));
      }, 180000);

      let bufferChunk = "";

      sseRes.data.on("data", async chunk => {
        bufferChunk += chunk.toString();
        const lines = bufferChunk.split("\n\n");
        bufferChunk = lines.pop();

        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          let eventData;
          try {
            eventData = JSON.parse(match[1]);
          } catch {
            continue;
          }

          if (eventData.msg === "progress") {
            const progress = eventData.progress_data?.[0];
            if (progress && onProgress) {
              const current = progress.index;
              const total = progress.length;
              const percent = total ? Math.round((current / total) * 100) : 0;
              onProgress({
                status: "generating",
                message: progress.desc || `Memproses AI (${current}/${total} steps)`,
                percent,
                current,
                total
              });
            }
          }

          if (eventData.msg === "process_completed") {
            clearTimeout(timeoutTimer);

            if (!eventData.success) {
              return reject(new Error(eventData.output?.error || "Gagal memproses gambar."));
            }

            const outputData = eventData.output?.data;
            if (!Array.isArray(outputData) || !outputData[0]?.url) {
              return reject(new Error("Output gambar tidak ditemukan."));
            }

            const resultImageUrl = outputData[0].url;
            const maskImageUrl = outputData[1]?.url || null;
            const duration = eventData.output?.duration || 0;

            let savedFile = null;
            let outputBuffer = null;

            const dlRes = await axios.get(resultImageUrl, {
              responseType: "arraybuffer",
              headers: { "user-agent": UA },
              timeout: 45000
            });
            outputBuffer = Buffer.from(dlRes.data);

            if (outputPath) {
              const targetDir = path.dirname(outputPath);
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }
              fs.writeFileSync(outputPath, outputBuffer);
              savedFile = path.resolve(outputPath);
            }

            return resolve({
              status: "success",
              buffer: outputBuffer,
              url: resultImageUrl,
              maskUrl: maskImageUrl,
              savedTo: savedFile,
              duration: Math.round(duration * 100) / 100,
              width: Number(width),
              height: Number(height),
              prompt: prompt || null
            });
          }
        }
      });

      sseRes.data.on("error", err => {
        clearTimeout(timeoutTimer);
        reject(new Error("SSE Stream Error: " + err.message));
      });
    } catch (err) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      reject(err);
    }
  });
}

module.exports = { expandImage };

// CLI Runner
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputArg = args[0];
  const outputArg = args[1] || null;
  const promptArg = args[2] || "";
  const widthArg = parseInt(args[3], 10) || 1024;
  const heightArg = parseInt(args[4], 10) || 1024;

  if (!inputArg) {
    console.log('Usage: node image-expand.js <input-path-atau-url> [output-path] [prompt] [width] [height]');
    process.exit(1);
  }

  expandImage(inputArg, {
    outputPath: outputArg,
    prompt: promptArg,
    width: widthArg,
    height: heightArg,
    onProgress: p => {
      if (p.percent !== undefined) {
        process.stdout.write(`\r[*] Progress: ${p.percent}% - ${p.message}    `);
      } else {
        process.stdout.write(`\r[*] ${p.message}    `);
      }
    }
  })
    .then(res => {
      console.log("\n\n=== Hasil AI Image Expand ===");
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error("\n[!] Error:", err.message);
      process.exit(1);
    });
}
