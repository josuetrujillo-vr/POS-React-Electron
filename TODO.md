# TODO - AppVentas (Sync, Inventario y Reportes)

## Problema 1: Sincronización independiente de impresión
- [ ] 1.1 Revisar `src/services/syncService.ts`: actualizar `syncOne` para que haga `await flushQueue()` (evitar acoplar sync a timing/UI).
- [ ] 1.2 Agregar logging más detallado en `flushQueue` sobre elegibilidad por backoff (attempts/lastAttempt) y resultados por venta.
- [ ] 1.3 Revisar `src/store/syncStore.ts`: asegurar que `forceSync` no dispare múltiples flush simultáneos (mantener/ajustar `isSyncing`).
- [ ] 1.4 Verificar que `useOnlineStatus` dispare sync automáticamente al recuperar conexión sin bloquear por impresión.

## Problema 2: Límite de productos en carrito y click directo
- [ ] 2.1 Implementar validación centralizada en `src/store/cartStore.ts`:
  - [ ] helper `getCartQty(productId)`
  - [ ] helper `canSetQuantity(productId, desiredQty)` que re-chequea stock en IndexedDB y valida:
    - agotado (stockAvailable <= 0)
    - máximo disponible por producto
    - máximo total en carrito (desiredQty no puede exceder stock)
  - [ ] usar esta lógica tanto en `addItem` (currentQty+1) como en `updateQuantity`.
- [ ] 2.2 Asegurar mensajes claros cuando se alcance límite (incluyendo stock disponible).
- [ ] 2.3 Validar edge cases:
  - [ ] stock cambia durante sesión (si falla re-chequeo, bloquear/capar)
  - [ ] productos agotados
  - [ ] sincronización/flush concurrente mientras usuario está en carrito
- [ ] 2.4 `src/components/ProductGrid/ProductGrid.tsx`: mantener el disabled como ayuda visual; la verdad de límites debe estar en `cartStore`.

## Problema 3: Gráficas de ventas realizadas
- [ ] 3.1 Revisar `src/screens/ReportsScreen/ReportsScreen.tsx`:
  - [ ] conservar filtros `day/week/month` y update en tiempo real (sin recargar página)
  - [ ] validar períodos vacíos (estado específico, sin errores)
- [ ] 3.2 Añadir “gráfica interactiva” para productos más vendidos:
  - [ ] barra SVG por producto según cantidad (top list filtrada por período)
  - [ ] hover/tooltip similar al de la gráfica de línea (opcional si encaja con estilo actual)

## Integración y verificación
- [ ] 4.1 Ejecutar `npm run typecheck` (si existe) o `npm run build`.
- [ ] 4.2 Ejecutar `npm run build`.
- [ ] 4.3 Validar manualmente:
  - [ ] vender sin imprimir: debe encolarse y sincronizarse al estar online
  - [ ] click rápido en producto: no debe superar el stock
  - [ ] cambiar período en reportes: gráficos cambian sin recargar

