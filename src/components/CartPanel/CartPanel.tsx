import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, MousePointerClick, Trash2, CreditCard, Tag, X, Check } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { formatMXN } from '../../utils/formatCurrency'
import './CartPanel.css'

/**
 * Panel lateral del carrito de compras.
 * Muestra los items seleccionados, permite ajustar cantidades,
 * aplicar descuentos por item, y navegar al checkout.
 */
export const CartPanel: React.FC = () => {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, applyItemDiscount, globalDiscount, setGlobalDiscount, clear, getSummary } = useCartStore()
  const summary = getSummary()

  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [globalDiscountInput, setGlobalDiscountInput] = useState(globalDiscount > 0 ? String(globalDiscount) : '')

  const handleCheckout = () => {
    if (items.length === 0) return
    navigate('/checkout')
  }

  const handleDiscountConfirm = (productId: string) => {
    const val = parseFloat(discountInput) || 0
    applyItemDiscount(productId, val)
    setEditingDiscount(null)
    setDiscountInput('')
  }

  const handleGlobalDiscount = () => {
    const val = parseFloat(globalDiscountInput) || 0
    setGlobalDiscount(val)
  }

  if (items.length === 0) {
    return (
      <aside className="cart-panel cart-panel--empty">
        <div className="cart-panel__header">
          <span className="cart-panel__title">
            <ShoppingCart size={20} />
            Carrito
          </span>
        </div>
        <div className="cart-panel__empty-state">
          <MousePointerClick size={48} className="text-muted" />
          <p>Selecciona productos del catálogo para agregar al carrito</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="cart-panel">
      {/* ─── Encabezado ─────────────────────────────────────────── */}
      <div className="cart-panel__header">
        <span className="cart-panel__title">
          <ShoppingCart size={20} />
          Carrito
          <span className="cart-badge">{items.length}</span>
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={clear}
          title="Vaciar carrito"
        >
          <Trash2 size={16} /> Vaciar
        </button>
      </div>

      {/* ─── Items ──────────────────────────────────────────────── */}
      <div className="cart-panel__items">
        {items.map(item => (
          <div key={item.product.id} className="cart-item animate-fade-in">
            <div className="cart-item__info">
              <span className="cart-item__name">{item.product.name}</span>
              <span className="cart-item__unit-price">{formatMXN(item.product.price)} / u</span>
            </div>

            {/* Controles de cantidad */}
            <div className="cart-item__controls">
              <button
                className="qty-btn"
                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                aria-label="Disminuir cantidad"
              >−</button>
              <input
                className="qty-input"
                type="number"
                min={1}
                max={item.product.stock}
                value={item.quantity}
                onChange={e => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                aria-label="Cantidad"
              />
              <button
                className="qty-btn"
                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                disabled={item.quantity >= item.product.stock}
                aria-label="Aumentar cantidad"
              >+</button>
            </div>

            {/* Línea total y descuento */}
            <div className="cart-item__bottom">
              <div className="cart-item__line">
                {item.itemDiscount > 0 && (
                  <span className="cart-item__discount">-{formatMXN(item.itemDiscount)}</span>
                )}
                <span className="cart-item__total">
                  {formatMXN(item.product.price * item.quantity - item.itemDiscount)}
                </span>
              </div>

              <div className="cart-item__actions">
                {editingDiscount === item.product.id ? (
                  <div className="discount-edit">
                    <input
                      className="discount-input"
                      type="number"
                      min={0}
                      placeholder="$ desc."
                      value={discountInput}
                      onChange={e => setDiscountInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleDiscountConfirm(item.product.id)
                        if (e.key === 'Escape') setEditingDiscount(null)
                      }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleDiscountConfirm(item.product.id)}>
                      <Check size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingDiscount(null)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm cart-item__discount-btn"
                    onClick={() => {
                      setEditingDiscount(item.product.id)
                      setDiscountInput(item.itemDiscount > 0 ? String(item.itemDiscount) : '')
                    }}
                  >
                    <Tag size={14} style={{ marginRight: 4 }} /> % Desc.
                  </button>
                )}

                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removeItem(item.product.id)}
                  aria-label={`Eliminar ${item.product.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Descuento Global ─────────────────────────────────── */}
      <div className="cart-global-discount">
        <label className="cart-global-discount__label">Descuento global ($):</label>
        <div className="cart-global-discount__input-row">
          <input
            className="input"
            type="number"
            min={0}
            max={summary.grossTotal}
            placeholder="0.00"
            value={globalDiscountInput}
            onChange={e => setGlobalDiscountInput(e.target.value)}
            onBlur={handleGlobalDiscount}
            onKeyDown={e => e.key === 'Enter' && handleGlobalDiscount()}
          />
        </div>
      </div>

      {/* ─── Totales ─────────────────────────────────────────── */}
      <div className="cart-totals">
        {summary.totalDiscount > 0 && (
          <>
            <div className="cart-totals__row">
              <span>Subtotal:</span>
              <span>{formatMXN(summary.grossTotal)}</span>
            </div>
            <div className="cart-totals__row cart-totals__row--discount">
              <span>Descuento:</span>
              <span>-{formatMXN(summary.totalDiscount)}</span>
            </div>
          </>
        )}
        <div className="cart-totals__row cart-totals__row--small">
          <span className="text-muted text-sm">IVA incluido:</span>
          <span className="text-muted text-sm">{formatMXN(summary.ivaAmount)}</span>
        </div>
        <div className="cart-totals__row cart-totals__row--total">
          <span>TOTAL:</span>
          <span>{formatMXN(summary.total)}</span>
        </div>
      </div>

      {/* ─── Acción principal ─────────────────────────────────── */}
      <button
        id="checkout-btn"
        className="btn btn-primary btn-lg btn-full"
        onClick={handleCheckout}
        disabled={items.length === 0}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <CreditCard size={20} />
        Cobrar {formatMXN(summary.total)}
      </button>
    </aside>
  )
}

