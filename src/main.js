const { app, Tray, Menu, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const WebSocket = require('ws'); // Asegúrate de tener ws instalado
const fs = require('fs');
const RPC = require('discord-rpc');

let mainWindow = null;
let tray = null;
let rpc = null;
let currentAnimeData = null;
let wss = null;

const clientId = '1091818330186338484';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    transparent: true,
    resizable: false
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('blur', () => mainWindow.hide());
}

function toggleWindow() {
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

// Servidor WebSocket
function startWebSocketServer() {
  wss = new WebSocket.Server({ port: 9876, host: '0.0.0.0' }); // Escucha en todas las interfaces
  console.log('✅ Servidor WebSocket escuchando en ws://localhost:9876');

  wss.on('connection', (ws) => {
    console.log('🔌 Extensión conectada');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📦 Datos recibidos:', data);

        if (data.type === 'update') {
          currentAnimeData = data.payload;
          updateDiscordPresence(currentAnimeData);
          if (mainWindow) mainWindow.webContents.send('anime-data', currentAnimeData);
          ws.send(JSON.stringify({ status: 'ok' }));
        } else if (data.type === 'clear') {
          console.log('🧹 Limpiando presencia');
          if (rpc) rpc.clearActivity().catch(console.error);
          currentAnimeData = null;
          if (mainWindow) mainWindow.webContents.send('anime-data', null);
          ws.send(JSON.stringify({ status: 'cleared' }));
        } else if (data.type === 'status') {
          ws.send(JSON.stringify({ running: true, currentAnime: currentAnimeData }));
        }
      } catch (e) {
        console.error('❌ Error parseando mensaje:', e);
      }
    });

    ws.on('close', () => console.log('🔌 Extensión desconectada'));
  });
}

// Actualizar Discord RPC
function updateDiscordPresence(data) {
  if (!rpc) return;
  if (!data || typeof data !== 'object') return;

  const titulo = data.titulo || 'Anime desconocido';
  const episodio = data.episodio || '?';
  const generos = Array.isArray(data.generos)
    ? data.generos.filter(g => !g.includes('Términos') && !g.includes('Política') && !g.includes('Condiciones'))
    : [];
  const url = data.url || 'https://animeav1.com';
  const imagen = data.imagen || '';
  const generosStr = generos.slice(0, 3).join(', ') || 'Géneros no disponibles';

  const activity = {
    name: titulo,
    details: titulo,
    state: `Episodio ${episodio}`,
    largeImageText: generosStr,
    buttons: [
      { label: 'Ver Anime', url: url },
      { label: 'Descargar Rippa', url: 'https://github.com/Vicemi/Rippa' }
    ]
  };

  if (imagen) activity.largeImageKey = imagen;
  else activity.largeImageKey = 'logo';

  rpc.setActivity(activity)
    .then(() => console.log('✅ Presencia actualizada'))
    .catch(err => console.error('Error al actualizar presencia:', err));
}

function initDiscordRPC() {
  rpc = new RPC.Client({ transport: 'ipc' });
  rpc.on('ready', () => {
    console.log('✅ Discord RPC conectado');
    if (currentAnimeData) updateDiscordPresence(currentAnimeData);
  });
  rpc.on('disconnected', () => {
    console.log('Discord RPC desconectado, reintentando en 10 segundos...');
    setTimeout(initDiscordRPC, 10000);
  });
  rpc.login({ clientId }).catch(err => {
    console.error('❌ Error al conectar Discord RPC (reintentando en 10 segundos):', err.message);
    setTimeout(initDiscordRPC, 10000);
  });
}

function getExtensionPath() {
  const devPath = path.join(__dirname, 'extension');
  if (fs.existsSync(devPath)) return devPath;
  return path.join(process.resourcesPath, 'extension');
}

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
  initDiscordRPC();

  app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });

  const iconPath = path.join(__dirname, '..', 'tray-icon.png');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar/Ocultar', click: toggleWindow },
    { label: 'Abrir carpeta de extensión', click: () => {
        const extPath = getExtensionPath();
        shell.openPath(extPath).catch(() => shell.showItemInFolder(extPath));
    }},
    { label: 'Abrir al inicio', type: 'checkbox', checked: true, click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
    }},
    { label: 'Salir', click: () => app.quit() }
  ]);
  tray.setToolTip('Rippa');
  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
});

ipcMain.on('close-window', () => mainWindow.hide());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});