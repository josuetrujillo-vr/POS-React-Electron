import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Banknote, CreditCard, Smartphone, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useSalesStore } from '../../store/salesStore'
import { useSyncStore } from '../../store/syncStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { saveSale, getLastSaleNumber } from '../../db/sales'
import { getProductById } from '../../db/products'
import { generateId, generateSaleNumber } from '../../utils/generateId'
import { formatMXN } from '../../utils/formatCurrency'
import { printService } from '../../services/printService'
import { useAppConfigStore } from '../../store/configStore'
import type { Sale, SaleItem, PaymentMethod, ReceiptData } from '../../types'
import './CheckoutScreen.css'

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.FC<any> }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: Banknote },
  { value: 'tarjeta',       label: 'Tarjeta',        icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia',  icon: Smartphone }
]

/**
 * Pantalla de resumen y cobro.
 * Muestra todos los items, totales, método de pago, y ejecuta la venta.
 */
const CheckoutScreen: React.FC = () => {
  const navigate = useNavigate()
  const { items, paymentMethod, cashReceived, globalDiscount, setPaymentMethod, setCashReceived, getSummary, clear } = useCartStore()
  const { addSale } = useSalesStore()
  const printerType = useAppConfigStore(s => s.printerType)
  const summary = getSummary()
  const isPrinterEnabled = printerType !== 'none'

  const [isProcessing, setIsProcessing] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [cashInput, setCashInput] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Redirigir si el carrito está vacío y no estamos mostrando el modal de éxito
  if (items.length === 0 && !showSuccessModal) {
    navigate('/')
    return null
  }

  const change = paymentMethod === 'efectivo'
    ? Math.max(0, cashReceived - summary.total)
    : 0

  const canConfirm = paymentMethod !== 'efectivo' || cashReceived >= summary.total

  const handleConfirm = async () => {
    if (!canConfirm || isProcessing) return
    setIsProcessing(true)
    setPrintError(null)
    setErrorMessage(null)

    try {
      // 0. Validar stock de último minuto (evitar edge cases)
      for (const item of items) {
        const dbProduct = await getProductById(item.product.id)
        if (!dbProduct) {
          throw new Error(`El producto "${item.product.name}" ya no existe en el catálogo.`)
        }
        if (dbProduct.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${item.product.name}". Disponible: ${dbProduct.stock}, solicitado: ${item.quantity}.`)
        }
      }

      // 1. Construir el objeto de venta
      const lastNum = await getLastSaleNumber()
      const saleNumber = generateSaleNumber(lastNum)

      const saleItems: SaleItem[] = items.map(ci => ({
        productId: ci.product.id,
        productName: ci.product.name,
        category: ci.product.category,
        quantity: ci.quantity,
        unitPrice: ci.product.price,
        itemDiscount: ci.itemDiscount,
        lineTotal: ci.product.price * ci.quantity - ci.itemDiscount
      }))

      const sale: Sale = {
        id: generateId(),
        saleNumber,
        items: saleItems,
        subtotalSinIva: summary.subtotalSinIva,
        ivaAmount: summary.ivaAmount,
        totalDiscount: summary.totalDiscount,
        total: summary.total,
        paymentMethod,
        cashReceived: paymentMethod === 'efectivo' ? cashReceived : undefined,
        timestamp: new Date().toISOString(),
        syncStatus: 'pending_sync'
      }

      // 2. Guardar localmente (siempre, sin importar conexión)
      await saveSale(sale)

      // 3. Actualizar estado en memoria
      addSale(sale)

      // 4. Intentar sincronizar en segundo plano sin bloquear
      useSyncStore.getState().forceSync()

      // 5. Imprimir ticket si esta habilitado
      const receiptData: ReceiptData = {
        saleNumber: sale.saleNumber,
        timestamp: sale.timestamp,
        items: saleItems.map(i => ({ name: i.productName, qty: i.quantity, price: i.unitPrice })),
        subtotal: summary.subtotalSinIva,
        discount: summary.totalDiscount,
        total: summary.total,
        paymentMethod: paymentMethod,
        cashReceived: paymentMethod === 'efectivo' ? cashReceived : undefined
      }

      if (isPrinterEnabled) {
        const printResult = await printService.printReceipt(receiptData)
        if (!printResult.success) {
          setPrintError(printResult.error || 'No se pudo imprimir el ticket')
        }
      }

      // 6. Mostrar modal de éxito
      setShowSuccessModal(true)

    } catch (err) {
      console.error('[Checkout] Error al procesar venta:', err)
      setErrorMessage(String(err).replace('Error: ', ''))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSuccessClose = () => {
    clear()
    useInventoryStore.getState().loadLowStockCount()
    navigate('/history')
  }

  const handleNewSale = () => {
    clear()
    useInventoryStore.getState().loadLowStockCount()
    navigate('/')
  }

  return (
    <div className="checkout-screen animate-fade-in">
      <div className="checkout-screen__inner">
        {/* ─── Encabezado ───────────────────────────────────────── */}
        <div className="checkout-header">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
            disabled={isProcessing}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={16} /> Regresar
          </button>
          <h1 className="checkout-header__title">Resumen de Venta</h1>
        </div>

        <div className="checkout-content">
          {/* ─── Columna izquierda: items ────────────────────── */}
          <section className="checkout-items">
            <h2 className="checkout-section-title">Productos</h2>
            <div className="checkout-items__list">
              {items.map(item => (
                <div key={item.product.id} className="checkout-item">
                  <div className="checkout-item__info">
                    <span className="checkout-item__name">{item.product.name}</span>
                    <span className="checkout-item__qty">×{item.quantity}</span>
                  </div>
                  <div className="checkout-item__right">
                    {item.itemDiscount > 0 && (
                      <span className="checkout-item__discount">-{formatMXN(item.itemDiscount)}</span>
                    )}
                    <span className="checkout-item__total">
                      {formatMXN(item.product.price * item.quantity - item.itemDiscount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Columna derecha: pago y totales ─────────────── */}
          <section className="checkout-payment">
            {/* Totales */}
            <div className="checkout-totals card">
              <h2 className="checkout-section-title">Totales</h2>
              {summary.totalDiscount > 0 && (
                <>
                  <div className="totals-row">
                    <span>Subtotal bruto:</span>
                    <span>{formatMXN(summary.grossTotal)}</span>
                  </div>
                  <div className="totals-row totals-row--discount">
                    <span>Descuento total:</span>
                    <span>-{formatMXN(summary.totalDiscount)}</span>
                  </div>
                </>
              )}
              <div className="totals-row totals-row--iva">
                <span>Subtotal sin IVA:</span>
                <span>{formatMXN(summary.subtotalSinIva)}</span>
              </div>
              <div className="totals-row totals-row--iva">
                <span>IVA (16% incluido):</span>
                <span>{formatMXN(summary.ivaAmount)}</span>
              </div>
              <div className="totals-row totals-row--grand-total">
                <span>TOTAL A COBRAR:</span>
                <span>{formatMXN(summary.total)}</span>
              </div>
            </div>

            {/* Método de pago */}
            <div className="checkout-payment-methods card">
              <h2 className="checkout-section-title">Método de pago</h2>
              <div className="payment-options">
                {PAYMENT_OPTIONS.map(opt => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      className={`payment-option ${paymentMethod === opt.value ? 'payment-option--active' : ''}`}
                      onClick={() => setPaymentMethod(opt.value)}
                    >
                      <span className="payment-option__icon"><Icon size={20} /></span>
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Campo de efectivo recibido */}
              {paymentMethod === 'efectivo' && (
                <div className="cash-section animate-fade-in">
                  <label className="cash-label">Efectivo recibido ($):</label>
                  <input
                    id="cash-received"
                    className="input cash-input"
                    type="number"
                    min={summary.total}
                    step={0.5}
                    placeholder={formatMXN(summary.total)}
                    value={cashInput}
                    onChange={e => {
                      setCashInput(e.target.value)
                      setCashReceived(parseFloat(e.target.value) || 0)
                    }}
                    autoFocus
                  />
                  {/* Botones de efectivo rápido */}
                  <div className="cash-quick">
                    {[50, 100, 200, 500].map(denom => (
                      <button
                        key={denom}
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          // Redondear al billete siguiente
                          const needed = Math.ceil(summary.total / denom) * denom
                          setCashInput(String(needed))
                          setCashReceived(needed)
                        }}
                      >
                        ${denom}
                      </button>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setCashInput(String(summary.total))
                        setCashReceived(summary.total)
                      }}
                    >
                      Exacto
                    </button>
                  </div>

                  {cashReceived >= summary.total && (
                    <div className="cash-change animate-fade-in">
                      <span>Cambio:</span>
                      <span className="cash-change__amount">{formatMXN(change)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error de cobro (crítico, ej. falta de stock de último minuto) */}
            {errorMessage && (
              <div className="checkout-print-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                <AlertTriangle size={18} /> <span>{errorMessage}</span>
              </div>
            )}

            {/* Error de impresión (no crítico) */}
            {printError && (
              <div className="checkout-print-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> <span>{printError} — La venta fue guardada correctamente.</span>
              </div>
            )}

            {/* Botón confirmar */}
            <button
              id="confirm-sale-btn"
              className={`btn btn-primary btn-lg btn-full checkout-confirm ${isProcessing ? 'checkout-confirm--loading' : ''}`}
              onClick={handleConfirm}
              disabled={!canConfirm || isProcessing}
            >
              {isProcessing ? (
                <><RefreshCw size={20} className="spinning" /> Procesando...</>
              ) : (
                <><CheckCircle2 size={20} /> Confirmar venta — {formatMXN(summary.total)}</>
              )}
            </button>

            {paymentMethod === 'efectivo' && !canConfirm && (
              <p className="checkout-cash-warning">
                Ingresa el efectivo recibido (mín. {formatMXN(summary.total)})
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ─── Modal de Éxito ─────────────────────────────────────── */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content success-modal animate-fade-in">
            <div className="success-modal__icon">
              <CheckCircle2 size={64} className="text-success" />
            </div>
            <h2>Venta registrada exitosamente</h2>
            <p className="success-modal__text">
              {isPrinterEnabled
                ? 'La venta ha sido guardada y el ticket se envio a imprimir.'
                : 'La venta ha sido guardada correctamente.'}
            </p>
            
            {printError && (
              <div className="success-modal__error">
                <AlertTriangle size={16} /> {printError}
              </div>
            )}

            <div className="success-modal__actions">
              <button className="btn btn-secondary btn-lg" onClick={handleSuccessClose}>
                Ver en historial
              </button>
              <button className="btn btn-primary btn-lg" onClick={handleNewSale}>
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckoutScreen
