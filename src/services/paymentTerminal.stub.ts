/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STUB: Integración con Terminal de Pagos (TPV)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Este archivo documenta la interfaz que debe implementar cualquier integración
 * con una terminal bancaria o TPV. La app POS ya está preparada para recibirla
 * sin modificar el código existente.
 *
 * Para activar:
 * 1. Implementar PaymentTerminalAdapter para tu proveedor (CLIP, iZettle, etc.)
 * 2. Instanciar en CheckoutScreen y llamar `terminal.charge(amount)` antes de
 *    guardar la venta localmente.
 * 3. Agregar handler IPC en electron/ipc/sync.ts si la terminal requiere Node.
 *
 * Proveedores conocidos:
 * - CLIP (México): REST API + SDK web
 * - iZettle/PayPal Zettle: SDK de JavaScript
 * - Conekta: REST API
 * - Stripe Terminal: SDK de JS + lector de tarjetas
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Interfaz que cualquier terminal debe implementar ─────────────────────

export interface PaymentTerminalAdapter {
  /** Nombre del proveedor (para logs) */
  readonly name: string

  /** Inicializa la conexión con la terminal */
  init(config: TerminalConfig): Promise<void>

  /** Cobra un monto al cliente */
  charge(amount: number, reference: string): Promise<ChargeResult>

  /** Cancela una operación en curso */
  cancel(): Promise<void>

  /** Realiza una devolución */
  refund(transactionId: string, amount: number): Promise<RefundResult>

  /** Verifica si la terminal está conectada */
  isConnected(): boolean
}

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface TerminalConfig {
  apiKey?: string
  terminalId?: string
  environment: 'sandbox' | 'production'
}

export interface ChargeResult {
  success: boolean
  transactionId?: string
  authCode?: string
  cardBrand?: string       // VISA, MASTERCARD, AMEX, etc.
  lastFourDigits?: string
  error?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

// ─── Ejemplo de implementación mínima (mock para desarrollo) ──────────────

export class MockPaymentTerminal implements PaymentTerminalAdapter {
  readonly name = 'Mock Terminal (Desarrollo)'
  private connected = false

  async init(_config: TerminalConfig): Promise<void> {
    console.log('[MockTerminal] Inicializando...')
    await new Promise(r => setTimeout(r, 500))
    this.connected = true
    console.log('[MockTerminal] Conectado.')
  }

  async charge(amount: number, reference: string): Promise<ChargeResult> {
    console.log(`[MockTerminal] Cobrando $${amount} (ref: ${reference})`)
    await new Promise(r => setTimeout(r, 1_500)) // Simular transacción
    return {
      success: true,
      transactionId: `mock-${Date.now()}`,
      authCode: '123456',
      cardBrand: 'VISA',
      lastFourDigits: '4242'
    }
  }

  async cancel(): Promise<void> {
    console.log('[MockTerminal] Operación cancelada.')
  }

  async refund(transactionId: string, amount: number): Promise<RefundResult> {
    console.log(`[MockTerminal] Devolviendo $${amount} de transacción ${transactionId}`)
    return { success: true, refundId: `refund-${Date.now()}` }
  }

  isConnected(): boolean {
    return this.connected
  }
}

// ─── Instancia global (reemplazar MockPaymentTerminal con implementación real) ──
// export const paymentTerminal: PaymentTerminalAdapter = new MockPaymentTerminal()
