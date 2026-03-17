#!/usr/bin/env node

/**
 * ПРМ — Единый лаунчер
 *
 * Запускает приложение одной командой:
 *   node start.js          — десктоп (Electron)
 *   node start.js --web    — веб-режим (браузер)
 *   node start.js --build  — пересобрать фронтенд перед запуском
 */

const { execSync, spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const args = process.argv.slice(2);
const isWeb = args.includes('--web');
const needBuild = args.includes('--build');

const PORT = process.env.PORT || 3001;

function log(msg) {
  console.log(`\x1b[36m[ПРМ]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[ПРМ]\x1b[0m ${msg}`);
}

// Check if node_modules exist
function ensureDeps() {
  const rootModules = path.join(ROOT, 'node_modules');
  const clientModules = path.join(ROOT, 'client', 'node_modules');

  if (!fs.existsSync(rootModules)) {
    log('Установка зависимостей сервера...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  }

  if (!fs.existsSync(clientModules)) {
    log('Установка зависимостей клиента...');
    execSync('npm install', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });
  }
}

// Build client if needed
function ensureBuild() {
  const distDir = path.join(ROOT, 'client', 'dist');
  if (!fs.existsSync(distDir) || needBuild) {
    log('Сборка фронтенда...');
    execSync('npx vite build', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' });
  }
}

// Ensure data directories
function ensureDirs() {
  const dirs = [
    path.join(ROOT, 'server', 'data'),
    path.join(ROOT, 'server', 'uploads')
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  log('═══════════════════════════════════════');
  log('  ПРМ — Корпоративный мессенджер');
  log('  Аэропорт Пулково');
  log('═══════════════════════════════════════');
  log('');

  ensureDirs();
  ensureDeps();
  ensureBuild();

  if (isWeb) {
    // Web mode — just start the server
    log(`Запуск в веб-режиме на порту ${PORT}...`);
    process.env.NODE_ENV = 'production';
    process.env.PORT = String(PORT);

    const server = fork(path.join(ROOT, 'server', 'index.js'), [], {
      env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) }
    });

    log('');
    log(`Откройте в браузере: http://localhost:${PORT}`);
    log('Для остановки нажмите Ctrl+C');
    log('');
    log('Демо-вход: admin / admin123');

    process.on('SIGINT', () => {
      log('Остановка сервера...');
      server.kill();
      process.exit(0);
    });
  } else {
    // Desktop mode — Electron
    log('Запуск десктопного приложения...');

    // Check if electron is available
    let electronPath;
    try {
      electronPath = require('electron');
      if (typeof electronPath !== 'string') {
        electronPath = require.resolve('electron/cli.js');
      }
    } catch {
      log('Electron не установлен. Устанавливаю...');
      execSync('npm install electron@latest --save-dev --no-optional', { cwd: ROOT, stdio: 'inherit' });
      electronPath = require('electron');
      if (typeof electronPath !== 'string') {
        electronPath = require.resolve('electron/cli.js');
      }
    }

    const electronBin = typeof electronPath === 'string' ? electronPath : 'npx';
    const electronArgs = typeof electronPath === 'string'
      ? [path.join(ROOT, 'electron.js')]
      : ['electron', path.join(ROOT, 'electron.js')];

    const child = spawn(electronBin, electronArgs, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) }
    });

    child.on('close', (code) => {
      log('Приложение закрыто.');
      process.exit(code || 0);
    });
  }
}

main().catch(err => {
  logError('Ошибка запуска: ' + err.message);
  process.exit(1);
});
