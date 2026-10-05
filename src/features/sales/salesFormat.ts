const plainAmount = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Amounts in Sales tables are stored as integer centavos and displayed as pesos. */
export function tableAmount(cents: number): string {
  return plainAmount.format(cents / 100)
}

const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** e.g. Sep 29, 2026 */
export function reportDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return longDate.format(new Date(year, month - 1, day))
}
