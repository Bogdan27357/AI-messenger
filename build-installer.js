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

// Convert PNG to ICO using png2icons
function generateIco() {
  const buildDir = path.join(ROOT, 'build');
  const icoPath = path.join(buildDir, 'icon.ico');
  const pngPath = path.join(ROOT, 'logo.png');

  if (fs.existsSync(icoPath)) {
    log('icon.ico уже существует');
    return;
  }

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  log('Генерация icon.ico из logo.png...');

  try {
    const png2icons = require('png2icons');
    const pngData = fs.readFileSync(pngPath);
    const icoData = png2icons.createICO(pngData, png2icons.BILINEAR, 0, true, true);
    if (icoData) {
      fs.writeFileSync(icoPath, icoData);
      log('icon.ico создан');
    } else {
      throw new Error('png2icons returned null');
    }
  } catch (err) {
    log('png2icons не удался, создаю ICO вручную...');
    createIcoManually(pngPath, icoPath);
  }

  // Also copy PNG for Linux/macOS builds
  const pngDest = path.join(buildDir, 'icon.png');
  if (!fs.existsSync(pngDest)) {
    fs.copyFileSync(pngPath, pngDest);
  }
}

// Manual ICO creation from PNG (simple single-size ICO)
function createIcoManually(pngPath, icoPath) {
  const pngData = fs.readFileSync(pngPath);

  // ICO file format: header + directory entry + PNG data
  const numImages = 1;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // count

  const dirEntry = Buffer.alloc(dirEntrySize);
  dirEntry.writeUInt8(0, 0);           // width (0 = 256)
  dirEntry.writeUInt8(0, 1);           // height (0 = 256)
  dirEntry.writeUInt8(0, 2);           // color palette
  dirEntry.writeUInt8(0, 3);           // reserved
  dirEntry.writeUInt16LE(1, 4);        // color planes
  dirEntry.writeUInt16LE(32, 6);       // bits per pixel
  dirEntry.writeUInt32LE(pngData.length, 8);  // image size
  dirEntry.writeUInt32LE(dataOffset, 12);     // offset

  fs.writeFileSync(icoPath, Buffer.concat([header, dirEntry, pngData]));
  log('icon.ico создан (PNG-in-ICO)');
}

async function main() {
  log('═══════════════════════════════════════');
  log('  ПРМ Мессенджер — Сборка инсталлятора');
  log('═══════════════════════════════════════');
  log('');

  // 1. Install dependencies
  log('Проверка зависимостей...');

  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'electron-builder'))) {
    log('Установка electron-builder...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  }

  if (!fs.existsSync(path.join(ROOT, 'client', 'node_modules'))) {
    log('Установка зависимостей клиента...');
    execSync('npm install', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });
  }

  // 2. Generate ICO icon from PNG
  generateIco();

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
