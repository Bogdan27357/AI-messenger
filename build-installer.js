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

  // 2. Build frontend
  log('Сборка фронтенда...');
  execSync('npx vite build', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });

  // 3. Ensure data directories exist
  const dirs = ['server/data', 'server/uploads'];
  dirs.forEach(d => {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  });

  // 4. Determine target platform
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

  // 5. Build installer
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

  // 6. Show results
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
      log(`  📦 ${f} (${size} MB)`);
    });

    log('');
    log(`Папка: ${installerDir}`);
  }
}

main().catch(err => {
  logError('Фатальная ошибка: ' + err.message);
  process.exit(1);
});
