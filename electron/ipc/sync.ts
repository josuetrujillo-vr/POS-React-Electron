import { ipcMain } from 'electron'
import axios, { AxiosError } from 'axios'
import { config } from './printer'

// ─── Configuración de sincronización ─────────────────────────────────────
const SYNC_CONFIG = {
  /** Timeout por petición en ms */
  timeout: 10_000,
  /** Reintentos máximos por petición */
  maxRetries: 3,
  /** Base para retry exponencial en ms */
  retryBaseMs: 1_000
}

function getSyncUrl(): string {
  const syncUrl = (config.syncUrl as string) || process.env['SYNC_URL'] || 'http://127.0.0.1:3001/api/sales'
  return syncUrl.replace('://localhost:', '://127.0.0.1:')
}

function getHealthUrl(): string {
  return getSyncUrl().replace(/\/api\/sales\/?$/, '/health')
}

/**
 * Módulo de sincronización HTTP con el servidor remoto.
 *
 * Responsabilidades:
 * 1. Enviar ventas individuales o en lote al servidor
 * 2. Reintentar con backoff exponencial en caso de fallo
 * 3. Deduplicar por saleId (UUID) en el servidor
 *
 * EXTENSIÓN FUTURA — Terminal de Pagos:
 * Añadir handler 'payment:charge' aquí para integrar con
 * API de terminal bancaria (CLIP, iZettle, etc.)
 * Ver: src/services/paymentTerminal.stub.ts
 */
export function setupSyncHandlers(): void {

  // ─── Sincronizar una venta ────────────────────────────────────────────────
  ipcMain.handle('sync:sale', async (_event, sale: unknown) => {
    return await syncWithRetry(sale, SYNC_CONFIG.maxRetries)
  })

  // ─── Sincronizar lote de ventas ────────────────────────────────────────────
  ipcMain.handle('sync:batch', async (_event, sales: unknown[]) => {
    const results = { synced: [] as string[], failed: [] as string[] }

    for (const sale of sales) {
      const s = sale as { id?: string }
      const result = await syncWithRetry(sale, SYNC_CONFIG.maxRetries)
      if (result.success) {
        results.synced.push(s.id ?? 'unknown')
      } else {
        results.failed.push(s.id ?? 'unknown')
      }
    }

    return results
  })

  // ─── Verificar conectividad con el servidor ──────────────────────────────
  ipcMain.handle('sync:check-connection', async () => {
    try {
      await axios.get(getHealthUrl(), { timeout: 3000 })
      return true
    } catch (err) {
      const axiosErr = err as AxiosError
      // Si el servidor responde con cualquier status (404, 405, 500, etc.),
      // significa que el host está activo e interactuable en la red
      if (axiosErr.response) {
        return true
      }
      return false
    }
  })
}

// ─── Sincronización con reintentos exponenciales ──────────────────────────
async function syncWithRetry(
  sale: unknown,
  retriesLeft: number
): Promise<{ success: boolean; error?: string }> {
  const syncUrl = getSyncUrl()

  try {
    await axios.post(syncUrl, sale, {
      timeout: SYNC_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        // EXTENSIÓN: añadir 'Authorization': `Bearer ${token}` aquí
      }
    })
    return { success: true }
  } catch (err) {
    const axiosErr = err as AxiosError

    // Error 409 = venta ya existe en servidor (deduplicación) → marcar como OK
    if (axiosErr.response?.status === 409) {
      console.log('[Sync] Venta ya existe en servidor (409), marcando como sincronizada')
      return { success: true }
    }

    // Error permanente (400, 422) → no reintentar
    if (axiosErr.response && axiosErr.response.status < 500) {
      return { success: false, error: `Error del servidor: ${axiosErr.response.status}` }
    }

    // Error transitorio → reintentar con backoff exponencial
    if (retriesLeft > 0) {
      const delay = SYNC_CONFIG.retryBaseMs * (SYNC_CONFIG.maxRetries - retriesLeft + 1)
      console.log(`[Sync] Reintentando en ${delay}ms... (${retriesLeft} intentos restantes)`)
      await sleep(delay)
      return syncWithRetry(sale, retriesLeft - 1)
    }

    return { success: false, error: axiosErr.message || 'Error de red' }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
