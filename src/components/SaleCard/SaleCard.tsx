import React from 'react'
import { Banknote, CreditCard, Smartphone, Printer } from 'lucide-react'
import type { Sale } from '../../types'
import { formatMXN } from '../../utils/formatCurrency'
import './SaleCard.css'

const PAYMENT_LABELS: Record<string, { label: string; icon: React.FC<any> }> = {
  efectivo:     { label: 'Efectivo',      icon: Banknote },
  tarjeta:      { label: 'Tarjeta',       icon: CreditCard },
  transferencia: { label: 'Transferencia', icon: Smartphone }
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  pending_sync: { label: 'Pendiente sync', badge: 'badge-warning' },
  synced:       { label: 'Sincronizado',   badge: 'badge-success' },
  sync_error:   { label: 'Error sync',     badge: 'badge-danger' }
}

interface SaleCardProps {
  sale: Sale
  onReprint?: (sale: Sale) => void
}

/**
 * Tarjeta de venta individual para el historial del día.
 * Muestra número de ticket, hora, total, método de pago y estado de sync.
 */
export const SaleCard: React.FC<SaleCardProps> = ({ sale, onReprint }) => {
  const time = new Date(sale.timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const statusInfo = STATUS_LABELS[sale.syncStatus] || STATUS_LABELS.pending_sync
  
  const paymentInfo = PAYMENT_LABELS[sale.paymentMethod] || { label: sale.paymentMethod, icon: null }
  const PaymentIcon = paymentInfo.icon

  return (
    <div className="sale-card animate-fade-in">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="sale-card__header">
        <div className="sale-card__number">#{sale.saleNumber}</div>
        <div className="sale-card__time">{time}</div>
      </div>

      {/* ─── Items resumidos ─────────────────────────────── */}
      <div className="sale-card__items">
        {sale.items.slice(0, 3).map((item, idx) => (
          <span key={idx} className="sale-card__item-chip">
            {item.productName} ×{item.quantity}
          </span>
        ))}
        {sale.items.length > 3 && (
          <span className="sale-card__item-chip sale-card__item-more">
            +{sale.items.length - 3} más
          </span>
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────── */}
      <div className="sale-card__footer">
        <div className="sale-card__left">
          <span className="sale-card__payment" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {PaymentIcon && <PaymentIcon size={14} />}
            {paymentInfo.label}
          </span>
          <span className={`badge ${statusInfo.badge}`}>{statusInfo.label}</span>
        </div>
        <div className="sale-card__right">
          <span className="sale-card__total">{formatMXN(sale.total)}</span>
          {onReprint && (
            <button
              className="btn btn-ghost btn-sm sale-card__reprint"
              onClick={() => onReprint(sale)}
              title="Re-imprimir ticket"
            >
              <Printer size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
