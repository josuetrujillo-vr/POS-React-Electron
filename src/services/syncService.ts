import type { Sale } from '../types'
import { getSyncQueue, markSynced, markSyncFailed } from '../db/sales'

/**
 * Servicio de sincronización con el servidor remoto.
 *
 * Responsabilidades:
 * - Leer la cola de sync desde IndexedDB
 * - Enviar cada venta al proceso principal de Electron (IPC)
 * - Marcar como sincronizada o fallida según el resultado
 * - Retornar resumen de la operación
 *
 * EXTENSIÓN FUTURA — Terminal de Pagos:
 * Cuando se integre una terminal bancaria, agregar aquí
 * `syncPaymentTransaction(txId)` siguiendo el mismo patrón.
 */

interface FlushResult {
  /** IDs de ventas sincronizadas exitosamente */
  synced: string[]
  /** IDs de ventas que fallaron */
  failed: string[]
  /** Ventas que aún quedan pendientes en la cola */
  remainingPending: number
}

class SyncService {
  private isFlushing = false

  /**
   * Procesa todas las ventas en la cola de sincronización.
   * Es idempotente: puede llamarse múltiples veces sin efectos secundarios.
   */
  async flushQueue(): Promise<FlushResult> {
    if (this.isFlushing) {
      console.log('[SyncService] flushQueue llamado pero ya hay un flush en curso. Ignorando.')
      return { synced: [], failed: [], remainingPending: -1 }
    }

    this.isFlushing = true
    const result: FlushResult = { synced: [], failed: [], remainingPending: 0 }

    try {
      const queue = await getSyncQueue()

      if (queue.length === 0) {
        return result
      }

      const now = new Date()
      // Filtrar ítems elegibles según backoff exponencial
      const eligibleItems = queue.filter(item => {
        const attempts = item.attempts ?? 0
        const lastAttempt = item.lastAttempt

        if (!attempts || !lastAttempt) {
          console.log(`[SyncService] Elegible inmediato: saleId=${item.saleId} attempts=${attempts} lastAttempt=${String(lastAttempt)}`)
          return true // Sin intentos previos, elegible inmediatamente
        }

        // Delay exponencial: 5s, 10s, 20s, 40s... máx 5 minutos (300,000ms)
        const delayMs = Math.min(5000 * Math.pow(2, attempts - 1), 5 * 60 * 1000)
        const nextAttemptTime = new Date(lastAttempt).getTime() + delayMs
        const eligible = now.getTime() >= nextAttemptTime

        console.log(
          `[SyncService] Backoff check: saleId=${item.saleId} attempts=${attempts} lastAttempt=${lastAttempt} delayMs=${delayMs} nextAttempt=${new Date(nextAttemptTime).toISOString()} eligible=${eligible}`
        )
        return eligible
      })

      if (eligibleItems.length === 0) {
        console.log(`[SyncService] Hay ${queue.length} ventas pendientes, pero ninguna es elegible para reintento todavía (dentro de periodo de backoff).`)
        result.remainingPending = queue.length
        return result
      }

      console.log(`[SyncService] Procesando ${eligibleItems.length} ventas elegibles de ${queue.length} pendientes...`)

      // Verificar que tenemos acceso al IPC de Electron
      if (!window.electronAPI) {
        throw new Error('No hay conexión con el proceso principal de Electron')
      }

      // Enviar en lote para eficiencia
      const sales = eligibleItems.map(item => item.sale)
      console.log('[SyncService] Enviando batch al main:', {
        eligibleCount: eligibleItems.length,
        saleIds: sales.map(s => (s as any).id).filter(Boolean)
      })

      const batchResult = await window.electronAPI.syncBatch(sales)
      console.log('[SyncService] Resultado batch:', {
        syncedCount: batchResult.synced.length,
        failedCount: batchResult.failed.length,
        synced: batchResult.synced,
        failed: batchResult.failed
      })

      // Procesar resultados
      for (const saleId of batchResult.synced) {
        console.log(`[SyncService] MarkSynced: saleId=${saleId}`)
        await markSynced(saleId)
        result.synced.push(saleId)
        console.log(`[SyncService] Venta ${saleId} sincronizada exitosamente.`)
      }

      for (const saleId of batchResult.failed) {
        console.warn(`[SyncService] MarkSyncFailed: saleId=${saleId}`)
        await markSyncFailed(saleId, 'Error de sincronización remota')
        result.failed.push(saleId)
        console.warn(`[SyncService] Falló la sincronización de la venta ${saleId}.`)
      }

      // Contar pendientes restantes
      const remaining = await getSyncQueue()
      result.remainingPending = remaining.length

      console.log(`[SyncService] Sync completado: ${result.synced.length} OK, ${result.failed.length} fallidas, ${result.remainingPending} pendientes totales`)
    } catch (err) {
      console.error('[SyncService] Error en flush:', err)
      throw err
    } finally {
      this.isFlushing = false
    }

    return result
  }

  /**
   * Sincroniza una sola venta inmediatamente.
   * Redirige a flushQueue para procesar de forma ordenada y segura dentro del ciclo único.
   */
  async syncOne(sale: Sale): Promise<boolean> {
    console.log(`[SyncService] Recibida venta individual ${sale.id} para sync. Sincronizando en ciclo único...`)
    await this.flushQueue()
    return true
  }
}

/** Instancia singleton del servicio de sincronización */
export const syncService = new SyncService()
