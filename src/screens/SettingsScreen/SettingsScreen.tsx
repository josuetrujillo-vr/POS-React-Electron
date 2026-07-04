import React, { useEffect, useState } from 'react'
import { Store, RefreshCw, Printer, Usb, Network, Ban, Rocket, CreditCard, Package, BarChart, Check } from 'lucide-react'
import { useAppConfigStore } from '../../store/configStore'
import './SettingsScreen.css'

/**
 * Pantalla de configuración de la aplicación.
 * Permite configurar: nombre del negocio, URL de sync, impresora.
 *
 * Los valores se guardan via IPC al proceso principal de Electron
 * (config:set) para persistencia entre sesiones.
 */
const SettingsScreen: React.FC = () => {
  const { businessName, businessAddress, syncUrl, printerType, printerHost, printerPort, loadConfig, setConfig } = useAppConfigStore()
  const [localBusinessName, setLocalBusinessName] = useState(businessName)
  const [localBusinessAddress, setLocalBusinessAddress] = useState(businessAddress)
  const [localSyncUrl, setLocalSyncUrl] = useState(syncUrl)
  const [localPrinterType, setLocalPrinterType] = useState<'usb' | 'network' | 'none'>(printerType)
  const [localPrinterHost, setLocalPrinterHost] = useState(printerHost)
  const [localPrinterPort, setLocalPrinterPort] = useState(String(printerPort))
  const [saved, setSaved] = useState(false)
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    setLocalBusinessName(businessName)
    setLocalBusinessAddress(businessAddress)
    setLocalSyncUrl(syncUrl)
    setLocalPrinterType(printerType)
    setLocalPrinterHost(printerHost)
    setLocalPrinterPort(String(printerPort))
  }, [businessName, businessAddress, syncUrl, printerType, printerHost, printerPort])

  const handleSave = async () => {
    setConfig('businessName', localBusinessName)
    setConfig('businessAddress', localBusinessAddress)
    setConfig('syncUrl', localSyncUrl)
    setConfig('printerType', localPrinterType)
    setConfig('printerHost', localPrinterHost)
    setConfig('printerPort', parseInt(localPrinterPort) || 9100)
    setSaved(true)
    setTimeout(() => setSaved(false), 2_500)
  }

  const handleTestPrint = async () => {
    setTestPrintStatus('Imprimiendo...')
    const testReceipt = {
      saleNumber: '0000',
      timestamp: new Date().toISOString(),
      items: [{ name: 'Prueba de impresión', qty: 1, price: 0 }],
      subtotal: 0,
      discount: 0,
      total: 0,
      paymentMethod: 'Prueba'
    }
    const result = await window.electronAPI?.print(testReceipt)
    setTestPrintStatus(result?.success ? 'Impresión exitosa' : `Error: ${result?.error}`)
    setTimeout(() => setTestPrintStatus(null), 4_000)
  }

  return (
    <div className="settings-screen">
      <div className="settings-inner">
        <h1 className="settings-title">Configuración</h1>

        {/* ─── Negocio ──────────────────────────────────────────── */}
        <section className="settings-section card">
          <h2 className="settings-section__title">
            <Store size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Negocio
          </h2>
          <div className="settings-field">
            <label htmlFor="biz-name">Nombre del negocio</label>
            <input
              id="biz-name"
              className="input"
              value={localBusinessName}
              onChange={e => setLocalBusinessName(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="biz-addr">Dirección (aparece en el ticket)</label>
            <input
              id="biz-addr"
              className="input"
              value={localBusinessAddress}
              onChange={e => setLocalBusinessAddress(e.target.value)}
              placeholder="Calle, Número, Ciudad"
            />
          </div>
        </section>

        {/* ─── Sincronización ───────────────────────────────────── */}
        <section className="settings-section card">
          <h2 className="settings-section__title">
            <RefreshCw size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Sincronización
          </h2>
          <div className="settings-field">
            <label htmlFor="sync-url">URL del servidor</label>
            <input
              id="sync-url"
              className="input"
              value={localSyncUrl}
              onChange={e => setLocalSyncUrl(e.target.value)}
              placeholder="http://tu-servidor.com/api/sales"
            />
            <span className="settings-field__hint">
              Las ventas se sincronizan automáticamente cuando hay conexión.
              Si el servidor no está disponible, se reintenta automáticamente.
            </span>
          </div>
        </section>

        {/* ─── Impresora ────────────────────────────────────────── */}
        <section className="settings-section card">
          <h2 className="settings-section__title">
            <Printer size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Impresora de Tickets
          </h2>

          <div className="settings-field">
            <label>Tipo de impresora</label>
            <div className="settings-radio-group">
              {(['usb', 'network', 'none'] as const).map(t => (
                <label key={t} className={`radio-option ${localPrinterType === t ? 'radio-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="printer-type"
                    value={t}
                    checked={localPrinterType === t}
                    onChange={() => setLocalPrinterType(t)}
                  />
                  {t === 'usb' ? <><Usb size={16} /> USB</> : t === 'network' ? <><Network size={16} /> Red (IP)</> : <><Ban size={16} /> Sin impresora</>}
                </label>
              ))}
            </div>
          </div>

          {localPrinterType === 'network' && (
            <div className="settings-field animate-fade-in">
              <label htmlFor="printer-host">IP de la impresora</label>
              <input
                id="printer-host"
                className="input"
                value={localPrinterHost}
                onChange={e => setLocalPrinterHost(e.target.value)}
                placeholder="192.168.1.100"
              />
              <label htmlFor="printer-port" style={{ marginTop: 8 }}>Puerto</label>
              <input
                id="printer-port"
                className="input"
                type="number"
                value={localPrinterPort}
                onChange={e => setLocalPrinterPort(e.target.value)}
                placeholder="9100"
              />
            </div>
          )}

          {localPrinterType !== 'none' && (
            <div className="settings-test-print">
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTestPrint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} /> Imprimir ticket de prueba
              </button>
              {testPrintStatus && (
                <span className={`settings-test-status ${testPrintStatus === 'Impresión exitosa' ? 'settings-test-status--ok' : 'settings-test-status--err'}`}>
                  {testPrintStatus}
                </span>
              )}
            </div>
          )}

          <div className="settings-note">
            <strong>Nota:</strong> Para impresoras USB en Windows, asegúrate de tener instalados los drivers
            o usa Zadig para convertir el driver a WinUSB. Las impresoras ESC/POS (Epson, Star, genéricas)
            son compatibles sin configuración adicional.
          </div>
        </section>

        {/* ─── Características futuras ──────────────────────────── */}
        <section className="settings-section card settings-section--future">
          <h2 className="settings-section__title">
            <Rocket size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Próximamente
          </h2>
          <div className="future-features">
            <div className="future-feature">
              <span className="future-feature__icon"><CreditCard size={24} /></span>
              <div>
                <strong>Terminal de pagos</strong>
                <p>Integración con CLIP, iZettle u otras terminales bancarias vía API plug-and-play.</p>
              </div>
              <span className="badge badge-muted">En desarrollo</span>
            </div>
            <div className="future-feature">
              <span className="future-feature__icon"><Package size={24} /></span>
              <div>
                <strong>Gestión de inventario</strong>
                <p>Control de stock, alertas de inventario bajo, y recepción de mercancía.</p>
              </div>
              <span className="badge badge-muted">Planeado</span>
            </div>
            <div className="future-feature">
              <span className="future-feature__icon"><BarChart size={24} /></span>
              <div>
                <strong>Reportes</strong>
                <p>Ventas por período, por producto, por empleado.</p>
              </div>
              <span className="badge badge-muted">Planeado</span>
            </div>
          </div>
        </section>

        {/* ─── Guardar ─────────────────────────────────────────── */}
        <div className="settings-actions">
          <button
            id="save-settings-btn"
            className={`btn btn-primary btn-lg ${saved ? 'btn-success' : ''}`}
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saved ? <><Check size={18} /> Configuración guardada</> : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen
