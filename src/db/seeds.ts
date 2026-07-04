import { bulkUpsertProducts, countProducts } from './products'
import type { Product } from '../types'

/**
 * Datos de demostración para el catálogo de ropa vaquera.
 * Se insertan automáticamente en la primera ejecución de la app.
 * Editar o reemplazar con el catálogo real del negocio.
 */
const SEED_PRODUCTS: Omit<Product, 'createdAt' | 'updatedAt'>[] = [
  // ─── Pantalones ─────────────────────────────────────────────────────────
  { id: 'p-001', name: 'Pantalón Wrangler Clásico', category: 'pantalones', price: 850, stock: 25 },
  { id: 'p-002', name: 'Pantalón Vaquero Slim Azul', category: 'pantalones', price: 720, stock: 18 },
  { id: 'p-003', name: 'Pantalón Levie\'s 501 Stonewash', category: 'pantalones', price: 980, stock: 12 },
  { id: 'p-004', name: 'Pantalón Wrangler Negro 13MWZ', category: 'pantalones', price: 890, stock: 20 },
  { id: 'p-005', name: 'Pantalón Cinturilla Alta Mujer', category: 'pantalones', price: 760, stock: 15 },

  // ─── Sombreros ────────────────────────────────────────────────────────────
  { id: 's-001', name: 'Sombrero Vaquero Palma Natural', category: 'sombreros', price: 450, stock: 30 },
  { id: 's-002', name: 'Sombrero Texano Fieltro Negro', category: 'sombreros', price: 1_200, stock: 10 },
  { id: 's-003', name: 'Sombrero Palma Fino 20X', category: 'sombreros', price: 680, stock: 22 },
  { id: 's-004', name: 'Sombrero Fieltro Café Rodeo', category: 'sombreros', price: 950, stock: 8 },
  { id: 's-005', name: 'Sombrero Paja Premium Verano', category: 'sombreros', price: 380, stock: 40 },

  // ─── Camisas ──────────────────────────────────────────────────────────────
  { id: 'c-001', name: 'Camisa Vaquera Cuadros Azul/Blanco', category: 'camisas', price: 560, stock: 20 },
  { id: 'c-002', name: 'Camisa Western Snap Buttons Roja', category: 'camisas', price: 620, stock: 15 },
  { id: 'c-003', name: 'Camisa Bordada Floral Mujer', category: 'camisas', price: 680, stock: 18 },
  { id: 'c-004', name: 'Camisa Wrangler Manga Larga Verde', category: 'camisas', price: 580, stock: 22 },
  { id: 'c-005', name: 'Camisa Western Premium Blanca', category: 'camisas', price: 750, stock: 12 },

  // ─── Botas ────────────────────────────────────────────────────────────────
  { id: 'b-001', name: 'Bota Vaquera Piel Café Clásica', category: 'botas', price: 2_400, stock: 8 },
  { id: 'b-002', name: 'Bota Texana Negra Puntiaguda', category: 'botas', price: 2_800, stock: 6 },
  { id: 'b-003', name: 'Bota Vaquera Mujer Café Bordada', category: 'botas', price: 2_200, stock: 10 },
  { id: 'b-004', name: 'Bota Corta Trabajadora Marrón', category: 'botas', price: 1_850, stock: 12 },
  { id: 'b-005', name: 'Bota Exótica Piel de Víbora', category: 'botas', price: 4_500, stock: 4 },

  // ─── Cintos ───────────────────────────────────────────────────────────────
  { id: 'ci-001', name: 'Cinto Piel Café Hebilla Grande', category: 'cintos', price: 380, stock: 25 },
  { id: 'ci-002', name: 'Cinto Negro Piel con Tachuelas', category: 'cintos', price: 420, stock: 20 },
  { id: 'ci-003', name: 'Cinto Bordado Mujer Rosa/Turquesa', category: 'cintos', price: 350, stock: 18 },
  { id: 'ci-004', name: 'Cinto Tejano Premium Doble Hebilla', category: 'cintos', price: 580, stock: 10 },

  // ─── Chamarras ────────────────────────────────────────────────────────────
  { id: 'ch-001', name: 'Chamarra Vaquera Mezclilla', category: 'chamarras', price: 1_200, stock: 8 },
  { id: 'ch-002', name: 'Chamarra Piel Café Vaquero', category: 'chamarras', price: 3_200, stock: 5 },
  { id: 'ch-003', name: 'Chaleco Vaquero Mezclilla', category: 'chamarras', price: 680, stock: 12 },

  // ─── Accesorios ───────────────────────────────────────────────────────────
  { id: 'a-001', name: 'Pañuelo Bandana Estampado', category: 'accesorios', price: 80, stock: 60 },
  { id: 'a-002', name: 'Hebilla Western Águila Dorada', category: 'accesorios', price: 250, stock: 15 },
  { id: 'a-003', name: 'Espuelas Decorativas Plata', category: 'accesorios', price: 320, stock: 8 },
  { id: 'a-004', name: 'Calcetas Vaqueras Algodón (3 pack)', category: 'accesorios', price: 120, stock: 40 }
]

/**
 * Inserta los productos de demostración si la base de datos está vacía.
 * Llamar al inicio de la app (App.tsx → useEffect).
 */
export async function seedProductsIfEmpty(): Promise<void> {
  try {
    const count = await countProducts()
    if (count > 0) {
      console.log(`[Seed] Ya existen ${count} productos, omitiendo seed.`)
      return
    }

    const now = new Date().toISOString()
    const products: Product[] = SEED_PRODUCTS.map(p => ({
      ...p,
      createdAt: now,
      updatedAt: now
    }))

    await bulkUpsertProducts(products)
    console.log(`[Seed] ${products.length} productos insertados correctamente.`)
  } catch (err) {
    console.error('[Seed] Error al insertar productos:', err)
  }
}
