import { create } from 'zustand'
import type { Product, InventoryMovement, MovementType } from '../types'
import { generateId } from '../utils/generateId'
import { getAllProducts, upsertProduct } from '../db/products'
import { getMovementsByProduct, recordMovement as dbRecordMovement, getLowStockProducts } from '../db/inventory'

type SortColumn = 'name' | 'category' | 'price' | 'stock'
type SortDir = 'asc' | 'desc'

interface InventoryState {
  products: Product[]
  movements: InventoryMovement[]
  selectedProduct: Product | null
  isLoading: boolean
  error: string | null
  filter: string
  sortBy: SortColumn
  sortDir: SortDir
  lowStockCount: number

  loadProducts: () => Promise<void>
  loadMovements: (productId: string) => Promise<void>
  selectProduct: (product: Product | null) => void
  addProduct: (product: Product) => Promise<void>
  updateProduct: (product: Product) => Promise<void>
  archiveProduct: (id: string) => Promise<void>
  restoreProduct: (id: string) => Promise<void>
  adjustStock: (productId: string, type: MovementType, quantity: number, reason: string, reference?: string) => Promise<void>
  setFilter: (query: string) => void
  setSort: (column: SortColumn) => void
  loadLowStockCount: () => Promise<void>
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  movements: [],
  selectedProduct: null,
  isLoading: false,
  error: null,
  filter: '',
  sortBy: 'name',
  sortDir: 'asc',
  lowStockCount: 0,

  loadProducts: async () => {
    set({ isLoading: true, error: null })
    try {
      const products = await getAllProducts()
      set({ products, isLoading: false })
    } catch {
      set({ error: 'Error al cargar productos', isLoading: false })
    }
  },

  loadMovements: async (productId) => {
    try {
      const movements = await getMovementsByProduct(productId)
      set({ movements })
    } catch {
      set({ error: 'Error al cargar movimientos' })
    }
  },

  selectProduct: (product) => {
    set({ selectedProduct: product, movements: [] })
    if (product) get().loadMovements(product.id)
  },

  addProduct: async (product) => {
    await upsertProduct(product)
    await get().loadProducts()
  },

  updateProduct: async (product) => {
    await upsertProduct(product)
    await get().loadProducts()
    if (get().selectedProduct?.id === product.id) set({ selectedProduct: product })
  },

  archiveProduct: async (id) => {
    const p = get().products.find(x => x.id === id)
    if (!p) return
    await upsertProduct({ ...p, active: false })
    if (get().selectedProduct?.id === id) set({ selectedProduct: { ...p, active: false } })
    await get().loadProducts()
  },

  restoreProduct: async (id) => {
    const p = get().products.find(x => x.id === id)
    if (!p) return
    await upsertProduct({ ...p, active: true })
    if (get().selectedProduct?.id === id) set({ selectedProduct: { ...p, active: true } })
    await get().loadProducts()
  },

  adjustStock: async (productId, type, quantity, reason, reference) => {
    await dbRecordMovement(productId, type, quantity, reason, reference)
    await get().loadProducts()
    if (get().selectedProduct?.id === productId) await get().loadMovements(productId)
  },

  setFilter: (query) => set({ filter: query }),

  setSort: (column) => {
    const { sortBy, sortDir } = get()
    if (sortBy === column) set({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    else set({ sortBy: column, sortDir: 'asc' })
  },

  loadLowStockCount: async () => {
    try {
      const low = await getLowStockProducts()
      set({ lowStockCount: low.length })
    } catch { /* ignore */ }
  }
}))
