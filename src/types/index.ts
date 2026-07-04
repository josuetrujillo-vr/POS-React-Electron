/**
 * Tipos compartidos entre el renderer (React) y el proceso principal (Electron).
 * Fuente única de verdad para las estructuras de datos de la aplicación.
 */

// ─── Producto ─────────────────────────────────────────────────────────────

export type ProductCategory =
  | 'pantalones'
  | 'sombreros'
  | 'camisas'
  | 'botas'
  | 'cintos'
  | 'accesorios'
  | 'chamarras'
  | 'otros'

export interface Product {
  id: string
  name: string
  category: ProductCategory
  price: number      // Precio con IVA incluido (MXN)
  stock: number
  barcode?: string
  description?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

// ─── Carrito ──────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product
  quantity: number
  /** Descuento por item en pesos (no porcentaje) */
  itemDiscount: number
}

export interface CartSummary {
  items: CartItem[]
  /** Total bruto sin descuentos */
  grossTotal: number
  /** Descuento total aplicado */
  totalDiscount: number
  /** Total final (IVA incluido) */
  total: number
  /** IVA desglosado del total (para el ticket) */
  ivaAmount: number
  /** Subtotal sin IVA (para el ticket) */
  subtotalSinIva: number
}

// ─── Venta ────────────────────────────────────────────────────────────────

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'

export type SaleStatus = 'pending_sync' | 'synced' | 'sync_error'

export interface SaleItem {
  productId: string
  productName: string
  category: ProductCategory
  quantity: number
  unitPrice: number   // Precio unitario con IVA
  itemDiscount: number
  lineTotal: number   // (unitPrice × qty) - itemDiscount
}

export interface Sale {
  /** UUID único generado localmente — garantiza deduplicación en el servidor */
  id: string
  /** Número legible para el ticket: "0001", "0002", etc. */
  saleNumber: string
  items: SaleItem[]
  subtotalSinIva: number
  ivaAmount: number
  totalDiscount: number
  total: number
  paymentMethod: PaymentMethod
  /** Efectivo recibido (para calcular cambio) */
  cashReceived?: number
  cashier?: string
  timestamp: string
  syncStatus: SaleStatus
  syncedAt?: string
  /** Error de sincronización si aplica */
  syncError?: string
}

// ─── Sincronización ───────────────────────────────────────────────────────

export interface SyncQueueItem {
  saleId: string
  sale: Sale
  attempts: number
  lastAttempt?: string
}

// ─── Ticket (para impresora) ──────────────────────────────────────────────

export interface ReceiptData {
  saleNumber: string
  timestamp: string
  items: Array<{ name: string; qty: number; price: number }>
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  cashReceived?: number
  cashier?: string
}

// ─── Configuración de la app ──────────────────────────────────────────────

export interface AppConfig {
  businessName: string
  businessAddress: string
  taxRate: number         // 16 para IVA México
  currency: string        // 'MXN'
  syncUrl: string
  printerType: 'usb' | 'network' | 'none'
  printerHost: string
  printerPort: number
}

// ─── Declaración de tipos para window.electronAPI ────────────────────────

declare global {
  interface Window {
    electronAPI: {
      print: (receiptData: ReceiptData) => Promise<{ success: boolean; error?: string }>
      listPrinters: () => Promise<{ success: boolean; devices: unknown[]; error?: string }>
      syncSale: (sale: Sale) => Promise<{ success: boolean; error?: string }>
      syncBatch: (sales: Sale[]) => Promise<{ synced: string[]; failed: string[] }>
      checkConnection: () => Promise<boolean>
      getConfig: (key: string) => Promise<unknown>
      setConfig: (key: string, value: unknown) => Promise<boolean>
      getVersion: () => Promise<string>
    }
  }
}
