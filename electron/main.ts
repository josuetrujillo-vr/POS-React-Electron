import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { fork, ChildProcess } from 'child_process'
import { setupPrinterHandlers } from './ipc/printer'
import { setupSyncHandlers } from './ipc/sync'

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

/**
 * Crea la ventana principal de la aplicación.
 * Configurada con contextIsolation y sandbox para máxima seguridad.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'POS Vaquero',
    backgroundColor: '#1a1208', // color de fondo mientras carga
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,   // Aísla el contexto del renderer
      nodeIntegration: false,   // El renderer NO tiene acceso a Node directamente
      sandbox: false            // false para poder usar el preload con Node APIs
    }
  })

  // ─── Carga la app ─────────────────────────────────────────────────────────
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Modo desarrollo: Vite dev server
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Modo producción: archivo compilado
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // ─── Abre enlaces externos en el navegador del sistema ────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // ─── DevTools solo en desarrollo ──────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Sync server como child process ────────────────────────────────────────
function startSyncServer(): void {
  if (app.isPackaged) {
    const serverPath = join(process.resourcesPath, 'server-local', 'index.js')
    serverProcess = fork(serverPath, { stdio: 'pipe' })
    serverProcess.on('error', (err) => console.error('[Main] Sync server error:', err))
    serverProcess.on('exit', (code) => {
      console.log(`[Main] Sync server exited with code ${code}`)
      serverProcess = null
    })
  }
}

function stopSyncServer(): void {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

// ─── Ciclo de vida de la app ───────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'

  startSyncServer()
  createWindow()
  setupPrinterHandlers()
  setupSyncHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopSyncServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Handler genérico de errores no capturados ────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
})
