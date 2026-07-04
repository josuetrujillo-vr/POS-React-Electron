/**
 * Genera un UUID v4 sin dependencias externas.
 * Usa crypto.randomUUID() cuando está disponible (Electron, Chrome 92+).
 * Fallback manual para entornos más antiguos.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Genera el número de venta del día (ej: "0042").
 * @param lastNumber - último número del día
 */
export function generateSaleNumber(lastNumber: number): string {
  return String(lastNumber + 1).padStart(4, '0')
}
