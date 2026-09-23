/**
 * tsc يترجم ملفات .ts بس، وما ينسخ الملفات الثابتة (خطوط، صور).
 * هذا السكربت يشتغل بعد tsc وينسخ src/assets كامل إلى dist/assets.
 */
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "src", "assets");
const dest = path.join(__dirname, "..", "dist", "assets");

fs.cpSync(src, dest, { recursive: true });
console.log(`✅ تم نسخ الملفات الثابتة: ${src} → ${dest}`);
