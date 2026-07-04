/**
 * Formatea un número como moneda MXN.
 * Ejemplo: 1234.5 → "$1,234.50"
 */
export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Formatea un número como moneda sin el símbolo.
 * Ejemplo: 1234.5 → "1,234.50"
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
