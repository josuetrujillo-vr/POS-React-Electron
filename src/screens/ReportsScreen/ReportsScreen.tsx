import React, { useState, useEffect, useMemo } from 'react'
import { TrendingUp, DollarSign, ShoppingBag, Calendar, BarChart3, AlertTriangle, Inbox, Check, RefreshCw } from 'lucide-react'

import { getSalesByDateRange } from '../../db/sales'
import { useSalesStore } from '../../store/salesStore'
import { formatMXN } from '../../utils/formatCurrency'
import './ReportsScreen.css'

type ReportPeriod = 'day' | 'week' | 'month'

interface ChartDataPoint {
  label: string
  rawLabel: string
  value: number
}

interface TopProductData {
  name: string
  quantity: number
  totalSales: number
}

const ReportsScreen: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Datos procesados
  const [kpis, setKpis] = useState({ totalAmount: 0, transactionsCount: 0, itemsCount: 0 })
  const [timelineData, setTimelineData] = useState<ChartDataPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProductData[]>([])
  
  // Estado para el tooltip de la gráfica
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: number } | null>(null)

  // Suscribirse a salesStore para actualizar en tiempo real si ocurren nuevas ventas hoy
  const todaySales = useSalesStore(s => s.todaySales)

  // Carga de datos de reporte
  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const now = new Date()
      let fromDate = new Date()

      if (period === 'day') {
        fromDate.setHours(0, 0, 0, 0)
      } else if (period === 'week') {
        fromDate.setDate(now.getDate() - 7)
        fromDate.setHours(0, 0, 0, 0)
      } else if (period === 'month') {
        fromDate.setDate(now.getDate() - 30)
        fromDate.setHours(0, 0, 0, 0)
      }

      // Obtener ventas en el rango desde IndexedDB
      const sales = await getSalesByDateRange(fromDate, now)

      // 1. Calcular KPIs
      let totalAmount = 0
      let itemsCount = 0
      sales.forEach(sale => {
        totalAmount += sale.total
        sale.items.forEach(item => {
          itemsCount += item.quantity
        })
      })

      setKpis({
        totalAmount,
        transactionsCount: sales.length,
        itemsCount
      })

      // 2. Agrupación temporal para gráfica de línea
      const tempPoints: ChartDataPoint[] = []

      if (period === 'day') {
        // Agrupar por hora de hoy (ej. de 08:00 a 22:00)
        const hourlySales: Record<number, number> = {}
        for (let h = 8; h <= 22; h++) {
          hourlySales[h] = 0
        }

        sales.forEach(sale => {
          const saleHour = new Date(sale.timestamp).getHours()
          if (saleHour >= 8 && saleHour <= 22) {
            hourlySales[saleHour] += sale.total
          }
        })

        for (let h = 8; h <= 22; h++) {
          const formattedHour = `${h.toString().padStart(2, '0')}:00`
          tempPoints.push({
            label: formattedHour,
            rawLabel: `Hoy a las ${formattedHour}`,
            value: hourlySales[h]
          })
        }
      } else if (period === 'week') {
        // Agrupar por los últimos 7 días
        const labels: string[] = []
        const daysKeys: string[] = []
        const daysSales: Record<string, number> = {}

        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(now.getDate() - i)
          const label = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
          const key = d.toDateString()

          labels.push(label)
          daysKeys.push(key)
          daysSales[key] = 0
        }

        sales.forEach(sale => {
          const key = new Date(sale.timestamp).toDateString()
          if (daysSales[key] !== undefined) {
            daysSales[key] += sale.total
          }
        })

        daysKeys.forEach((key, idx) => {
          tempPoints.push({
            label: labels[idx],
            rawLabel: new Date(key).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            value: daysSales[key]
          })
        })
      } else if (period === 'month') {
        // Agrupar por los últimos 30 días
        const labels: string[] = []
        const daysKeys: string[] = []
        const daysSales: Record<string, number> = {}

        for (let i = 29; i >= 0; i--) {
          const d = new Date()
          d.setDate(now.getDate() - i)
          const label = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          const key = d.toDateString()

          labels.push(label)
          daysKeys.push(key)
          daysSales[key] = 0
        }

        sales.forEach(sale => {
          const key = new Date(sale.timestamp).toDateString()
          if (daysSales[key] !== undefined) {
            daysSales[key] += sale.total
          }
        })

        daysKeys.forEach((key, idx) => {
          tempPoints.push({
            label: labels[idx],
            rawLabel: new Date(key).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            value: daysSales[key]
          })
        })
      }

      setTimelineData(tempPoints)

      // 3. Agrupación por productos más vendidos
      const productMap: Record<string, { name: string; quantity: number; totalSales: number }> = {}
      sales.forEach(sale => {
        sale.items.forEach(item => {
          if (!productMap[item.productId]) {
            productMap[item.productId] = { name: item.productName, quantity: 0, totalSales: 0 }
          }
          productMap[item.productId].quantity += item.quantity
          productMap[item.productId].totalSales += item.lineTotal
        })
      })

      const topList = Object.values(productMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5) // Top 5 productos

      setTopProducts(topList)

    } catch (err) {
      console.error('[ReportsScreen] Error cargando reportes:', err)
      setError('Error al conectar con la base de datos local.')
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar datos cada vez que cambia el período o se recibe una nueva venta de hoy
  useEffect(() => {
    loadData()
  }, [period, todaySales])

  // Cálculos para la gráfica de línea SVG
  const svgDimensions = { width: 750, height: 260 }
  const margins = { top: 20, right: 30, bottom: 40, left: 65 }

  const chartParams = useMemo(() => {
    if (timelineData.length === 0) return null

    const pointsCount = timelineData.length

    // Asegurar valores numéricos (evita NaN que dejan el SVG en blanco)
    const values = timelineData.map(p => (Number.isFinite(p.value) ? p.value : 0))
    const maxVal = Math.max(...values, 500)

    const denom = Math.max(1, pointsCount - 1) // evita división por cero

    // Mapear datos a coordenadas SVG
    const svgPoints = timelineData.map((pt, i) => {
      const safeValue = Number.isFinite(pt.value) ? pt.value : 0
      const x = margins.left + (i / denom) * (svgDimensions.width - margins.left - margins.right)
      const y = margins.top + (1 - safeValue / maxVal) * (svgDimensions.height - margins.top - margins.bottom)
      return { x, y, label: pt.rawLabel, value: safeValue }
    })


    // Construir string de ruta lineal (L) y área (relleno)
    const linePath = svgPoints.reduce((acc, curr, idx) => {
      return acc + (idx === 0 ? `M ${curr.x} ${curr.y}` : ` L ${curr.x} ${curr.y}`)
    }, '')

    const firstX = svgPoints[0].x
    const lastX = svgPoints[svgPoints.length - 1].x
    const bottomY = svgDimensions.height - margins.bottom
    const areaPath = linePath + ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`

    // Generar divisiones para el eje Y (ej. 4 líneas)
    const yGridLines = Array.from({ length: 4 }).map((_, idx) => {
      const ratio = idx / 3
      const val = Math.round(maxVal * ratio)
      const y = margins.top + (1 - ratio) * (svgDimensions.height - margins.top - margins.bottom)
      return { val, y }
    })

    return { svgPoints, linePath, areaPath, yGridLines }
  }, [timelineData, svgDimensions.height, svgDimensions.width])

  // Determinar si hay datos disponibles en este período
  // Nota: timelineData puede tener puntos de 0 aún si no hay ventas.
  // Para evitar estados inconsistentes, usamos kpis.transactionsCount como fuente de verdad.
  const hasData = kpis.transactionsCount > 0 && timelineData.length > 0


  return (
    <div className="reports-screen animate-fade-in">
      <div className="reports-inner">
        {/* Encabezado */}
        <div className="reports-header">
          <div>
            <h1 className="reports-title">Reportes e Indicadores</h1>
            <p className="reports-subtitle">Monitoreo de rendimiento del negocio en tiempo real</p>
          </div>

          {/* Selector de período */}
          <div className="period-selector">
            {(['day', 'week', 'month'] as ReportPeriod[]).map(p => (
              <button
                key={p}
                className={`period-btn ${period === p ? 'period-btn--active' : ''}`}
                onClick={() => {
                  setPeriod(p)
                  setHoveredPoint(null)
                }}
              >
                {p === 'day' ? 'Hoy' : p === 'week' ? 'Últimos 7 Días' : 'Último Mes'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="reports-error-state card">
            <AlertTriangle className="text-danger" size={40} />
            <h3>Ocurrió un problema</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadData}>Reintentar carga</button>
          </div>
        )}

        {isLoading ? (
          <div className="reports-loading-state">
            <div className="reports-loading-spinner"><RefreshCw className="spinning" size={32} /></div>
            <span>Calculando estadísticas...</span>
          </div>
        ) : !hasData ? (
          <div className="reports-empty-state card">
            <Inbox size={48} className="text-muted" />
            <h3>Sin ventas registradas</h3>
            <p>No se encontraron transacciones durante el período seleccionado ({period === 'day' ? 'hoy' : period === 'week' ? 'los últimos 7 días' : 'los últimos 30 días'}).</p>
            <p className="text-sm text-muted">Las ventas que realices en el POS aparecerán aquí instantáneamente.</p>
          </div>
        ) : (
          <>
            {/* Indicadores Clave (KPIs) */}
            <div className="reports-kpi-grid">
              <div className="kpi-card card">
                <div className="kpi-card__header">
                  <span className="kpi-card__title">Ventas Totales</span>
                  <span className="kpi-card__icon kpi-card__icon--gold"><DollarSign size={20} /></span>
                </div>
                <div className="kpi-card__value">{formatMXN(kpis.totalAmount)}</div>
                <div className="kpi-card__footer">Ingreso bruto acumulado</div>
              </div>

              <div className="kpi-card card">
                <div className="kpi-card__header">
                  <span className="kpi-card__title">Transacciones</span>
                  <span className="kpi-card__icon kpi-card__icon--info"><TrendingUp size={20} /></span>
                </div>
                <div className="kpi-card__value">{kpis.transactionsCount}</div>
                <div className="kpi-card__footer">Tickets emitidos y cobrados</div>
              </div>

              <div className="kpi-card card">
                <div className="kpi-card__header">
                  <span className="kpi-card__title">Artículos Vendidos</span>
                  <span className="kpi-card__icon kpi-card__icon--success"><ShoppingBag size={20} /></span>
                </div>
                <div className="kpi-card__value">{kpis.itemsCount}</div>
                <div className="kpi-card__footer">Unidades totales despachadas</div>
              </div>
            </div>

            <div className="reports-dashboard-grid">
              {/* Gráfica de Ventas Totales */}
              <div className="reports-chart-panel card">
                <h2 className="reports-panel-title">Monto de Ventas ($)</h2>
                <div className="svg-chart-container" style={{ position: 'relative' }}>
                  {chartParams && (
                    <svg viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`} width="100%" height="100%">
                      <defs>
                        {/* Gradiente para el área */}
                        <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--brand-gold)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--brand-gold)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Líneas de cuadrícula horizontal y etiquetas del eje Y */}
                      {chartParams.yGridLines.map((line, idx) => (
                        <g key={idx}>
                          <line
                            x1={margins.left}
                            y1={line.y}
                            x2={svgDimensions.width - margins.right}
                            y2={line.y}
                            stroke="rgba(217, 119, 6, 0.1)"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={margins.left - 10}
                            y={line.y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="var(--text-secondary)"
                            fontWeight="500"
                          >
                            {formatMXN(line.val)}
                          </text>
                        </g>
                      ))}

                      {/* Relleno de Área */}
                      <path d={chartParams.areaPath} fill="url(#chartAreaGradient)" />

                      {/* Línea principal */}
                      <path
                        d={chartParams.linePath}
                        fill="none"
                        stroke="var(--brand-gold)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Etiquetas del eje X */}
                      {timelineData.map((pt, i) => {
                        const x = margins.left + (i / (timelineData.length - 1)) * (svgDimensions.width - margins.left - margins.right)
                        const y = svgDimensions.height - margins.bottom + 20
                        
                        // Omitir algunas etiquetas en modo mensual para evitar saturación
                        const shouldShow = period !== 'month' || i % 4 === 0 || i === timelineData.length - 1

                        return shouldShow ? (
                          <text
                            key={i}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fontSize="10"
                            fill="var(--text-secondary)"
                            fontWeight="500"
                          >
                            {pt.label}
                          </text>
                        ) : null
                      })}

                      {/* Ejes base */}
                      <line
                        x1={margins.left}
                        y1={svgDimensions.height - margins.bottom}
                        x2={svgDimensions.width - margins.right}
                        y2={svgDimensions.height - margins.bottom}
                        stroke="var(--border)"
                        strokeWidth="1.5"
                      />

                      {/* Puntos de interacción */}
                      {chartParams.svgPoints.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.label === pt.label ? "6" : "4.5"}
                          fill={hoveredPoint?.label === pt.label ? "var(--brand-amber)" : "var(--bg-card)"}
                          stroke="var(--brand-gold)"
                          strokeWidth="2.5"
                          style={{ cursor: 'pointer', transition: 'all 120ms ease' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const containerRect = e.currentTarget.parentElement?.getBoundingClientRect()
                            if (rect && containerRect) {
                              setHoveredPoint({
                                x: rect.left - containerRect.left + 8,
                                y: rect.top - containerRect.top - 55,
                                label: pt.label,
                                value: pt.value
                              })
                            }
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </svg>
                  )}

                  {/* Tooltip flotante interactivo */}
                  {hoveredPoint && (
                    <div
                      className="chart-tooltip animate-fade-in"
                      style={{
                        position: 'absolute',
                        left: `${hoveredPoint.x}px`,
                        top: `${hoveredPoint.y}px`,
                        transform: 'translateX(-50%)',
                        pointerEvents: 'none'
                      }}
                    >
                      <div className="chart-tooltip__label">{hoveredPoint.label}</div>
                      <div className="chart-tooltip__value">{formatMXN(hoveredPoint.value)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Productos más vendidos */}
              <div className="reports-top-products panel card">
                <h2 className="reports-panel-title">Top 5 Productos Más Vendidos</h2>
                <div className="top-products-list">
                  {topProducts.map((prod, index) => {
                    const maxQty = Math.max(...topProducts.map(p => p.quantity), 1)
                    const percentWidth = (prod.quantity / maxQty) * 100

                    return (
                      <div key={index} className="top-product-row">
                        <div className="top-product-row__info">
                          <span className="top-product-row__rank">{index + 1}</span>
                          <span className="top-product-row__name" title={prod.name}>{prod.name}</span>
                          <span className="top-product-row__qty">{prod.quantity} u</span>
                        </div>
                        <div className="top-product-row__bar-container">
                          <div
                            className="top-product-row__bar"
                            style={{ width: `${percentWidth}%` }}
                          />
                        </div>
                        <div className="top-product-row__revenue">
                          Monto total: {formatMXN(prod.totalSales)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ReportsScreen
