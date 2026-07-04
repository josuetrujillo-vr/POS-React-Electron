import { getDB } from './index'
import type { Product, ProductCategory } from '../types'

/**
 * Capa de acceso a datos para productos.
 * Todas las operaciones son asíncronas y usan IndexedDB.
 */

/** Obtiene todos los productos */
export async function getAllProducts(): Promise<Product[]> {
  const db = await getDB()
  return db.getAll('products')
}

/** Obtiene un producto por su ID */
export async function getProductById(id: string): Promise<Product | undefined> {
  const db = await getDB()
  return db.get('products', id)
}

/** Obtiene todos los productos de una categoría */
export async function getProductsByCategory(category: ProductCategory): Promise<Product[]> {
  const db = await getDB()
  return db.getAllFromIndex('products', 'by-category', category)
}

/** Busca productos por nombre (búsqueda local simple y eficiente) */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return getAllProducts()
  const allProducts = await getAllProducts()
  const q = query.toLowerCase().trim()
  return allProducts.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.barcode?.includes(q)
  )
}

/** Guarda o actualiza un producto (upsert por ID) */
export async function upsertProduct(product: Product): Promise<void> {
  const db = await getDB()
  await db.put('products', {
    ...product,
    updatedAt: new Date().toISOString()
  })
}

/** Elimina un producto por su ID */
export async function deleteProduct(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('products', id)
}

/** Guarda múltiples productos en una sola transacción (eficiente para seed) */
export async function bulkUpsertProducts(products: Product[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')
  await Promise.all([
    ...products.map(p => tx.store.put(p)),
    tx.done
  ])
}

/** Cuenta total de productos */
export async function countProducts(): Promise<number> {
  const db = await getDB()
  return db.count('products')
}
