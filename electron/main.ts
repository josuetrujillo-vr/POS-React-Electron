import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { setupPrinterHandlers } from './ipc/printer'
import { setupSyncHandlers } from './ipc/sync'

// ─── NUEVO: Importar Express ───────────────────────────────────────────────
import express from 'express'
import cors from 'cors'
import fs from 'fs'

// ─── NUEVO: Servidor Express embebido ──────────────────────────────────────
const BACKEND_PORT = 3001
const appBackend = express()
appBackend.use(cors())
appBackend.use(express.json({ limit: '2mb' }))

// Ruta para almacenar datos persistentes (dentro de userData)
const DATA_FILE = join(app.getPath('userData'), 'sales.json')

// Cargar datos al iniciar
function loadSales(): Map<string, any> {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

// Guardar datos al modificar
function saveSales(salesMap: Map<string, any>) {
  const obj = Object.fromEntries(salesMap)
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2))
}

// Inicializar almacenamiento
const seenSales = loadSales()

// ─── Endpoints del servidor ────────────────────────────────────────────────
appBackend.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

appBackend.post('/api/sales', (req, res) => {
  const sale = req.body
  const saleId = sale?.id

  if (!saleId || typeof saleId !== 'string') {
    return res.status(400).json({ error: 'Missing sale.id (UUID)' })
  }

  if (seenSales.has(saleId)) {
    return res.status(409).json({ error: 'Sale already synced', saleId })
  }

  seenSales.set(saleId, sale)
  saveSales(seenSales) // Persistir en disco

  return res.status(200).json({ ok: true, saleId })
})

// Iniciar servidor en segundo plano (sin bloquear el hilo principal)
appBackend.listen(BACKEND_PORT, '127.0.0.1', () => {
  console.log(`[Backend] Servidor local corriendo en http://127.0.0.1:${BACKEND_PORT}`)
})

// ─── Fin del servidor embebido ─────────────────────────────────────────────

// ─── Resto de tu código (sin cambios) ──────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'POS Vaquero',
    backgroundColor: '#1a1208',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  createWindow()

  // Registrar handlers IPC para impresora y sincronización
  setupPrinterHandlers()
  setupSyncHandlers()  // ⚠️ Este handler ahora debe apuntar al servidor local

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
})