// ezremove.js
// Node.js 18+
//
// Usage:
// const { removeObject } = require("./ezremove");
//
// const result = await removeObject({
//   imageBuffer,
//   maskBuffer,
//   imageFilename: "image.png",
//   maskFilename: "mask.png"
// });
//
// result.buffer   -> PNG hasil
// result.jobId
// result.outputUrl

const path = require("path");

const BASE = "https://api.ezremove.ai";

const ORIGIN = "https://ezremove.ai";
const REFERER = "https://ezremove.ai/";

const PRODUCT_SERIAL = "4dcbe741d275268664b6e4c3fb6d179c";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function mimeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();

  return (
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    }[ext] || "application/octet-stream"
  );
}

async function parseJSON(res, name) {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `${name} HTTP ${res.status}: ${text}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${name}: response bukan JSON`
    );
  }
}

/* =========================================
   CREATE MASK JOB
========================================= */

async function createMaskJob({
  imageBuffer,
  maskBuffer,
  imageFilename,
  maskFilename,
}) {
  const form = new FormData();

  const imageBlob = new Blob(
    [imageBuffer],
    {
      type: mimeFromFilename(imageFilename),
    }
  );

  const maskBlob = new Blob(
    [maskBuffer],
    {
      type: mimeFromFilename(maskFilename),
    }
  );

  // Nama field confirmed dari Reqable.
  form.append(
    "original_image_file",
    imageBlob,
    imageFilename
  );

  form.append(
    "mask_file",
    maskBlob,
    maskFilename
  );

  const res = await fetch(
    `${BASE}/api/ez-remove/obj-remove/create-mask-job`,
    {
      method: "POST",

      headers: {
        Accept:
          "application/json, text/plain, */*",

        Origin: ORIGIN,
        Referer: REFERER,

        "product-serial":
          PRODUCT_SERIAL,
      },

      body: form,
    }
  );

  const json =
    await parseJSON(res, "create-mask-job");

  if (
    json.code !== 100000 ||
    !json.result?.job_id
  ) {
    throw new Error(
      json.message?.en ||
      `Create job gagal (${json.code})`
    );
  }

  return {
    jobId: json.result.job_id,
    imageUrl:
      json.result.image_url || null,
  };
}

/* =========================================
   POLLING
========================================= */

async function waitForJob(
  jobId,
  {
    pollInterval = 2000,
    maxAttempts = 90,
  } = {}
) {
  const url =
    `${BASE}/api/ez-remove/obj-remove/get-job-v2/` +
    encodeURIComponent(jobId);

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    const res = await fetch(url, {
      method: "GET",

      headers: {
        Accept:
          "application/json, text/plain, */*",

        Origin: ORIGIN,
        Referer: REFERER,
      },
    });

    const json =
      await parseJSON(res, "get-job-v2");

    const result = json.result || {};

    /*
      Capture confirmed:
        code   = 100000
        status = 2
        output = ["https://...png"]
    */

    if (
      json.code === 100000 &&
      result.status === 2 &&
      Array.isArray(result.output) &&
      result.output.length
    ) {
      return {
        outputUrl: result.output[0],
        output: result.output,
      };
    }

    /*
      Status selain 2 dianggap masih berjalan
      selama server tidak mengirim error.
    */

    if (
      result.error &&
      String(result.error).trim()
    ) {
      throw new Error(
        `EzRemove job gagal: ${result.error}`
      );
    }

    await sleep(pollInterval);
  }

  throw new Error(
    "EzRemove processing timeout"
  );
}

/* =========================================
   DOWNLOAD RESULT
========================================= */

async function downloadResult(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "image/*,*/*",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Download result HTTP ${res.status}`
    );
  }

  return Buffer.from(
    await res.arrayBuffer()
  );
}

/* =========================================
   PUBLIC API
========================================= */

async function removeObject({
  imageBuffer,
  maskBuffer,

  imageFilename = "image.png",
  maskFilename = "mask.png",

  pollInterval = 2000,
  maxAttempts = 90,
} = {}) {
  if (!imageBuffer) {
    throw new Error(
      "imageBuffer wajib diisi"
    );
  }

  if (!maskBuffer) {
    throw new Error(
      "maskBuffer wajib diisi"
    );
  }

  const image = Buffer.isBuffer(imageBuffer)
    ? imageBuffer
    : Buffer.from(imageBuffer);

  const mask = Buffer.isBuffer(maskBuffer)
    ? maskBuffer
    : Buffer.from(maskBuffer);

  if (!image.length) {
    throw new Error(
      "Original image kosong"
    );
  }

  if (!mask.length) {
    throw new Error(
      "Mask kosong"
    );
  }

  // 1. Submit original + mask
  const job =
    await createMaskJob({
      imageBuffer: image,
      maskBuffer: mask,
      imageFilename,
      maskFilename,
    });

  // 2. Poll sampai status 2
  const result =
    await waitForJob(
      job.jobId,
      {
        pollInterval,
        maxAttempts,
      }
    );

  // 3. Download PNG hasil
  const outputBuffer =
    await downloadResult(
      result.outputUrl
    );

  return {
    buffer: outputBuffer,

    mimeType: "image/png",
    extension: "png",

    jobId: job.jobId,
    inputUrl: job.imageUrl,

    outputUrl:
      result.outputUrl,

    outputs:
      result.output,
  };
}

module.exports = {
  removeObject,
  createMaskJob,
  waitForJob,
};
