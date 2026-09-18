// @ts-check
const { app, BrowserWindow, Menu, Tray, desktopCapturer, ipcMain, nativeImage, session, shell } = require('electron');
const path = require('node:path');
const config = require('../app.config.json');

// O app carrega o próprio site: melhorias publicadas no GitHub Pages chegam sem reinstalar.
const APP_URL = process.env.JANJA_URL || (app.isPackaged ? config.url : 'http://localhost:5173');
const APP_ORIGIN = new URL(APP_URL).origin;
const ICON = path.join(__dirname, '..', 'build', 'icon.png');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

function isAppOrigin(/** @type {string | undefined} */ url) {
  try {
    return !!url && new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.on('before-quit', () => (quitting = true));
  app.whenReady().then(() => {
    app.setAppUserModelId('com.janja.app');
    Menu.setApplicationMenu(null);
    setupPermissions();
    setupScreenShare();
    createMainWindow();
    createTray();
  });
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: 'Janja',
    icon: ICON,
    backgroundColor: '#313338',
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false, // mantém a chamada estável com a janela minimizada
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.loadURL(APP_URL);

  const contents = mainWindow.webContents;

  // Sem internet ou servidor fora do ar: mostra uma tela com botão de tentar de novo.
  contents.on('did-fail-load', (_event, _code, _description, url, isMainFrame) => {
    if (isMainFrame && isAppOrigin(url)) {
      mainWindow?.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } });
    }
  });

  // Links externos abrem no navegador padrão, nunca dentro do app.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isAppOrigin(url)) return;
    event.preventDefault();
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
  });

  // Atalhos úteis, já que o menu padrão foi removido.
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (ctrl && input.shift && input.key.toLowerCase() === 'i') contents.toggleDevTools();
    else if ((ctrl && input.key.toLowerCase() === 'r') || input.key === 'F5') contents.reload();
    else return;
    event.preventDefault();
  });

  // Fechar a janela só esconde (fica na bandeja), como o Discord. Sair de verdade é pelo menu da bandeja.
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on('closed', () => (mainWindow = null));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Janja');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Janja', click: showMainWindow },
      { type: 'separator' },
      { label: 'Sair do Janja', click: () => app.quit() },
    ]),
  );
  tray.on('click', showMainWindow);
}

const ALLOWED_PERMISSIONS = new Set([
  'media',
  'display-capture',
  'notifications',
  'fullscreen',
  'speaker-selection',
  'clipboard-sanitized-write',
]);

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(origin);
  });
}

// No Electron, getDisplayMedia() não tem seletor embutido no Windows: mostramos o nosso.
function setupScreenShare() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isAppOrigin(request.securityOrigin) || !mainWindow) return callback({});
    try {
      const choice = await pickSource(request.audioRequested);
      if (!choice) return callback({});
      callback({ video: choice.source, ...(choice.audio && { audio: 'loopback' }) });
    } catch (error) {
      console.error(error);
      callback({});
    }
  });
}

/**
 * @param {boolean} audioRequested
 * @returns {Promise<{ source: Electron.DesktopCapturerSource, audio: boolean } | null>}
 */
async function pickSource(audioRequested) {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  const picker = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 780,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Compartilhar tela',
    icon: ICON,
    backgroundColor: '#313338',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'picker-preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  picker.setMenu(null);

  const payload = {
    // Capturar o áudio do sistema só é suportado no Windows.
    audioSupported: audioRequested && process.platform === 'win32',
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail.toDataURL(),
      icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
    })),
  };

  return new Promise((resolve) => {
    let settled = false;
    /** @param {{ source: Electron.DesktopCapturerSource, audio: boolean } | null} result */
    const finish = (result) => {
      if (settled) return;
      settled = true;
      ipcMain.off('picker:choose', onChoose);
      ipcMain.off('picker:cancel', onCancel);
      if (!picker.isDestroyed()) picker.close();
      resolve(result);
    };
    /** @param {Electron.IpcMainEvent} event @param {{ id: string, audio: boolean }} choice */
    const onChoose = (event, choice) => {
      if (event.sender !== picker.webContents) return;
      const source = sources.find((s) => s.id === choice?.id);
      finish(source ? { source, audio: payload.audioSupported && !!choice.audio } : null);
    };
    /** @param {Electron.IpcMainEvent} event */
    const onCancel = (event) => {
      if (event.sender === picker.webContents) finish(null);
    };

    ipcMain.on('picker:choose', onChoose);
    ipcMain.on('picker:cancel', onCancel);
    picker.on('closed', () => finish(null));
    picker.webContents.once('did-finish-load', () => {
      picker.webContents.send('picker:sources', payload);
      picker.show();
    });
    picker.loadFile(path.join(__dirname, 'picker.html'));
  });
}
