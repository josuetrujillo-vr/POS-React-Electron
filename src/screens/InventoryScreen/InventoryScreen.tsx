import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Package, Plus, Search, Upload, Download, Edit, Archive, RotateCcw, X,
  ChevronLeft, ChevronRight, ArrowUpDown
} from 'lucide-react'
import { useInventoryStore } from '../../store/inventoryStore'
import type { Product, ProductCategory, MovementType } from '../../types'
import { generateId } from '../../utils/generateId'
import { formatMXN } from '../../utils/formatCurrency'
import { getInventoryValue } from '../../db/inventory'
import './InventoryScreen.css'

const CATEGORIES: ProductCategory[] = ['pantalones', 'sombreros', 'camisas', 'botas', 'cintos', 'accesorios', 'chamarras', 'otros']
const PAGE_SIZE = 15
type ArchiveFilter = 'active' | 'archived' | 'all'

export default function InventoryScreen() {
  const {
    products, movements, selectedProduct, isLoading, error, filter, sortBy, sortDir,
    loadProducts, selectProduct, addProduct, updateProduct, archiveProduct, restoreProduct, adjustStock,
    setFilter, setSort
  } = useInventoryStore()

  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active')
  const [inventoryValue, setInventoryValue] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadProducts(); getInventoryValue().then(setInventoryValue) }, [])

  const filtered = useMemo(() => {
    let list = products
    if (archiveFilter === 'active') list = list.filter(p => p.active !== false)
    else if (archiveFilter === 'archived') list = list.filter(p => p.active === false)
    const q = filter.toLowerCase().trim()
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    )
    list.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy]
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [products, filter, sortBy, sortDir, archiveFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (col: typeof sortBy) => setSort(col)

  const handleNewProduct = () => { setEditingProduct(null); setShowForm(true) }
  const handleEditProduct = (p: Product) => { setEditingProduct(p); setShowForm(true) }

  const handleSaveProduct = async (data: Partial<Product>) => {
    const now = new Date().toISOString()
    if (editingProduct) {
      await updateProduct({ ...editingProduct, ...data, updatedAt: now })
    } else {
      await addProduct({
        id: generateId(),
        name: '',
        category: 'otros',
        price: 0,
        stock: 0,
        active: true,
        ...data,
        createdAt: now,
        updatedAt: now
      } as Product)
    }
    setShowForm(false)
    setEditingProduct(null)
    getInventoryValue().then(setInventoryValue)
  }

  const handleArchive = async (id: string) => {
    if (!window.confirm('¿Archivar este producto? Se ocultará del catálogo de venta.')) return
    await archiveProduct(id)
    getInventoryValue().then(setInventoryValue)
  }

  const handleRestore = async (id: string) => {
    await restoreProduct(id)
    getInventoryValue().then(setInventoryValue)
  }

  const handleAdjustStock = (product: Product) => {
    selectProduct(product)
    setShowAdjust(true)
  }

  const handleSaveAdjust = async (type: MovementType, quantity: number, reason: string, reference?: string) => {
    if (!selectedProduct) return
    await adjustStock(selectedProduct.id, type, quantity, reason, reference)
    setShowAdjust(false)
    getInventoryValue().then(setInventoryValue)
  }

  const handleExportCSV = () => {
    const headers = 'name,category,price,stock,barcode,description'
    const rows = products.map(p =>
      `"${p.name}","${p.category}",${p.price},${p.stock},"${p.barcode || ''}","${(p.description || '').replace(/"/g, '""')}"`
    )
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'productos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const lines = text.split('\n').filter(Boolean)
    const dataLines = lines.slice(1)
    const now = new Date().toISOString()
    for (const line of dataLines) {
      const cols = line.split(',').map(s => s.replace(/^"|"$/g, ''))
      if (cols.length < 4) continue
      const product: Product = {
        id: generateId(),
        name: cols[0],
        category: CATEGORIES.includes(cols[1] as ProductCategory) ? cols[1] as ProductCategory : 'otros',
        price: parseFloat(cols[2]) || 0,
        stock: parseInt(cols[3]) || 0,
        barcode: cols[4] || undefined,
        description: cols[5] || undefined,
        active: true,
        createdAt: now,
        updatedAt: now
      }
      await addProduct(product)
    }
    getInventoryValue().then(setInventoryValue)
    if (fileRef.current) fileRef.current.value = ''
  }

  const stockClass = (stock: number) => stock < 5 ? 'badge badge-danger' : stock < 10 ? 'badge badge-warning' : ''

  const SortHeader = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <th className="inv-th inv-th--sort" onClick={() => handleSort(col)}>
      {label} <ArrowUpDown size={12} className={`inv-sort-icon ${sortBy === col ? 'inv-sort-icon--active' : ''}`} />
    </th>
  )

  if (error) return <div className="inv-screen"><div className="inv-error">{error}</div></div>

  return (
    <div className="inv-screen">
      <div className="inv-header">
        <div className="inv-header__top">
          <h1 className="inv-title"><Package size={22} /> Inventario</h1>
          <div className="inv-header__actions">
            <button className="btn btn-primary btn-sm" onClick={handleNewProduct}><Plus size={16} /> Nuevo producto</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}><Download size={16} /> Exportar CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar CSV</button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          </div>
        </div>
        <div className="inv-header__bottom">
          <div className="inv-search">
            <Search size={16} className="inv-search__icon" />
            <input className="input inv-search__input" placeholder="Buscar producto..." value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} />
          </div>
          <div className="inv-archive-tabs">
            {(['active', 'archived', 'all'] as const).map(v => (
              <button key={v} className={`btn btn-sm ${archiveFilter === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setArchiveFilter(v); setPage(0) }}>
                {v === 'active' ? 'Activos' : v === 'archived' ? 'Archivados' : 'Todos'}
              </button>
            ))}
          </div>
          <div className="inv-kpis">
            <div className="inv-kpi"><span className="inv-kpi__label">Valor total</span><span className="inv-kpi__value">{formatMXN(inventoryValue)}</span></div>
            <div className="inv-kpi"><span className="inv-kpi__label">Productos</span><span className="inv-kpi__value">{products.length}</span></div>
            <div className="inv-kpi"><span className="inv-kpi__label">Unidades</span><span className="inv-kpi__value">{products.reduce((s, p) => s + p.stock, 0)}</span></div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="inv-loading">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton inv-skel-row" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="inv-empty">
          <Package size={48} />
          <p>{filter ? 'Sin resultados' : archiveFilter === 'archived' ? 'No hay productos archivados' : 'No hay productos — agrega tu primer producto'}</p>
        </div>
      ) : (
        <div className="inv-body">
          <table className="inv-table">
            <thead>
              <tr>
                <SortHeader col="name" label="Nombre" />
                <SortHeader col="category" label="Categoría" />
                <SortHeader col="price" label="Precio" />
                <SortHeader col="stock" label="Stock" />
                <th className="inv-th">Valor inventario</th>
                <th className="inv-th">Última actualización</th>
                <th className="inv-th">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(p => (
                <tr key={p.id} className={`inv-row ${selectedProduct?.id === p.id ? 'inv-row--selected' : ''} ${p.active === false ? 'inv-row--inactive' : ''}`}
                  onClick={() => selectProduct(p)}>
                  <td className="inv-td">{p.name}{p.active === false && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Inactivo</span>}</td>
                  <td className="inv-td">{p.category}</td>
                  <td className="inv-td">{formatMXN(p.price)}</td>
                  <td className="inv-td"><span className={stockClass(p.stock)}>{p.stock}</span></td>
                  <td className="inv-td">{formatMXN(p.stock * p.price)}</td>
                  <td className="inv-td inv-td--muted">{new Date(p.updatedAt).toLocaleDateString('es-MX')}</td>
                  <td className="inv-td inv-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEditProduct(p)} title="Editar"><Edit size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleAdjustStock(p)} title="Ajustar stock"><Package size={14} /></button>
                    {p.active === false
                      ? <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(p.id)} title="Restaurar"><RotateCcw size={14} /></button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(p.id)} title="Archivar"><Archive size={14} /></button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="inv-pagination">
              <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <span>{page + 1} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      )}

      {selectedProduct && !showAdjust && (
        <div className="inv-detail">
          <div className="inv-detail__head">
            <h3>{selectedProduct.name}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => selectProduct(null)}><X size={14} /></button>
          </div>
          <div className="inv-detail__info">
            <div><strong>Categoría:</strong> {selectedProduct.category}</div>
            <div><strong>Precio:</strong> {formatMXN(selectedProduct.price)}</div>
            <div><strong>Stock:</strong> {selectedProduct.stock}</div>
            {selectedProduct.barcode && <div><strong>Código:</strong> {selectedProduct.barcode}</div>}
            {selectedProduct.description && <div><strong>Descripción:</strong> {selectedProduct.description}</div>}
          </div>
          <h4 className="inv-detail__subtitle">Historial de movimientos</h4>
          {movements.length === 0 ? (
            <p className="inv-detail__empty">Sin movimientos registrados</p>
          ) : (
            <div className="inv-timeline">
              {movements.map(m => (
                <div key={m.id} className={`inv-timeline__item inv-timeline__item--${m.type}`}>
                  <div className="inv-timeline__dot" />
                  <div className="inv-timeline__body">
                    <div className="inv-timeline__head">
                      <span className={`badge badge-${m.type === 'in' ? 'success' : m.type === 'out' ? 'danger' : 'warning'}`}>
                        {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : 'Ajuste'}
                      </span>
                      <span className="inv-timeline__qty">{m.type === 'in' ? '+' : '-'}{m.quantity}</span>
                    </div>
                    <div className="inv-timeline__reason">{m.reason}{m.reference && ` — ${m.reference}`}</div>
                    <div className="inv-timeline__date">{new Date(m.timestamp).toLocaleString('es-MX')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && <ProductFormModal product={editingProduct} onSave={handleSaveProduct} onClose={() => { setShowForm(false); setEditingProduct(null) }} />}
      {showAdjust && selectedProduct && (
        <StockAdjustModal product={selectedProduct} onSave={handleSaveAdjust} onClose={() => setShowAdjust(false)} />
      )}
    </div>
  )
}

function ProductFormModal({ product, onSave, onClose }: {
  product: Product | null
  onSave: (data: Partial<Product>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name || '')
  const [category, setCategory] = useState<ProductCategory>(product?.category || 'otros')
  const [price, setPrice] = useState(String(product?.price || ''))
  const [stock, setStock] = useState(String(product?.stock ?? ''))
  const [barcode, setBarcode] = useState(product?.barcode || '')
  const [description, setDescription] = useState(product?.description || '')
  const [active, setActive] = useState(product?.active !== false)
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (!name.trim()) errs.push('Nombre requerido')
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) errs.push('Precio debe ser > 0')
    const s = parseInt(stock) || 0
    if (s < 0) errs.push('Stock no puede ser negativo')
    if (errs.length) { setErrors(errs); return }
    onSave({ name: name.trim(), category, price: p, stock: s, barcode: barcode.trim() || undefined, description: description.trim() || undefined, active })
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal__head">
          <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        {errors.length > 0 && <div className="inv-modal__errors">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
        <form onSubmit={handleSubmit} className="inv-form">
          <label>Nombre *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />

          <label>Categoría</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value as ProductCategory)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="inv-form__row">
            <div><label>Precio *</label><input className="input" type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><label>Stock inicial</label><input className="input" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} /></div>
          </div>

          <label>Código de barras</label>
          <input className="input" value={barcode} onChange={e => setBarcode(e.target.value)} />

          <label>Descripción</label>
          <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} />

          <label className="inv-checkbox">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Producto activo
          </label>

          <div className="inv-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{product ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StockAdjustModal({ product, onSave, onClose }: {
  product: Product
  onSave: (type: MovementType, quantity: number, reason: string, reference?: string) => void
  onClose: () => void
}) {
  const [type, setType] = useState<MovementType>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    const q = parseInt(quantity)
    if (isNaN(q) || q <= 0) errs.push('Cantidad debe ser > 0')
    if (!reason.trim()) errs.push('Razón requerida')
    if (type === 'out' && q > product.stock) errs.push(`Stock insuficiente (${product.stock})`)
    if (errs.length) { setErrors(errs); return }
    onSave(type, q, reason.trim(), reference.trim() || undefined)
  }

  const resultStock = type === 'in' ? product.stock + (parseInt(quantity) || 0)
    : type === 'out' ? Math.max(0, product.stock - (parseInt(quantity) || 0))
    : Math.max(0, parseInt(quantity) || 0)

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal__head">
          <h2>Ajustar stock — {product.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        {errors.length > 0 && <div className="inv-modal__errors">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
        <form onSubmit={handleSubmit} className="inv-form">
          <label>Tipo</label>
          <div className="inv-radio-group">
            {([['in', 'Entrada (+)' ], ['out', 'Salida (-)'], ['adjustment', 'Ajuste']] as [MovementType, string][]).map(([v, label]) => (
              <label key={v} className={`radio-option ${type === v ? 'radio-option--active' : ''}`}>
                <input type="radio" name="mov-type" value={v} checked={type === v} onChange={() => setType(v)} />
                {label}
              </label>
            ))}
          </div>

          <label>Cantidad *</label>
          <input className="input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus />

          <label>Razón *</label>
          <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Seleccionar...</option>
            <option value="recepcion">Recepción de mercancía</option>
            <option value="devolucion">Devolución</option>
            <option value="merma">Merma / Daño</option>
            <option value="inventario">Conteo físico</option>
            <option value="ajuste">Ajuste manual</option>
          </select>

          <label>Referencia (opcional)</label>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Factura, nota, etc." />

          <div className="inv-stock-preview">
            Stock actual: <strong>{product.stock}</strong> → Stock resultante: <strong>{resultStock}</strong>
          </div>

          <div className="inv-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Aplicar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
