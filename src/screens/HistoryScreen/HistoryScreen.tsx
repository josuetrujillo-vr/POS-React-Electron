import React, { useEffect, useState } from 'react'
import { RefreshCw, List, Banknote, CreditCard, Smartphone, Inbox, AlertTriangle } from 'lucide-react'
import { useSalesStore } from '../../store/salesStore'
import { useSyncStore } from '../../store/syncStore'
import { SaleCard } from '../../components/SaleCard/SaleCard'
import { printService } from '../../services/printService'
import { formatMXN } from '../../utils/formatCurrency'
import type { Sale, PaymentMethod, ReceiptData } from '../../types'
import './HistoryScreen.css'

/**
 * Pantalla de historial de ventas del día.
 * Muestra todas las ventas completadas con opción de re-impresión
 * y botón de sincronización forzada.
 */
const HistoryScreen: React.FC = () => {
  const { todaySales, isLoading, loadToday } = useSalesStore()
  const { forceSync, isSyncing, isOnline, pendingCount } = useSyncStore()
  const [filterPayment, setFilterPayment] = useState<PaymentMethod | 'all'>('all')
  const [reprintError, setReprintError] = useState<string | null>(null)

  useEffect(() => {
    loadToday()
  }, [loadToday])

  // Filtrado local por método de pago
  const filtered = filterPayment === 'all'
    ? todaySales
    : todaySales.filter(s => s.paymentMethod === filterPayment)

  // Totales del día
  const totalHoy = filtered.reduce((acc, s) => acc + s.total, 0)
  const countHoy = filtered.length

  const handleReprint = async (sale: Sale) => {
    setReprintError(null)
    const receiptData: ReceiptData = {
      saleNumber: sale.saleNumber,
      timestamp: sale.timestamp,
      items: sale.items.map(i => ({ name: i.productName, qty: i.quantity, price: i.unitPrice })),
      subtotal: sale.subtotalSinIva,
      discount: sale.totalDiscount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      cashReceived: sale.cashReceived
    }
    const result = await printService.printReceipt(receiptData)
    if (!result.success) {
      setReprintError(result.error || 'Error de impresión')
      setTimeout(() => setReprintError(null), 4_000)
    }
  }

  return (
    <div className="history-screen">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="history-header">
        <div>
          <h1 className="history-header__title">Historial del Día</h1>
          <p className="history-header__date">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="history-header__actions">
          {pendingCount > 0 && (
            <button
              className={`btn btn-secondary ${isSyncing ? 'btn-loading' : ''}`}
              onClick={forceSync}
              disabled={!isOnline || isSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spinning' : ''} />
              {isSyncing ? 'Sincronizando...' : `Sincronizar (${pendingCount})`}
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={loadToday}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* ─── Resumen del día ─────────────────────────────────────── */}
      <div className="history-summary">
        <div className="history-stat card">
          <span className="history-stat__label">Ventas completadas</span>
          <span className="history-stat__value">{countHoy}</span>
        </div>
        <div className="history-stat card">
          <span className="history-stat__label">Total cobrado</span>
          <span className="history-stat__value text-gold">{formatMXN(totalHoy)}</span>
        </div>
        <div className="history-stat card">
          <span className="history-stat__label">Pendientes sync</span>
          <span className={`history-stat__value ${pendingCount > 0 ? 'text-warning' : 'text-success'}`}>
            {pendingCount}
          </span>
        </div>
        <div className="history-stat card">
          <span className="history-stat__label">Efectivo</span>
          <span className="history-stat__value">
            {formatMXN(filtered.filter(s => s.paymentMethod === 'efectivo').reduce((a, s) => a + s.total, 0))}
          </span>
        </div>
      </div>

      {/* ─── Filtros ─────────────────────────────────────────────── */}
      <div className="history-filters">
        {(['all', 'efectivo', 'tarjeta', 'transferencia'] as const).map(f => (
          <button
            key={f}
            className={`category-chip ${filterPayment === f ? 'category-chip--active' : ''}`}
            onClick={() => setFilterPayment(f)}
          >
            {f === 'all' ? <><List size={14} /> Todos</> : f === 'efectivo' ? <><Banknote size={14} /> Efectivo</> : f === 'tarjeta' ? <><CreditCard size={14} /> Tarjeta</> : <><Smartphone size={14} /> Transferencia</>}
          </button>
        ))}
      </div>

      {/* ─── Error de reimpresión ─────────────────────────────── */}
      {reprintError && (
        <div className="history-error animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={16} /> {reprintError}
        </div>
      )}

      {/* ─── Lista de ventas ─────────────────────────────────────── */}
      <div className="history-list">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="history-empty">
            <Inbox size={48} className="text-muted" />
            <p>{todaySales.length === 0 ? 'No hay ventas registradas hoy' : 'Sin ventas con ese filtro'}</p>
          </div>
        ) : (
          filtered.map(sale => (
            <SaleCard
              key={sale.id}
              sale={sale}
              onReprint={handleReprint}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default HistoryScreen
