import { create } from 'zustand'
import { syncService } from '../services/syncService'
import { getSyncQueue } from '../db/sales'
import { useSalesStore } from './salesStore'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  lastSyncError: string | null

  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  /** Fuerza una sincronización inmediata de todas las ventas pendientes */
  forceSync: () => Promise<void>
  /** Recarga el contador de pendientes desde la DB */
  refreshPendingCount: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastSyncError: null,

  setOnline: (online) => set({ isOnline: online }),

  setPendingCount: (count) => set({ pendingCount: count }),

  forceSync: async () => {
    if (!get().isOnline || get().isSyncing) return

    if (window.electronAPI?.checkConnection) {
      const serverReachable = await window.electronAPI.checkConnection()
      if (!serverReachable) {
        set({ isOnline: false })
        return
      }
    }

    set({ isSyncing: true, lastSyncError: null })
    try {
      const result = await syncService.flushQueue()
      set({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        pendingCount: result.remainingPending
      })
      // Actualizar la UI si hubo cambios
      if (result.synced.length > 0 || result.failed.length > 0) {
        useSalesStore.getState().loadToday()
      }
    } catch (err) {
      set({
        isSyncing: false,
        lastSyncError: String(err)
      })
    }
  },

  refreshPendingCount: async () => {
    try {
      const queue = await getSyncQueue()
      set({ pendingCount: queue.length })
    } catch (_err) {
      // Ignorar errores silenciosamente
    }
  }
}))
