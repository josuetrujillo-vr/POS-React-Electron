import { ipcMain, app } from 'electron'

// ─── Configuración en memoria (se puede persistir en electron-store después) ──
export const config: Record<string, unknown> = {
  printerType: 'none',   // 'usb' | 'network' | 'none'
  printerHost: '',       // IP para impresora de red
  printerPort: 9100,     // Puerto para impresora de red (estándar ESC/POS)
  syncUrl: 'http://127.0.0.1:3001/api/sales',
  businessName: 'Ropa Vaquera',
  businessAddress: '',
  taxRate: 16            // IVA 16% México (incluido en precio)
}

/**
 * Módulo de impresión ESC/POS para impresoras de tickets.
 *
 * Soporta:
 * - USB: impresoras ESC/POS conectadas por USB (Epson, Star, genéricas)
 * - Red: impresoras ESC/POS vía TCP/IP
 *
 * IMPORTANTE: Para impresoras USB en Windows se necesitan los drivers
 * o Zadig para convertir el driver a WinUSB.
 *
 * EXTENSIÓN FUTURA:
 * - Añadir soporte para impresoras Bluetooth: usar @node-escpos/bluetooth
 * - Añadir soporte para impresión PDF: usar pdfkit + electron.shell.openExternal
 */
export function setupPrinterHandlers(): void {

  // ─── Listar impresoras disponibles ────────────────────────────────────────
  ipcMain.handle('printer:list', async () => {
    try {
      // Intentar detectar via USB
      const { USB } = await import('@node-escpos/usb-adapter').catch(() => ({ USB: null }))
      if (USB) {
        const devices = USB.findPrinter()
        return { success: true, devices: devices.map((d: { deviceDescriptor: { idVendor: number; idProduct: number } }) => ({
          vendor: d.deviceDescriptor.idVendor.toString(16),
          product: d.deviceDescriptor.idProduct.toString(16)
        }))}
      }
      return { success: true, devices: [] }
    } catch (err) {
      return { success: false, devices: [], error: String(err) }
    }
  })

  // ─── Imprimir ticket ──────────────────────────────────────────────────────
  ipcMain.handle('printer:print', async (_event, receiptData: ReceiptData) => {
    try {
      const printerType = config.printerType as string

      if (printerType === 'usb') {
        return await printViaUSB(receiptData)
      } else if (printerType === 'network') {
        return await printViaNetwork(receiptData, config.printerHost as string, config.printerPort as number)
      } else if (printerType === 'none') {
        return { success: true, skipped: true }
      } else {
        return { success: false, error: 'Tipo de impresora no configurado' }
      }
    } catch (err) {
      console.error('[Printer] Error al imprimir:', err)
      return { success: false, error: String(err) }
    }
  })

  // ─── Configuración ───────────────────────────────────────────────────────
  ipcMain.handle('config:get', (_event, key: string) => config[key])
  ipcMain.handle('config:set', (_event, key: string, value: unknown) => {
    config[key] = value
    return true
  })
  ipcMain.handle('app:version', () => app.getVersion())
}

