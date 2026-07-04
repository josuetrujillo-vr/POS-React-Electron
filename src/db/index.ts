import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Product, Sale, SyncQueueItem } from '../types'

/**
 * Schema de la base de datos IndexedDB.
 * Versión actual: 1
 *
 * Para añadir nuevos stores en el futuro, incrementar DB_VERSION
 * y agregar la migración en el bloque `upgrade`.
 */
interface PosDB extends DBSchema {
  products: {
    key: string
    value: Product
    indexes: {
      'by-category': string
      'by-barcode': string
    }
  }
  sales: {
    key: string
    value: Sale
    indexes: {
      'by-timestamp': string
      'by-sync-status': string
    }
  }
  sync_queue: {
    key: string
    value: SyncQueueItem
  }
}

const DB_NAME = 'pos-vaquero'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<PosDB> | null = null

/**
 * Obtiene (o inicializa) la instancia de la base de datos.
 * El patrón singleton asegura que solo existe una conexión abierta.
 */
export async function getDB(): Promise<IDBPDatabase<PosDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<PosDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      // ─── Migración v0 → v1 ────────────────────────────────────────────
      if (oldVersion < 1) {
        // Store de productos
        const productStore = db.createObjectStore('products', { keyPath: 'id' })
        productStore.createIndex('by-category', 'category')
        productStore.createIndex('by-barcode', 'barcode')

        // Store de ventas
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' })
        salesStore.createIndex('by-timestamp', 'timestamp')
        salesStore.createIndex('by-sync-status', 'syncStatus')

        // Cola de sincronización
        db.createObjectStore('sync_queue', { keyPath: 'saleId' })

        console.log('[DB] Base de datos inicializada (v1)')
      }

      // ─── Migración v1 → v2 (ejemplo para el futuro) ───────────────────
      // if (oldVersion < 2) {
      //   db.createObjectStore('customers', { keyPath: 'id' })
      // }
    },

    blocked() {
      console.warn('[DB] La base de datos está bloqueada por otra pestaña/ventana')
    },

    blocking() {
      // Nuestra versión está bloqueando una versión más nueva
      dbInstance?.close()
      dbInstance = null
    },

    terminated() {
      console.error('[DB] Conexión terminada inesperadamente')
      dbInstance = null
    }
  })

  return dbInstance
}

/**
 * Cierra la conexión con la base de datos.
 * Útil en tests o al cerrar la app.
 */
export function closeDB(): void {
  dbInstance?.close()
  dbInstance = null
}
