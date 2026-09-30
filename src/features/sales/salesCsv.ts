/**
 * CSV export for the Sales lists. Cells that a spreadsheet could read as a formula are prefixed with an apostrophe,
 * and the file starts with a byte-order mark so Excel opens it as UTF-8.
 */

const formulaStart = /^[=+\-@\t\r]/

export function csvCell(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const safe = formulaStart.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