// ─── Impresión USB ────────────────────────────────────────────────────────
async function printViaUSB(receiptData: ReceiptData): Promise<PrintResult> {
  try {
    const { USB } = await import('@node-escpos/usb-adapter')
    const { Printer } = await import('@node-escpos/core')

    const device = new USB()
    await new Promise<void>((resolve, reject) => {
      device.open((err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const printer = new Printer(device as unknown as Parameters<typeof Printer>[0], { encoding: 'PC852_LATIN2' })
    await buildReceiptCommands(printer, receiptData)
    await printer.cut()
    await printer.close()

    return { success: true }
  } catch (err) {
    return { success: false, error: `Error USB: ${String(err)}` }
  }
}

// ─── Impresión por Red (TCP/IP) ───────────────────────────────────────────
async function printViaNetwork(
  receiptData: ReceiptData,
  host: string,
  port: number
): Promise<PrintResult> {
  try {
    const { Network } = await import('@node-escpos/network-adapter')
    const { Printer } = await import('@node-escpos/core')

    const device = new Network(host, port)
    await new Promise<void>((resolve, reject) => {
      device.open((err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const printer = new Printer(device as unknown as Parameters<typeof Printer>[0], { encoding: 'PC852_LATIN2' })
    await buildReceiptCommands(printer, receiptData)
    await printer.cut()
    await printer.close()

    return { success: true }
  } catch (err) {
    return { success: false, error: `Error red: ${String(err)}` }
  }
}

/**
 * Construye los comandos ESC/POS del ticket.
 * Centralizado aquí para facilitar personalización futura.
 */
async function buildReceiptCommands(
  printer: { align: (a: string) => unknown; style: (s: string) => unknown; size: (w: number, h: number) => unknown; text: (t: string) => unknown; drawLine: () => unknown; tableCustom: (rows: unknown[]) => unknown; newLine: () => unknown },
  data: ReceiptData
): Promise<void> {
  const taxRate = config.taxRate as number
  const ivaPct = taxRate / 100
  const ivaAmount = data.total * (ivaPct / (1 + ivaPct))
  const subtotal = data.total - ivaAmount

  await printer.align('ct')
  await printer.style('bu')
  await printer.size(1, 1)
  await printer.text(config.businessName as string)
  await printer.style('normal')

  if (config.businessAddress) {
    await printer.text(config.businessAddress as string)
  }

  await printer.drawLine()
  await printer.align('lt')
  await printer.text(`Ticket #: ${data.saleNumber}`)
  await printer.text(`Fecha:    ${new Date(data.timestamp).toLocaleString('es-MX')}`)
  await printer.text(`Cajero:   ${data.cashier || 'Sistema'}`)
  await printer.drawLine()

  // Items
  for (const item of data.items) {
    await printer.tableCustom([
      { text: item.name.substring(0, 20), align: 'LEFT', width: 0.6 },
      { text: `${item.qty}x`, align: 'CENTER', width: 0.1 },
      { text: formatMXN(item.price * item.qty), align: 'RIGHT', width: 0.3 }
    ])
  }

  await printer.drawLine()

  if (data.discount > 0) {
    await printer.tableCustom([
      { text: 'Descuento:', align: 'LEFT', width: 0.6 },
      { text: `-${formatMXN(data.discount)}`, align: 'RIGHT', width: 0.4 }
    ])
  }

  await printer.tableCustom([
    { text: `Subtotal (sin IVA):`, align: 'LEFT', width: 0.6 },
    { text: formatMXN(subtotal), align: 'RIGHT', width: 0.4 }
  ])
  await printer.tableCustom([
    { text: `IVA (${taxRate}%):`, align: 'LEFT', width: 0.6 },
    { text: formatMXN(ivaAmount), align: 'RIGHT', width: 0.4 }
  ])

  await printer.style('bu')
  await printer.tableCustom([
    { text: 'TOTAL:', align: 'LEFT', width: 0.5 },
    { text: formatMXN(data.total), align: 'RIGHT', width: 0.5 }
  ])
  await printer.style('normal')

  await printer.drawLine()
  await printer.text(`Pago: ${data.paymentMethod}`)
  if (data.cashReceived && data.cashReceived > data.total) {
    await printer.text(`Recibido: ${formatMXN(data.cashReceived)}`)
    await printer.text(`Cambio:   ${formatMXN(data.cashReceived - data.total)}`)
  }
  await printer.drawLine()
  await printer.align('ct')
  await printer.text('¡Gracias por su compra!')
  await printer.text('Vuelva pronto')
  await printer.newLine()
  await printer.newLine()
}

function formatMXN(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Tipos locales del módulo ─────────────────────────────────────────────
interface ReceiptData {
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

interface PrintResult {
  success: boolean
  skipped?: boolean
  error?: string
}
