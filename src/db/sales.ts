import { getDB } from './index'
import type { Sale, SaleStatus, SyncQueueItem } from '../types'
import { recordMovement } from './inventory'

/**
 * Capa de acceso a datos para ventas y cola de sincronización.
 */

// ─── Ventas ───────────────────────────────────────────────────────────────

/** Guarda una venta completa, actualiza el stock local y la encola para sincronización */
export async function saveSale(sale: Sale): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['sales', 'sync_queue', 'products'], 'readwrite')

  // Guardar la venta
  await tx.objectStore('sales').add(sale)

  // Agregar a la cola de sync (siempre, se marca como synced después)
  const queueItem: SyncQueueItem = {
    saleId: sale.id,
    sale,
    attempts: 0
  }
  await tx.objectStore('sync_queue').add(queueItem)

  // Decrementar stock de los productos vendidos
  for (const item of sale.items) {
    const productStore = tx.objectStore('products')
    const product = await productStore.get(item.productId)
    if (product) {
      product.stock = Math.max(0, product.stock - item.quantity)
      product.updatedAt = new Date().toISOString()
      await productStore.put(product)
    }
  }

  await tx.done

  for (const item of sale.items) {
    await recordMovement(item.productId, 'out', item.quantity, 'venta', sale.id)
  }
}

/** Obtiene una venta por su ID */
export async function getSaleById(id: string): Promise<Sale | undefined> {
  const db = await getDB()
  return db.get('sales', id)
}

/** Obtiene todas las ventas del día actual */
export async function getSalesToday(): Promise<Sale[]> {
  const db = await getDB()
  const allSales = await db.getAllFromIndex('sales', 'by-timestamp')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  return allSales.filter(sale => sale.timestamp >= todayStr)
}

/** Obtiene ventas en un rango de fechas */
export async function getSalesByDateRange(from: Date, to: Date): Promise<Sale[]> {
  const db = await getDB()
  const allSales = await db.getAllFromIndex('sales', 'by-timestamp')

  const fromStr = from.toISOString()
  const toStr = to.toISOString()

  return allSales.filter(s => s.timestamp >= fromStr && s.timestamp <= toStr)
}

/** Obtiene ventas pendientes de sincronización */
export async function getPendingSales(): Promise<Sale[]> {
  const db = await getDB()
  return db.getAllFromIndex('sales', 'by-sync-status', 'pending_sync')
}

/** Actualiza el estado de sincronización de una venta */
export async function updateSyncStatus(
  saleId: string,
  status: SaleStatus,
  error?: string
): Promise<void> {
  const db = await getDB()
  const sale = await db.get('sales', saleId)
  if (!sale) return

  await db.put('sales', {
    ...sale,
    syncStatus: status,
    syncedAt: status === 'synced' ? new Date().toISOString() : sale.syncedAt,
    syncError: error
  })
}

// ─── Cola de sincronización ───────────────────────────────────────────────

/** Obtiene todos los ítems de la cola de sync pendientes */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB()
  return db.getAll('sync_queue')
}

/** Marca una venta como sincronizada: remueve de la cola y actualiza la venta */
export async function markSynced(saleId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['sales', 'sync_queue'], 'readwrite')

  // Eliminar de la cola
  await tx.objectStore('sync_queue').delete(saleId)

  // Actualizar estado en ventas
  const sale = await tx.objectStore('sales').get(saleId)
  if (sale) {
    await tx.objectStore('sales').put({
      ...sale,
      syncStatus: 'synced' as SaleStatus,
      syncedAt: new Date().toISOString()
    })
  }

  await tx.done
}

/** Marca un intento fallido de sync y actualiza el contador de intentos */
export async function markSyncFailed(saleId: string, error: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['sales', 'sync_queue'], 'readwrite')

  // Actualizar contador en cola
  const queueItem = await tx.objectStore('sync_queue').get(saleId)
  if (queueItem) {
    await tx.objectStore('sync_queue').put({
      ...queueItem,
      attempts: queueItem.attempts + 1,
      lastAttempt: new Date().toISOString()
    })
  }

  // Actualizar error en venta
  const sale = await tx.objectStore('sales').get(saleId)
  if (sale) {
    await tx.objectStore('sales').put({
      ...sale,
      syncStatus: 'sync_error' as SaleStatus,
      syncError: error
    })
  }

  await tx.done
}

/** Obtiene el último número de venta del día para generar el siguiente */
export async function getLastSaleNumber(): Promise<number> {
  const todaySales = await getSalesToday()
  if (todaySales.length === 0) return 0
  // Extraer el número más alto del día
  const numbers = todaySales.map(s => parseInt(s.saleNumber.replace(/\D/g, '')) || 0)
  return Math.max(...numbers)
}
