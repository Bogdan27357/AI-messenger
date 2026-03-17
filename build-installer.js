#!/usr/bin/env node

/**
 * ПРМ Мессенджер — Сборка инсталлятора
 *
 * Использование:
 *   node build-installer.js          — сборка для текущей ОС
 *   node build-installer.js --win    — Windows (.exe)
 *   node build-installer.js --mac    — macOS (.dmg)
 *   node build-installer.js --linux  — Linux (.AppImage, .deb)
 *
 * Результат: папка /installer/
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ROOT = __dirname;
const args = process.argv.slice(2);

function log(msg) {
  console.log(`\x1b[36m[BUILD]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[BUILD]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[BUILD]\x1b[0m ${msg}`);
}

// ─── PNG Parser (minimal, for RGBA extraction) ─────────────────────

function parsePng(buffer) {
  // Verify PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.compare(sig, 0, 8, 0, 8) !== 0) throw new Error('Not a PNG');

  let offset = 8;
  let width, height, bitDepth, colorType;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // 4 len + 4 type + data + 4 crc
  }

  // Decompress IDAT
  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);

  // Defilter and extract RGBA
  const bpp = colorType === 6 ? 4 : (colorType === 2 ? 3 : 4); // RGBA or RGB
  const stride = width * bpp + 1; // +1 for filter byte
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    for (let x = 0; x < width; x++) {
      const rawIdx = y * stride + 1 + x * bpp;
      const pixIdx = (y * width + x) * 4;

      let r = raw[rawIdx];
      let g = raw[rawIdx + 1];
      let b = raw[rawIdx + 2];
      let a = bpp === 4 ? raw[rawIdx + 3] : 255;

      // Apply defiltering
      if (filterType === 1) { // Sub
        if (x > 0) {
          r = (r + pixels[pixIdx - 4]) & 0xFF;
          g = (g + pixels[pixIdx - 3]) & 0xFF;
          b = (b + pixels[pixIdx - 2]) & 0xFF;
          a = (a + pixels[pixIdx - 1]) & 0xFF;
        }
      } else if (filterType === 2) { // Up
        if (y > 0) {
          r = (r + pixels[pixIdx - width * 4]) & 0xFF;
          g = (g + pixels[pixIdx - width * 4 + 1]) & 0xFF;
          b = (b + pixels[pixIdx - width * 4 + 2]) & 0xFF;
          a = (a + pixels[pixIdx - width * 4 + 3]) & 0xFF;
        }
      } else if (filterType === 3) { // Average
        const left = x > 0 ? pixels.slice(pixIdx - 4, pixIdx) : Buffer.alloc(4);
        const up = y > 0 ? pixels.slice(pixIdx - width * 4, pixIdx - width * 4 + 4) : Buffer.alloc(4);
        r = (r + Math.floor((left[0] + up[0]) / 2)) & 0xFF;
        g = (g + Math.floor((left[1] + up[1]) / 2)) & 0xFF;
        b = (b + Math.floor((left[2] + up[2]) / 2)) & 0xFF;
        a = (a + Math.floor((left[3] + up[3]) / 2)) & 0xFF;
      } else if (filterType === 4) { // Paeth
        const left = x > 0 ? pixels.slice(pixIdx - 4, pixIdx) : Buffer.alloc(4);
        const up = y > 0 ? pixels.slice(pixIdx - width * 4, pixIdx - width * 4 + 4) : Buffer.alloc(4);
        const upLeft = (x > 0 && y > 0) ? pixels.slice(pixIdx - width * 4 - 4, pixIdx - width * 4) : Buffer.alloc(4);
        r = (r + paeth(left[0], up[0], upLeft[0])) & 0xFF;
        g = (g + paeth(left[1], up[1], upLeft[1])) & 0xFF;
        b = (b + paeth(left[2], up[2], upLeft[2])) & 0xFF;
        a = (a + paeth(left[3], up[3], upLeft[3])) & 0xFF;
      }

      pixels[pixIdx] = r;
      pixels[pixIdx + 1] = g;
      pixels[pixIdx + 2] = b;
      pixels[pixIdx + 3] = a;
    }
  }

  return { width, height, pixels };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ─── Resize using nearest neighbor (fast, good for icons) ──────────

function resizePixels(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      // Bilinear-ish sampling (center of pixel)
      const srcX = Math.min(Math.floor((x + 0.5) * xRatio), srcW - 1);
      const srcY = Math.min(Math.floor((y + 0.5) * yRatio), srcH - 1);
      const si = (srcY * srcW + srcX) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return dst;
}

// ─── Create BMP data for ICO entry ─────────────────────────────────

function createBmpEntry(pixels, size) {
  // BMP InfoHeader (BITMAPINFOHEADER) = 40 bytes
  const headerSize = 40;
  const bmpDataSize = size * size * 4; // BGRA pixels
  const maskSize = Math.ceil(size / 32) * 4 * size; // AND mask, 1bpp padded to 4 bytes

  const header = Buffer.alloc(headerSize);
  header.writeUInt32LE(headerSize, 0);    // biSize
  header.writeInt32LE(size, 4);           // biWidth
  header.writeInt32LE(size * 2, 8);       // biHeight (doubled for XOR+AND)
  header.writeUInt16LE(1, 12);            // biPlanes
  header.writeUInt16LE(32, 14);           // biBitCount
  header.writeUInt32LE(0, 16);            // biCompression (BI_RGB)
  header.writeUInt32LE(bmpDataSize + maskSize, 20); // biSizeImage
  // rest is 0

  // Convert RGBA top-down to BGRA bottom-up
  const bmpPixels = Buffer.alloc(bmpDataSize);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcIdx = (y * size + x) * 4;
      const dstIdx = ((size - 1 - y) * size + x) * 4; // flip vertically
      bmpPixels[dstIdx + 0] = pixels[srcIdx + 2]; // B
      bmpPixels[dstIdx + 1] = pixels[srcIdx + 1]; // G
      bmpPixels[dstIdx + 2] = pixels[srcIdx + 0]; // R
      bmpPixels[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  // AND mask (all zeros = fully opaque when alpha is in BGRA)
  const mask = Buffer.alloc(maskSize, 0);

  return Buffer.concat([header, bmpPixels, mask]);
}

// ─── Generate proper ICO file ──────────────────────────────────────

function generateIco() {
  const buildDir = path.join(ROOT, 'build');
  const icoPath = path.join(buildDir, 'icon.ico');
  const pngPath = path.join(ROOT, 'logo.png');

  // Always regenerate to avoid stale/broken ico
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  log('Генерация icon.ico из logo.png...');

  // Try png-to-ico first (best quality)
  try {
    const pngToIco = require('png-to-ico');
    const pngBuf = fs.readFileSync(pngPath);
    // png-to-ico returns a promise
    return pngToIco(pngBuf).then(ico => {
      fs.writeFileSync(icoPath, ico);
      log('icon.ico создан (png-to-ico)');
      copyPng(buildDir, pngPath);
    });
  } catch (e) {
    // Fallback: create ICO manually with BMP entries
    log('png-to-ico недоступен, создаю ICO вручную...');
  }

  try {
    const pngData = fs.readFileSync(pngPath);
    const img = parsePng(pngData);
    log(`  Исходное изображение: ${img.width}x${img.height}`);

    const sizes = [256, 128, 64, 48, 32, 16];
    const entries = [];

    for (const size of sizes) {
      const resized = resizePixels(img.pixels, img.width, img.height, size, size);
      const bmpData = createBmpEntry(resized, size);
      entries.push({ size, data: bmpData });
    }

    // ICO header
    const headerSize = 6;
    const dirEntrySize = 16;
    const numImages = entries.length;
    let dataOffset = headerSize + dirEntrySize * numImages;

    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(numImages, 4);

    const dirEntries = [];
    for (const entry of entries) {
      const dir = Buffer.alloc(dirEntrySize);
      dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0); // 0 = 256
      dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
      dir.writeUInt8(0, 2);
      dir.writeUInt8(0, 3);
      dir.writeUInt16LE(1, 4);
      dir.writeUInt16LE(32, 6);
      dir.writeUInt32LE(entry.data.length, 8);
      dir.writeUInt32LE(dataOffset, 12);
      dataOffset += entry.data.length;
      dirEntries.push(dir);
    }

    const ico = Buffer.concat([header, ...dirEntries, ...entries.map(e => e.data)]);
    fs.writeFileSync(icoPath, ico);
    log(`icon.ico создан (${entries.length} размеров: ${sizes.join(', ')})`);
  } catch (err) {
    logError('Не удалось создать ICO: ' + err.message);
    logError('Попробуйте вручную создать build/icon.ico (256x256, формат ICO)');
    logError('Онлайн: https://www.icoconverter.com/');
    process.exit(1);
  }

  copyPng(buildDir, pngPath);
  return Promise.resolve();
}

function copyPng(buildDir, pngPath) {
  const pngDest = path.join(buildDir, 'icon.png');
  if (!fs.existsSync(pngDest)) {
    fs.copyFileSync(pngPath, pngDest);
  }
}

async function main() {
  log('═══════════════════════════════════════');
  log('  ПРМ Мессенджер — Сборка инсталлятора');
  log('═══════════════════════════════════════');
  log('');

  // 1. Install dependencies
  log('Проверка зависимостей...');

  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'electron-builder'))) {
    log('Установка зависимостей...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  }

  if (!fs.existsSync(path.join(ROOT, 'client', 'node_modules'))) {
    log('Установка зависимостей клиента...');
    execSync('npm install', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });
  }

  // 2. Generate ICO icon from PNG
  await generateIco();

  // 3. Build frontend
  log('Сборка фронтенда...');
  execSync('npx vite build', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });

  // 4. Ensure data directories exist
  const dirs = ['server/data', 'server/uploads'];
  dirs.forEach(d => {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  });

  // 5. Determine target platform
  let targetFlag = '';
  if (args.includes('--win')) {
    targetFlag = '--win';
    log('Целевая платформа: Windows (.exe)');
  } else if (args.includes('--mac')) {
    targetFlag = '--mac';
    log('Целевая платформа: macOS (.dmg)');
  } else if (args.includes('--linux')) {
    targetFlag = '--linux';
    log('Целевая платформа: Linux (.AppImage, .deb)');
  } else {
    log('Целевая платформа: текущая ОС');
  }

  // 6. Build installer
  log('');
  log('Сборка инсталлятора (это может занять несколько минут)...');
  log('');

  // Disable code signing (no certificate)
  const buildEnv = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    WIN_CSC_LINK: '',
    CSC_LINK: ''
  };

  const cmd = `npx electron-builder ${targetFlag} --config`;
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: buildEnv });
  } catch (err) {
    logError('Ошибка сборки. Подробности выше.');
    process.exit(1);
  }

  // 7. Show results
  const installerDir = path.join(ROOT, 'installer');
  if (fs.existsSync(installerDir)) {
    log('');
    logSuccess('══════════════════════════════════════');
    logSuccess('  Сборка завершена!');
    logSuccess('══════════════════════════════════════');
    log('');
    log('Готовые файлы:');

    const files = fs.readdirSync(installerDir).filter(f => {
      return f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') ||
             f.endsWith('.deb') || f.endsWith('.msi');
    });

    files.forEach(f => {
      const size = (fs.statSync(path.join(installerDir, f)).size / 1024 / 1024).toFixed(1);
      log(`  ${f} (${size} MB)`);
    });

    log('');
    log(`Папка: ${installerDir}`);
  }
}

main().catch(err => {
  logError('Фатальная ошибка: ' + err.message);
  process.exit(1);
});
