import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import getPort from 'get-port';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
process.env.DIST_ELECTRON = path.join(__dirname, '..');
process.env.DIST = path.join(process.env.DIST_ELECTRON, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (require('os').release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Express server process
let serverProcess: ChildProcess | null = null;
let SERVER_PORT = 5000; // Default port, will be dynamically assigned
let SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Remove electron security warnings
// This is only needed for dev mode, it doesn't affect the production builds.
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = path.join(__dirname, '../preload/index.js');
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = path.join(process.env.DIST, 'index.html');

async function createWindow() {
  win = new BrowserWindow({
    title: '1SOLUTION - Car Wash POS',
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload,
      // Warning: Enabling nodeIntegration and disabling contextIsolation is not secure in production!
      // Consider using contextBridge.exposeInMainWorld instead.
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    show: false, // Don't show until ready
    autoHideMenuBar: true,
    titleBarStyle: 'default',
  });

  // Test actively push message to the Electron-Renderer
  win.webContents.on('dom-ready', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the Express server once it's ready
  if (url) { // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    // Wait for server to be ready then load
    await waitForServer();
    win.loadURL(SERVER_URL);
  }

  // Make window visible when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win?.show();
    
    if (process.env.NODE_ENV === 'development') {
      win?.webContents.openDevTools();
    }
  });

  // Handle window closed
  win.on('closed', () => {
    win = null;
  });
}

async function startExpressServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, server should already be running via npm run dev
      // Try to get the port from the development server or use default
      try {
        SERVER_PORT = await getPort({ port: getPort.makeRange(5000, 5010) });
        SERVER_URL = `http://localhost:${SERVER_PORT}`;
      } catch (error) {
        console.warn('Could not get dynamic port, using default 5000:', error);
      }
      resolve();
      return;
    }

    // In production, get an available port and start the built server
    try {
      SERVER_PORT = await getPort({ port: getPort.makeRange(5000, 5010) });
      SERVER_URL = `http://localhost:${SERVER_PORT}`;
    } catch (error) {
      console.warn('Could not get dynamic port, using default 5000:', error);
    }

    const serverPath = path.join(process.env.DIST_ELECTRON, '../dist/index.js');
    
    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server file not found: ${serverPath}`));
      return;
    }

    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: SERVER_PORT.toString(),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes(`serving on port ${SERVER_PORT}`)) {
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 30000);
  });
}

async function waitForServer(): Promise<void> {
  return new Promise((resolve) => {
    const checkServer = async () => {
      try {
        const response = await fetch(SERVER_URL + '/api/health');
        if (response.ok) {
          resolve();
        } else {
          setTimeout(checkServer, 1000);
        }
      } catch {
        setTimeout(checkServer, 1000);
      }
    };
    checkServer();
  });
}

app.whenReady().then(async () => {
  try {
    if (!url) {
      // Only start server in production
      await startExpressServer();
    }
    await createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the application: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  win = null;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (url) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadURL(`${SERVER_URL}#${arg}`);
  }
});

// Handle app exit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Add health check endpoint handler
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('app-name', () => {
  return app.getName();
});

// Handle API base URL requests
ipcMain.handle('get-api-base-url', () => {
  return SERVER_URL;
});