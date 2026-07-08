import { getDB } from './index'
import type { Product, InventoryMovement, MovementType } from '../types'
import { generateId } from '../utils/generateId'

export async function getMovementsByProduct(productId: string): Promise<InventoryMovement[]> {
  const db = await getDB()
  return db.getAllFromIndex('inventory_movements', 'by-product', productId)
}

export async function getMovementsByDateRange(from: string, to: string): Promise<InventoryMovement[]> {
  const db = await getDB()
  const all = await db.getAll('inventory_movements')
  return all.filter(m => m.timestamp >= from && m.timestamp <= to)
}

export async function recordMovement(
  productId: string,
  type: MovementType,
  quantity: number,
  reason: string,
  reference?: string
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['inventory_movements', 'products'], 'readwrite')

  const movement: InventoryMovement = {
    id: generateId(),
    productId,
    type,
    quantity,
    reason,
    reference,
    timestamp: new Date().toISOString()
  }
  await tx.objectStore('inventory_movements').add(movement)

  const product = await tx.objectStore('products').get(productId)
  if (product) {
    if (type === 'in') product.stock += quantity
    else if (type === 'out') product.stock = Math.max(0, product.stock - quantity)
    else product.stock = Math.max(0, quantity)
    product.updatedAt = new Date().toISOString()
    await tx.objectStore('products').put(product)
  }

  await tx.done
}

export async function getLowStockProducts(threshold = 5): Promise<Product[]> {
  const db = await getDB()
  const all = await db.getAll('products')
  return all.filter(p => p.stock < threshold && p.active !== false)
}

export async function getInventoryValue(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('products')
  return all.filter(p => p.active !== false).reduce((sum, p) => sum + p.stock * p.price, 0)
}
