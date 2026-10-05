export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

const DAY_MS = 24 * 60 * 60 * 1000

export const getAgingBucket = (dueDate: string, asOfDate = new Date()): AgingBucket => {
  const due = new Date(`${dueDate}T00:00:00`)
  const asOf = new Date(asOfDate)
  asOf.setHours(0, 0, 0, 0)

  const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / DAY_MS)

  if (daysPastDue <= 0) return 'current'
  if (daysPastDue <= 30) return '1-30'
  if (daysPastDue <= 60) return '31-60'
  if (daysPastDue <= 90) return '61-90'
  return '90+'
}
