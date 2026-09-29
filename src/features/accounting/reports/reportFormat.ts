const amountFormat = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moneyFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const compactFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 })

/** Report amount without a currency sign. Negative values use parentheses. */
export function amount(cents: number): string {
  const text = amountFormat.format(Math.abs(cents) / 100)
  return cents < 0 ? `(${text})` : text
}

/** Blank for zero, for sparse debit/credit columns. */
export function amountOrBlank(cents: number): string {
  return cents === 0 ? '' : amount(cents)
}

export function money(cents: number): string {
  return moneyFormat.format(cents / 100)
}

export function compactMoney(cents: number): string {
  return compactFormat.format(cents / 100)
}

/** Debit-minus-credit balance shown as an amount with a Dr/Cr side. */
export function drCr(cents: number): string {
  if (cents === 0) return '0.00'
  return `${amountFormat.format(Math.abs(cents) / 100)} ${cents > 0 ? 'Dr' : 'Cr'}`
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

/** Plain number for CSV cells, e.g. 1234.5 → "1234.50". */
export function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => {
    const text = String(cell)
    // Prefix values that spreadsheet apps would run as formulas.
    const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }).join(',')).join('\r\n')
}

export function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileSlug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
