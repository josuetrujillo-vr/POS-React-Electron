import { useEffect } from 'react'
import { useSyncStore } from '../store/syncStore'

const LOCAL_SYNC_HEALTH_URL = 'http://127.0.0.1:3001/health'

async function checkLocalServerConnection(): Promise<boolean> {
  if (window.electronAPI?.checkConnection) {
    return window.electronAPI.checkConnection()
  }

  try {
    const response = await fetch(LOCAL_SYNC_HEALTH_URL, {
      method: 'GET',
      cache: 'no-store'
    })
    return response.ok
  } catch (_err) {
    return false
  }
}

/**
 * Hook que detecta cambios en la conectividad real con el servidor local.
 * En Electron, navigator.onLine puede iniciar en false aunque localhost este vivo,
 * asi que el check contra /health es la fuente principal de verdad.
 */
export function useOnlineStatus(): boolean {
  const setOnline = useSyncStore(s => s.setOnline)
  const refreshPendingCount = useSyncStore(s => s.refreshPendingCount)

  useEffect(() => {
    let cancelled = false

    const checkRealConnection = async (source: string) => {
      try {
        if (cancelled) return

        if (!navigator.onLine) {
          console.log(`[Network] ${source}: navigator.onLine=false, verificando servidor local de todos modos.`)
        }

        const serverReachable = await checkLocalServerConnection()
        if (cancelled) return

        console.log(`[Network] ${source}: serverReachable=${serverReachable}`)
        setOnline(serverReachable)

        if (serverReachable) {
          await refreshPendingCount()
          await useSyncStore.getState().forceSync()
        }
      } catch (err) {
        console.error('[Network] Error al verificar conectividad con el servidor:', err)
        setOnline(false)
      }
    }

    const handleOnline = () => {
      console.log('[Network] Evento online. Verificando conexion al servidor local...')
      checkRealConnection('event:online')
    }

    const handleOffline = () => {
      console.log('[Network] Evento offline. Confirmando contra servidor local...')
      checkRealConnection('event:offline')
    }

    checkRealConnection('init')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = setInterval(() => checkRealConnection('poll'), 20_000)

    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [setOnline, refreshPendingCount])

  return useSyncStore(s => s.isOnline)
}
