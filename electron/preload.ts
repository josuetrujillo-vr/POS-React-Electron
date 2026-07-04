import { contextBridge, ipcRenderer } from 'electron'

/**
 * Bridge seguro entre el proceso renderer (React) y el proceso principal (Node/Electron).
 * Solo se exponen las funciones explícitamente definidas aquí.
 * El renderer nunca tiene acceso directo a Node APIs.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Impresión de tickets ────────────────────────────────────────────────
  /**
   * Imprime un ticket de venta en la impresora configurada.
   * @param receiptData - Datos del ticket (ver ReceiptData en types)
   * @returns { success: boolean; error?: string }
   */
  print: (receiptData: unknown) =>
    ipcRenderer.invoke('printer:print', receiptData),

  /**
   * Lista las impresoras disponibles conectadas al sistema.
   * @returns string[] - nombres de impresoras
   */
  listPrinters: () =>
    ipcRenderer.invoke('printer:list'),

  // ─── Sincronización con servidor ─────────────────────────────────────────
  /**
   * Sincroniza una venta con el servidor remoto.
   * @param sale - Objeto Sale completo
   * @returns { success: boolean; error?: string }
   */
  syncSale: (sale: unknown) =>
    ipcRenderer.invoke('sync:sale', sale),

  /**
   * Sincroniza todas las ventas pendientes en la cola.
   * @param sales - Array de ventas pendientes
   * @returns { synced: string[]; failed: string[] }
   */
  syncBatch: (sales: unknown[]) =>
    ipcRenderer.invoke('sync:batch', sales),

  /**
   * Verifica conectividad real con el servidor de sincronización.
   * @returns boolean
   */
  checkConnection: () =>
    ipcRenderer.invoke('sync:check-connection'),

  // ─── Configuración ───────────────────────────────────────────────────────
  /**
   * Lee configuración persistente del proceso principal.
   * @param key - clave de configuración
   */
  getConfig: (key: string) =>
    ipcRenderer.invoke('config:get', key),

  /**
   * Guarda configuración persistente.
   */
  setConfig: (key: string, value: unknown) =>
    ipcRenderer.invoke('config:set', key, value),

  // ─── Utilidades del sistema ───────────────────────────────────────────────
  /** Versión actual de la app */
  getVersion: () => ipcRenderer.invoke('app:version')
})

// ─── Tipos para TypeScript en el renderer ─────────────────────────────────
// (Ver src/types/electron.d.ts para las declaraciones de tipo)
