import React, { useEffect, useState } from 'react'
import { ProductGrid } from '../../components/ProductGrid/ProductGrid'
import { CartPanel } from '../../components/CartPanel/CartPanel'
import { useCartStore } from '../../store/cartStore'
import { getAllProducts } from '../../db/products'
import type { Product } from '../../types'
import './SaleScreen.css'

/**
 * Pantalla principal de venta.
 * Layout: [Catálogo de productos] | [Panel del carrito]
 */
const SaleScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const addItem = useCartStore(s => s.addItem)

  // Cargar productos desde IndexedDB al montar
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const all = await getAllProducts()
        if (!cancelled) setProducts(all)
      } catch (err) {
        console.error('[SaleScreen] Error cargando productos:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="sale-screen">
      {/* ─── Catálogo ──────────────────────────────────────────── */}
      <main className="sale-screen__catalog">
        {isLoading ? (
          <div className="sale-screen__loading">
            <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 32, marginBottom: 16 }} />
            <div className="sale-screen__skeleton-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 100 }} />
              ))}
            </div>
          </div>
        ) : (
          <ProductGrid
            products={products}
            onAddProduct={(product) => { addItem(product) }}
          />
        )}
      </main>

      {/* ─── Carrito ───────────────────────────────────────────── */}
      <CartPanel />
    </div>
  )
}

export default SaleScreen
