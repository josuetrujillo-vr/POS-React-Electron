import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../../store/syncStore'
import { useAppConfigStore } from '../../store/configStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatMXN } from '../../utils/formatCurrency'
import './StatusBar.css'
import icono from '../../assets/botas-wellington.png'

/**
 * Barra de estado superior de la aplicación.
 * Muestra: nombre del negocio | estado de conexión | ventas pendientes | botón sync | hora
 */
export const StatusBar: React.FC = () => {
  const navigate = useNavigate()
  const { isOnline, isSyncing, pendingCount, lastSyncAt, forceSync } = useSyncStore()
  const businessName = useAppConfigStore(s => s.businessName)
  const lowStockCount = useInventoryStore(s => s.lowStockCount)
  const loadLowStockCount = useInventoryStore(s => s.loadLowStockCount)

  const [time, setTime] = React.useState(new Date())

  React.useEffect(() => { loadLowStockCount() }, [])

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const handleForceSync = async () => {
    if (!isOnline || isSyncing) return
    await forceSync()
  }

  return (
    <header className="status-bar">
      {/* Nombre del negocio */}
      <div className="status-bar__brand">
        <span className="status-bar__icon">
        <img src={icono} alt="Icono" />
        </span>
        <span className="status-bar__name">{businessName || 'POS Vaquero'}</span>
      </div>

      {/* Estado de conexión */}
      <div className="status-bar__center">
        <div className={`connection-badge ${isOnline ? 'connection-badge--online' : 'connection-badge--offline'}`}>
          <span className="connection-badge__dot" />
          <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>

        {/* Ventas pendientes de sync */}
        {pendingCount > 0 && (
          <button
            className={`sync-btn ${isSyncing ? 'sync-btn--loading' : ''}`}
            onClick={handleForceSync}
            disabled={!isOnline || isSyncing}
            title={`${pendingCount} venta(s) pendiente(s) de sincronizar`}
          >
            <span className={`sync-btn__icon ${isSyncing ? 'spinning' : ''}`}>⟳</span>
            <span>{isSyncing ? 'Sincronizando...' : `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`}</span>
          </button>
        )}

        {/* Stock bajo */}
        {lowStockCount > 0 && (
          <button className="sync-btn" onClick={() => navigate('/inventory')} title="Productos con stock bajo">
            <span className="sync-btn__icon">!</span>
            <span>{lowStockCount} producto{lowStockCount > 1 ? 's' : ''} bajo stock</span>
          </button>
        )}

        {/* Último sync exitoso */}
        {lastSyncAt && pendingCount === 0 && (
          <span className="status-bar__sync-ok">
            ✓ Sincronizado {new Date(lastSyncAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Hora actual */}
      <div className="status-bar__time">
        {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </header>
  )
}
