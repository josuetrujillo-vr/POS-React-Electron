import React, { useState, useMemo, useCallback } from 'react'
import { LayoutGrid, Search, X, Check, Shirt, Footprints, Layers, Sparkles, Scissors, Sun, List, Box } from 'lucide-react'
import type { Product, ProductCategory } from '../../types'
import { formatMXN } from '../../utils/formatCurrency'
import bootsImage from '../../assets/pexels-boots-1853964_1920.jpg'
import hatImage from '../../assets/ralphs_fotos-cowboy-hat-2801582_1920.png'
import horseImage from '../../assets/ronaldplett-horse-8209533_1920.jpg'
import './ProductGrid.css'

const PRODUCT_IMAGES = [bootsImage, hatImage, horseImage]

const CATEGORIES: { value: ProductCategory | 'all'; label: string; icon: React.FC<any> }[] = [
  { value: 'all',        label: 'Todos',      icon: LayoutGrid },
  { value: 'pantalones', label: 'Pantalones', icon: Scissors },
  { value: 'sombreros',  label: 'Sombreros',  icon: Sun },
  { value: 'camisas',    label: 'Camisas',    icon: Shirt },
  { value: 'botas',      label: 'Botas',      icon: Footprints },
  { value: 'cintos',     label: 'Cintos',     icon: List },
  { value: 'chamarras',  label: 'Chamarras',  icon: Layers },
  { value: 'accesorios', label: 'Accesorios', icon: Sparkles },
]

function createProductArt(product: Product): string {
  const palettes: Record<string, [string, string]> = {
    pantalones: ['#5b4636', '#d9b38c'],
    sombreros: ['#8b6b3f', '#f5e6b3'],
    camisas: ['#2f4f6f', '#cfe2f3'],
    botas: ['#4b2e1e', '#d6b07a'],
    cintos: ['#6b3f2a', '#f1d2a2'],
    chamarras: ['#3a3a3a', '#9fb3c8'],
    accesorios: ['#7a5c00', '#ffd966'],
    otros: ['#4f5d75', '#bfc9d9']
  }

  const [base, accent] = palettes[product.category] || palettes.otros
  const title = product.name.length > 28 ? `${product.name.slice(0, 25)}...` : product.name
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="28" fill="url(#g)" />
      <circle cx="150" cy="48" r="28" fill="rgba(255,255,255,0.16)" />
      <text x="18" y="52" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="700">${product.category}</text>
      <text x="18" y="120" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="700">
        ${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
      <text x="18" y="156" fill="rgba(255,255,255,0.85)" font-family="Arial, sans-serif" font-size="14">
        ${formatMXN(product.price)}
      </text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

interface ProductGridProps {
  products: Product[]
  onAddProduct: (product: Product) => void
}

/**
 * Grid de productos con búsqueda en tiempo real y filtro por categoría.
 * Optimizado para hardware antiguo: usa CSS grid nativo sin virtual scrolling
 * para catálogos de hasta ~500 productos.
 */
export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddProduct }) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const productsWithImages = useMemo(() => (
    products.map((product, index) => ({
      ...product,
      imageUrl: product.imageUrl || PRODUCT_IMAGES[index % PRODUCT_IMAGES.length]
    }))
  ), [products])

  // Filtrado memoizado para evitar re-cómputos en cada render
  const filtered = useMemo(() => {
    let result = productsWithImages.filter(p => p.active !== false)
    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q)
      )
    }
    return result
  }, [productsWithImages, activeCategory, search])

  const handleAdd = useCallback((product: Product) => {
    onAddProduct(product)
    // Feedback visual temporal
    setAddedIds(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 600)
  }, [onAddProduct])

  return (
    <div className="product-grid-container">
      {/* ─── Barra de búsqueda ─────────────────────────────────────── */}
      <div className="product-grid__search-bar">
        <Search className="product-grid__search-icon" size={20} />
        <input
          id="product-search"
          className="input input-search product-grid__search"
          type="text"
          placeholder="Buscar producto o código de barras..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button
            className="product-grid__clear"
            onClick={() => setSearch('')}
            aria-label="Limpiar búsqueda"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ─── Filtros de categoría ──────────────────────────────────── */}
      <div className="product-grid__categories" role="tablist">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.value}
              role="tab"
              aria-selected={activeCategory === cat.value}
              className={`category-chip ${activeCategory === cat.value ? 'category-chip--active' : ''}`}
              onClick={() => setActiveCategory(cat.value)}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── Contador de resultados ────────────────────────────────── */}
      <div className="product-grid__count">
        {filtered.length === 0
          ? 'Sin resultados'
          : `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* ─── Grid de productos ─────────────────────────────────────── */}
      <div className="product-grid__items" role="list">
        {filtered.length === 0 ? (
          <div className="product-grid__empty">
            <Box size={48} className="text-muted" />
            <p>No se encontraron productos</p>
            {search && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              isAdded={addedIds.has(product.id)}
              onAdd={handleAdd}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Tarjeta individual de producto ──────────────────────────────────────
interface ProductCardProps {
  product: Product
  isAdded: boolean
  onAdd: (product: Product) => void
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, isAdded, onAdd }) => {
  const isOutOfStock = product.stock <= 0
  
  // Usamos una imagen genérica determinística basada en el ID
  const imageUrl = product.imageUrl || createProductArt(product)

  return (
    <button
      className={`product-card ${isAdded ? 'product-card--added' : ''} ${isOutOfStock ? 'product-card--out-of-stock' : ''}`}
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      role="listitem"
      title={isOutOfStock ? 'Sin stock' : product.name}
    >
      <div className="product-card__image-container">
        <img src={imageUrl} alt={product.name} className="product-card__image" loading="lazy" />
      </div>
      <div className="product-card__info">
        <div className="product-card__name">{product.name}</div>
        <div className="product-card__price">{formatMXN(product.price)}</div>
        <div className="product-card__meta">
          {isOutOfStock
            ? <span className="badge badge-danger">Sin stock</span>
            : <span className="product-card__stock">Stock: {product.stock}</span>
          }
        </div>
      </div>
      {isAdded && (
        <div className="product-card__added-overlay">
          <Check size={32} />
          <span>Agregado</span>
        </div>
      )}
    </button>
  )
})

ProductCard.displayName = 'ProductCard'
