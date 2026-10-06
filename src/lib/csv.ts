export function csvCell(value: unknown): string {
  let text = String(value ?? '')
  // Treat untrusted string fields as text, never as spreadsheet formulas.
  let first = 0
  while (first < text.length && (text.charCodeAt(first) <= 32 || /\s/.test(text[first]))) first++
  const plainNegativeNumber = /^-\d+(?:\.\d+)?$/.test(text)
  if (typeof value === 'string' && /^[=+\-@]$/.test(text[first] ?? '') && !plainNegativeNumber) text = "'" + text
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
