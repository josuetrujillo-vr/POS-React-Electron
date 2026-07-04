import type { ReceiptData } from '../types'
import { useAppConfigStore } from '../store/configStore'

/**
 * Servicio de impresión de tickets.
 * Actúa como proxy entre los componentes React y el proceso
 * principal de Electron via IPC.
 *
 * Modo fallback: si no hay impresora configurada, ofrece
 * abrir el ticket en una ventana de impresión del navegador.
 *
 * EXTENSIÓN FUTURA:
 * - printToPDF(): generar PDF con el ticket
 * - printToEmail(): enviar ticket por correo
 */
export const printService = {
  /**
   * Imprime un ticket en la impresora configurada.
   * @returns { success, error }
   */
  async printReceipt(receiptData: ReceiptData): Promise<{ success: boolean; error?: string }> {
    if (useAppConfigStore.getState().printerType === 'none') {
      console.log('[PrintService] Impresora desactivada; se omite impresion.')
      return { success: true }
    }

    // Verificar que estamos en Electron
    if (!window.electronAPI) {
      console.warn('[PrintService] No se detectó Electron, usando impresión del navegador')
      return printService.printBrowser(receiptData)
    }

    try {
      const result = await window.electronAPI.print(receiptData)
      return result
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * Fallback: imprime usando window.print() del navegador.
   * Útil para pruebas o cuando no hay impresora USB/red.
   */
  printBrowser(_receiptData: ReceiptData): { success: boolean; error?: string } {
    try {
      window.print()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * Verifica si hay impresoras disponibles.
   */
  async listPrinters(): Promise<{ success: boolean; devices: unknown[]; error?: string }> {
    if (!window.electronAPI) {
      return { success: false, devices: [], error: 'No Electron' }
    }
    return window.electronAPI.listPrinters()
  }
}
