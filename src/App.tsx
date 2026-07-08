import React, { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Store, ShoppingCart, Clock, Settings, BarChart3, AlertCircle, CheckCircle2, Info, X, Package } from 'lucide-react'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { seedProductsIfEmpty } from './db/seeds'
import { useCartStore } from './store/cartStore'
import { useAppConfigStore } from './store/configStore'
import './styles/globals.css'

// ─── Lazy loading de pantallas ────────────────────────────────────────────
const SaleScreen     = lazy(() => import('./screens/SaleScreen/SaleScreen'))
const CheckoutScreen = lazy(() => import('./screens/CheckoutScreen/CheckoutScreen'))
const HistoryScreen  = lazy(() => import('./screens/HistoryScreen/HistoryScreen'))
const ReportsScreen  = lazy(() => import('./screens/ReportsScreen/ReportsScreen'))
const SettingsScreen  = lazy(() => import('./screens/SettingsScreen/SettingsScreen'))
const InventoryScreen = lazy(() => import('./screens/InventoryScreen/InventoryScreen'))

/**
 * Componente raíz de la aplicación.
 * Inicializa la DB, siembra productos, y renderiza el layout principal.
 */
const App: React.FC = () => {
  // Hook de conectividad — detecta online/offline y dispara sync automático
  useOnlineStatus()

  const toast = useCartStore(s => s.toast)
  const clearToast = useCartStore(s => s.clearToast)

  // Auto-cerrar notificación tras 4 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast()
      }, 4_000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [toast, clearToast])

  // Inicializar base de datos e insertar productos de demostración si está vacía
  useEffect(() => {
    useAppConfigStore.getState().loadConfig()
    seedProductsIfEmpty().catch(err =>
      console.error('[App] Error en seed inicial:', err)
    )
  }, [])

  return (
    <HashRouter>
      <div className="app-layout">
        {/* ─── Barra de estado superior ────────────────────────── */}
        <StatusBar />

        {/* ─── Notificaciones Flotantes (Toast) ──────────────────── */}
        {toast && (
          <div className="toast-container no-print">
            <div className={`toast toast--${toast.type}`}>
              <span className="toast__icon">
                {toast.type === 'error' && <AlertCircle size={20} className="text-danger" />}
                {toast.type === 'info' && <Info size={20} className="text-info" />}
                {toast.type === 'success' && <CheckCircle2 size={20} className="text-success" />}
              </span>
              <div className="toast__content">
                <div className="toast__message">{toast.message}</div>
              </div>
              <button className="toast__close" onClick={clearToast} aria-label="Cerrar notificación">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="app-content">
          {/* ─── Sidebar de navegación ───────────────────────── */}
          <nav className="sidebar" role="navigation" aria-label="Navegación principal">
            <span className="sidebar-logo" title="POS Vaquero">
              <Store size={28} className="text-brand-gold" />
            </span>

            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Venta">
              <ShoppingCart size={20} />
            </NavLink>

            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Historial">
              <Clock size={20} />
            </NavLink>

            <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Reportes">
              <BarChart3 size={20} />
            </NavLink>

            <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Inventario">
              <Package size={20} />
            </NavLink>

            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Configuración" style={{ marginTop: 'auto' }}>
              <Settings size={20} />
            </NavLink>
          </nav>

          {/* ─── Contenido principal con lazy loading ─────────── */}
          <Suspense fallback={<AppLoadingFallback />}>
            <Routes>
              <Route path="/"         element={<SaleScreen />} />
              <Route path="/checkout" element={<CheckoutScreen />} />
              <Route path="/history"  element={<HistoryScreen />} />
              <Route path="/reports"  element={<ReportsScreen />} />
              <Route path="/inventory" element={<InventoryScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </HashRouter>
  )
}

/** Fallback de carga para Suspense */
const AppLoadingFallback: React.FC = () => (
  <div style={{
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: 14
  }}>
    Cargando...
  </div>
)

export default App
