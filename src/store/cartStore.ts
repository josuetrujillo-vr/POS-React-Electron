import { create } from 'zustand'
import type { Product, CartItem, CartSummary, PaymentMethod } from '../types'
import { getProductById } from '../db/products'

/** IVA México: 16% incluido en precio */
const IVA_RATE = 0.16

interface CartState {
  // ─── Estado ──────────────────────────────────────────────────────────────
  items: CartItem[]
  /** Descuento global en pesos aplicado al total */
  globalDiscount: number
  paymentMethod: PaymentMethod
  cashReceived: number
  toast: { message: string; type: 'info' | 'error' | 'success' } | null

  // ─── Acciones ─────────────────────────────────────────────────────────────
  addItem: (product: Product) => Promise<void>
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => Promise<void>
  applyItemDiscount: (productId: string, discount: number) => void
  setGlobalDiscount: (discount: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setCashReceived: (amount: number) => void
  clear: () => void
  showToast: (message: string, type?: 'info' | 'error' | 'success') => void
  clearToast: () => void

  // ─── Selector derivado ────────────────────────────────────────────────────
  getSummary: () => CartSummary
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  globalDiscount: 0,
  paymentMethod: 'efectivo',
  cashReceived: 0,
  toast: null,

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
  },

  clearToast: () => {
    set({ toast: null })
  },

  /** Agrega un producto al carrito, o incrementa su cantidad si ya existe, validando contra la DB */
  addItem: async (product) => {
    // Obtener stock en disco actualizado
    const dbProduct = await getProductById(product.id)
    const currentStock = dbProduct ? dbProduct.stock : product.stock

    const existing = get().items.find(i => i.product.id === product.id)
    const currentQtyInCart = existing ? existing.quantity : 0

    if (currentStock <= 0) {
      get().showToast(`El producto "${product.name}" está agotado.`, 'error')
      return
    }

    if (currentQtyInCart + 1 > currentStock) {
      get().showToast(`Límite alcanzado: Solo hay ${currentStock} unidades disponibles de "${product.name}".`, 'error')
      return
    }

    set(state => {
      if (existing) {
        return {
          items: state.items.map(i =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        }
      }
      return {
        items: [...state.items, { product: { ...product, stock: currentStock }, quantity: 1, itemDiscount: 0 }]
      }
    })
  },

  /** Elimina un producto completamente del carrito */
  removeItem: (productId) => {
    set(state => ({
      items: state.items.filter(i => i.product.id !== productId)
    }))
  },

  /** Actualiza la cantidad de un item (0 = eliminar) con validación de stock */
  updateQuantity: async (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }

    const dbProduct = await getProductById(productId)
    if (!dbProduct) return

    const currentStock = dbProduct.stock

    if (quantity > currentStock) {
      get().showToast(`Límite alcanzado: Solo hay ${currentStock} unidades disponibles de "${dbProduct.name}".`, 'error')
      quantity = currentStock // Forzar el stock máximo
    }

    set(state => ({
      items: state.items.map(i =>
        i.product.id === productId ? { ...i, quantity, product: { ...i.product, stock: currentStock } } : i
      )
    }))
  },

  /** Aplica descuento en pesos a un item específico */
  applyItemDiscount: (productId, discount) => {
    set(state => ({
      items: state.items.map(i =>
        i.product.id === productId
          ? { ...i, itemDiscount: Math.max(0, discount) }
          : i
      )
    }))
  },

  /** Aplica descuento global en pesos al total */
  setGlobalDiscount: (discount) => {
    set({ globalDiscount: Math.max(0, discount) })
  },

  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setCashReceived: (amount) => set({ cashReceived: amount }),

  /** Limpia el carrito completamente después de una venta */
  clear: () => set({
    items: [],
    globalDiscount: 0,
    paymentMethod: 'efectivo',
    cashReceived: 0
  }),

  /**
   * Calcula el resumen del carrito.
   * IVA incluido en precio → se desglosa para el ticket.
   */
  getSummary: (): CartSummary => {
    const { items, globalDiscount } = get()

    const grossTotal = items.reduce((acc, item) => {
      const lineGross = item.product.price * item.quantity
      return acc + lineGross - item.itemDiscount
    }, 0)

    const totalDiscount = items.reduce((acc, i) => acc + i.itemDiscount, 0) + globalDiscount

    // Total final después de descuentos
    const total = Math.max(0, grossTotal - globalDiscount)

    // Desglose IVA (incluido): IVA = total * 16/116
    const ivaAmount = total * (IVA_RATE / (1 + IVA_RATE))
    const subtotalSinIva = total - ivaAmount

    return {
      items,
      grossTotal,
      totalDiscount,
      total,
      ivaAmount,
      subtotalSinIva
    }
  }
}))
