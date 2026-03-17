const { app, BrowserWindow, Menu, Tray, shell, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let tray;
let serverProcess;

const PORT = 3001;
const SERVER_URL = `http://localhost:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    // Set production mode so Express serves the built frontend
    const env = { ...process.env, NODE_ENV: 'production', PORT: String(PORT) };

    serverProcess = fork(path.join(__dirname, 'server', 'index.js'), [], {
      env,
      silent: true
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg);
      if (msg.includes('запущен')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', reject);

    // Fallback resolve after 3 seconds
    setTimeout(resolve, 3000);
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'logo.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ПРМ — Корпоративный мессенджер',
    icon: iconPath,
    backgroundColor: '#0e1621',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (process.platform !== 'darwin') return;
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Application menu
  const menuTemplate = [
    {
      label: 'ПРМ',
      submenu: [
        { label: 'О приложении', role: 'about' },
        { type: 'separator' },
        { label: 'Настройки', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.loadURL(`${SERVER_URL}/profile`) },
        { type: 'separator' },
        { label: 'Выход', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { label: 'Отменить', role: 'undo' },
        { label: 'Повторить', role: 'redo' },
        { type: 'separator' },
        { label: 'Вырезать', role: 'cut' },
        { label: 'Копировать', role: 'copy' },
        { label: 'Вставить', role: 'paste' },
        { label: 'Выделить всё', role: 'selectAll' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Перезагрузить', role: 'reload' },
        { label: 'Инструменты разработчика', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Увеличить', role: 'zoomIn' },
        { label: 'Уменьшить', role: 'zoomOut' },
        { label: 'Сбросить масштаб', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Полный экран', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Навигация',
      submenu: [
        { label: 'Чаты', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.loadURL(`${SERVER_URL}/chats`) },
        { label: 'Блог', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.loadURL(`${SERVER_URL}/blog`) },
        { label: 'Уведомления', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.loadURL(`${SERVER_URL}/notifications`) },
        { label: 'Профиль', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.loadURL(`${SERVER_URL}/profile`) },
        { label: 'Админ-панель', accelerator: 'CmdOrCtrl+5', click: () => mainWindow?.loadURL(`${SERVER_URL}/admin`) }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

app.whenReady().then(async () => {
  console.log('Запуск ПРМ...');

  await startServer();
  console.log('Сервер запущен. Открываю окно...');

  createWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
