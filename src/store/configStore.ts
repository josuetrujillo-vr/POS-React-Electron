import { create } from 'zustand'

export interface AppConfigState {
  businessName: string
  businessAddress: string
  syncUrl: string
  printerType: 'usb' | 'network' | 'none'
  printerHost: string
  printerPort: number
  loadConfig: () => void
  setConfig: <K extends keyof Omit<AppConfigState, 'loadConfig' | 'setConfig'>>(key: K, value: AppConfigState[K]) => void
}

const STORAGE_KEY = 'pos-vaquero:config'

const defaultState = {
  businessName: 'Ropa Vaquera',
  businessAddress: '',
  syncUrl: 'http://127.0.0.1:3001/api/sales',
  printerType: 'none' as const,
  printerHost: '',
  printerPort: 9100
}

function pushConfigToElectron(config: Partial<typeof defaultState>) {
  if (!window.electronAPI?.setConfig) return

  for (const [key, value] of Object.entries(config)) {
    window.electronAPI.setConfig(key, value).catch(err => {
      console.warn(`[Config] No se pudo sincronizar ${key} con Electron:`, err)
    })
  }
}

function readStoredConfig() {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<typeof defaultState> : {}
  } catch {
    return {}
  }
}

export const useAppConfigStore = create<AppConfigState>((set, get) => ({
  ...defaultState,
  loadConfig: () => {
    const stored = readStoredConfig()
    const next = {
      ...defaultState,
      ...stored
    }
    set(next)
    pushConfigToElectron(next)
  },
  setConfig: (key, value) => {
    set(state => ({ ...state, [key]: value }))
    const next = {
      ...defaultState,
      ...get(),
      [key]: value
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    pushConfigToElectron({ [key]: value })
  }
}))
