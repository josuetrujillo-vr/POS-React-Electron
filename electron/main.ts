import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { setupPrinterHandlers } from './ipc/printer'
import { setupSyncHandlers } from './ipc/sync'

// ─── Seguridad: deshabilitar remote module ─────────────────────────────────
// (ya deshabilitado por defecto en Electron 14+)

let mainWindow: BrowserWindow | null = null

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

// ─── Ciclo de vida de la app ───────────────────────────────────────────────
app.whenReady().then(() => {
  // Preferir tema oscuro
  nativeTheme.themeSource = 'dark'

  createWindow()

  // Registrar handlers IPC para impresora y sincronización
  setupPrinterHandlers()
  setupSyncHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Handler genérico de errores no capturados ────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
})
