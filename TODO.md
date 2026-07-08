# TODO - Gestión de Inventario

Basado en la tabla de "Características futuras (documentadas)" del README: `src/screens/InventoryScreen/` — Pendiente.

---

## 1. Capa de datos (IndexedDB)

- [ ] **1.1 Nuevo object store `inventory_movements`** en `src/db/index.ts`
  - schema: `{ id, productId, type: 'in' | 'out' | 'adjustment', quantity, reason, reference?, timestamp, userId? }`
  - keyPath: `'id'`
  - indexes: `'by-product'`, `'by-timestamp'`, `'by-type'`
  - incrementar DB_VERSION a 2 con upgrade path

- [ ] **1.2 Crear `src/db/inventory.ts`** con operaciones CRUD:
  - `getMovementsByProduct(productId)` — historial de movimientos de un producto
  - `getMovementsByDateRange(from, to)` — filtrar por fecha
  - `recordMovement(productId, type, quantity, reason, reference?)` — registrar + ajustar stock en transaction atómica
  - `getLowStockProducts(threshold?)` — productos con stock <= umbral
  - `getInventoryValue()` — valor total del inventario (stock * precio)

## 2. Store (estado global)

- [ ] **2.1 Crear `src/store/inventoryStore.ts`** (Zustand):
  - State: `products[]`, `movements[]`, `isLoading`, `error`, `filter`, `sortBy`
  - Actions: `loadProducts()`, `loadMovements(productId)`, `addProduct(product)`, `updateProduct(product)`, `deleteProduct(id)`, `adjustStock(productId, quantity, reason)`, `setFilter(query)`, `setSort(column, dir)`

## 3. Pantalla de inventario

- [ ] **3.1 Crear `src/screens/InventoryScreen/InventoryScreen.tsx`** con layout:
  - **Encabezado**: título "Inventario", botón "Nuevo producto", botón "Ajustar stock", búsqueda
  - **Tabla de productos**: columnas: Nombre, Categoría, Precio, Stock, Valor inventario, Última actualización, Acciones
  - **Panel lateral** (o modal) para detalle de producto + historial de movimientos
  - Estados: carga (skeleton), vacío ("No hay productos — agrega tu primer producto"), error

- [ ] **3.2 Crear `src/screens/InventoryScreen/InventoryScreen.css`** (co-located, sigue los patrones de `--var` existentes)

## 4. Componentes reutilizables

- [ ] **4.1 `src/components/InventoryTable/InventoryTable.tsx`**:
  - Tabla responsive con sort por columna (click en header)
  - Badge de stock bajo (rojo si stock <= 5, amarillo si <= 10)
  - Acciones por fila: editar, ajustar stock, eliminar (con confirmación)
  - Paginación inline

- [ ] **4.2 `src/components/ProductForm/ProductForm.tsx`**:
  - Modal/formulario para crear/editar producto
  - Campos: nombre, categoría (select), precio, stock inicial, código de barras, descripción
  - Validación: nombre requerido, precio > 0, stock >= 0
  - Modo "crear" vs "editar" (precarga datos)

- [ ] **4.3 `src/components/StockAdjustModal/StockAdjustModal.tsx`**:
  - Modal para ajustar stock de un producto existente
  - Tipo: entrada (+), salida (-), ajuste manual
  - Cantidad, razón (select o libre), referencia opcional (nota, factura)
  - Muestra stock actual + stock resultante

- [ ] **4.4 `src/components/MovementHistory/MovementHistory.tsx`**:
  - Timeline/historial de movimientos de un producto
  - Muestra: fecha, tipo (icono + color), cantidad, razón, referencia
  - Filtro por tipo de movimiento

## 5. Integración en la app

- [ ] **5.1 Agregar ruta `/inventory`** en `src/App.tsx`:
  ```tsx
  const InventoryScreen = lazy(() => import('./screens/InventoryScreen/InventoryScreen'))
  ```
  - Añadir `<Route path="/inventory" element={<InventoryScreen />} />`
  - Mover Settings al final, agregar Inventory en la sidebar ANTES de Settings

- [ ] **5.2 Agregar NavLink** en la sidebar de `src/App.tsx`:
  - Ícono: `Package` (de lucide-react) — importar `Package`
  - title: "Inventario"

- [ ] **5.3 Actualizar `saveSale()`** en `src/db/sales.ts` para que también registre movimiento de salida:
  - Al vender, llamar `recordMovement(productId, 'out', quantity, 'venta', saleId)`

## 6. Funcionalidades adicionales

- [ ] **6.1 Alerta de stock bajo** en `StatusBar`:
  - Contar productos con stock bajo al cargar, mostrar badge si > 0
  - Click navega a `/inventory` con filtro de stock bajo

- [ ] **6.2 Vista de "Valor de inventario"**:
  - KPI card en el encabezado: "$XX,XXX.00 valor total en inventario"
  - Contar número de productos únicos y total de unidades

- [ ] **6.3 Importar/exportar productos**:
  - Botón "Importar CSV" con parser
  - Botón "Exportar CSV" descarga de todos los productos
  - Confirmación antes de importar (vista previa de cambios)

- [ ] **6.4 Desactivar productos** (en lugar de eliminar):
  - Campo `active: boolean` en Product (default true)
  - Productos inactivos no aparecen en catálogo de venta
  - Se muestran en inventario con indicador visual (tachado/badge)

## 7. Verificación y calidad

- [ ] **7.1 TypeScript**: asegurar tipos correctos en todos los archivos nuevos
- [ ] **7.2 Prueba de build**: `npm run build` debe compilar sin errores
- [ ] **7.3 Prueba manual**:
  - Crear producto nuevo → aparece en catálogo de venta
  - Editar producto → cambios reflejados al vender
  - Ajustar stock manual → el límite en carrito respeta el nuevo stock
  - Vender producto → stock decrementa y se registra movimiento
  - Stock bajo → badge visible en StatusBar
  - Importar CSV → productos creados correctamente
