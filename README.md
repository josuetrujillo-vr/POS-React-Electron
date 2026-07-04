# POS Vaquero 🤠

Sistema de punto de venta **offline-first** para local de ropa vaquera. Construido con React + Electron.

## Características

- ✅ **Offline completo** — funciona sin internet. Ventas guardadas localmente en IndexedDB
- ✅ **Sync automático** — cuando regresa la conexión, sincroniza todas las ventas pendientes
- ✅ **Catálogo** — 30 productos de ropa vaquera precargados, búsqueda y filtro por categoría
- ✅ **Carrito** — agregar productos, ajustar cantidades, descuentos por item y globales
- ✅ **Checkout** — cálculo de cambio, IVA desglosado (incluido en precio), múltiples métodos de pago
- ✅ **Historial del día** — todas las ventas con totales, estado de sync, re-impresión
- ✅ **Impresión ESC/POS** — compatible con impresoras USB y de red (Epson, Star, genéricas)
- ✅ **Deduplicación** — cada venta tiene UUID único; el servidor puede detectar duplicados (409)

---

## Requisitos

- **Node.js** 18+ y **npm** 9+
- **Windows** 10/11 (también funciona en macOS y Linux)
- Para impresoras USB en Windows: drivers del fabricante o [Zadig](https://zadig.akeo.ie/) para WinUSB

---

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar en modo desarrollo (con hot-reload)
npm run dev

# 3. Build de producción
npm run build

# 4. Build instalador Windows (.exe)
npm run build:win
```

---

## Estructura del proyecto

```
AppVentas/
├── electron/                  # Proceso principal Electron (Node)
│   ├── main.ts                # Entry point, BrowserWindow
│   ├── preload.ts             # Bridge seguro renderer ↔ main
│   └── ipc/
│       ├── printer.ts         # Impresión ESC/POS (USB y red)
│       └── sync.ts            # Sincronización HTTP con retry
│
├── src/                       # Proceso renderer (React)
│   ├── App.tsx                # Router + layout + seed inicial
│   ├── types/index.ts         # TypeScript types compartidos
│   ├── db/                    # Capa IndexedDB (idb)
│   │   ├── index.ts           # Schema y conexión
│   │   ├── products.ts        # CRUD productos
│   │   ├── sales.ts           # CRUD ventas + cola sync
│   │   └── seeds.ts           # 30 productos de demostración
│   ├── store/                 # Estado global (Zustand)
│   │   ├── cartStore.ts       # Carrito y cálculo de totales
│   │   ├── salesStore.ts      # Ventas del día
│   │   └── syncStore.ts       # Estado de conexión y sync
│   ├── services/
│   │   ├── syncService.ts     # Cola de sync, flush, dedup
│   │   ├── printService.ts    # Proxy de impresión → IPC
│   │   └── paymentTerminal.stub.ts  # Interfaz futura TPV
│   ├── hooks/
│   │   └── useOnlineStatus.ts # Detecta conexión, dispara sync
│   ├── screens/               # Pantallas (lazy-loaded)
│   │   ├── SaleScreen/        # Catálogo + carrito
│   │   ├── CheckoutScreen/    # Resumen + pago + confirmación
│   │   ├── HistoryScreen/     # Historial del día
│   │   └── SettingsScreen/    # Configuración
│   ├── components/
│   │   ├── StatusBar/         # Online/offline + sync badge
│   │   ├── ProductGrid/       # Grid de productos con búsqueda
│   │   ├── CartPanel/         # Panel del carrito
│   │   └── SaleCard/          # Tarjeta de venta en historial
│   └── utils/
│       ├── formatCurrency.ts  # Formato MXN
│       └── generateId.ts      # UUID v4 + numeración de tickets
│
├── electron.vite.config.ts
├── package.json
└── README.md
```

---

## Configuración del servidor de sincronización

La URL de sync se configura en **Configuración → Sincronización**.

El servidor debe aceptar `POST /api/sales` con el siguiente body:

```json
{
  "id": "uuid-v4-único",
  "saleNumber": "0001",
  "items": [...],
  "total": 1234.56,
  "paymentMethod": "efectivo",
  "timestamp": "2026-07-03T20:00:00.000Z",
  ...
}
```

Respuestas esperadas:
- `201 Created` — éxito
- `409 Conflict` — venta ya existe (deduplicación) → el cliente la marca como sincronizada
- `5xx` — error transitorio → se reintenta con backoff exponencial

---

## Impresora de tickets

### USB (recomendado)
La impresora se detecta automáticamente. En Windows, si no funciona:
1. Descarga [Zadig](https://zadig.akeo.ie/)
2. Conecta la impresora y selecciónala en Zadig
3. Instala el driver **WinUSB**

### Red (TCP/IP)
En **Configuración → Impresora**, selecciona "Red" e introduce la IP y puerto (por defecto 9100).

### Impresoras compatibles
Cualquier impresora ESC/POS: Epson TM series, Star Micronics, genéricas chinas.

---

## Flujo de datos offline

```
Venta confirmada
     │
     ▼
saveSale() ──→ IndexedDB (sales)
                   │
                   ├──→ sync_queue (pendiente)
                   │
                   └──→ Si online: syncOne() inmediato
                              │
                              ├── Éxito: markSynced() → elimina de queue
                              └── Fallo: markSyncFailed() → queda en queue

Al recuperar conexión:
     │
     ▼
useOnlineStatus → setOnline(true) → forceSync() → syncBatch(queue)
```

---

## IVA (16% incluido en precio)

Los precios de los productos ya incluyen IVA. El ticket desglosa:

```
Precio del producto: $850.00 (IVA incluido)
                          ↓
Subtotal sin IVA:   $732.76   (= total / 1.16)
IVA (16%):          $117.24   (= total - subtotal)
TOTAL:              $850.00
```

Para cambiar la tasa de IVA, modifica `IVA_RATE` en `src/store/cartStore.ts`.

---

## Características futuras (documentadas)

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Terminal de pagos (CLIP, iZettle) | `src/services/paymentTerminal.stub.ts` | Interfaz lista |
| Gestión de inventario | `src/screens/InventoryScreen/` | Pendiente |
| Reportes de ventas | `src/screens/ReportsScreen/` | Pendiente |
| Multi-usuario / turnos | `src/store/authStore.ts` | Pendiente |
| Auto-updater | `electron/updater.ts` | Pendiente |

---

## Rendimiento en hardware antiguo

- **Lazy loading**: cada pantalla se carga solo cuando se navega a ella
- **Memoización**: `ProductCard` y filtros de catálogo están memoizados con `React.memo` y `useMemo`
- **IndexedDB**: todas las operaciones son asíncronas, nunca bloquean el hilo principal
- **Sin librerías pesadas**: Zustand (~1KB), idb (~5KB), sin UI framework externo
- **Bundle estimado**: ~180KB gzipped (sin contar Electron)
