import { create } from 'zustand'
import type { Sale } from '../types'
import { getSalesToday } from '../db/sales'

interface SalesState {
  todaySales: Sale[]
  isLoading: boolean
  error: string | null

  loadToday: () => Promise<void>
  addSale: (sale: Sale) => void
}

export const useSalesStore = create<SalesState>((set) => ({
  todaySales: [],
  isLoading: false,
  error: null,

  /** Carga las ventas del día desde IndexedDB */
  loadToday: async () => {
    set({ isLoading: true, error: null })
    try {
      const sales = await getSalesToday()
      // Ordenar por timestamp descendente (más reciente primero)
      sales.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      set({ todaySales: sales, isLoading: false })
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  /** Agrega una venta al estado local sin recargar desde DB */
  addSale: (sale) => {
    set(state => ({
      todaySales: [sale, ...state.todaySales]
    }))
  }
}))
