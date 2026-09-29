export interface InvoiceSheetRow {
  number: string
  date: string
  customer: string
  paymentTerm: string
  item: string
  quantity: number
  unitPrice: number
}

const headers = ['Invoice #', 'Date', 'Customer', 'Payment Term', 'Item', 'Quantity', 'Unit Price']

export async function downloadInvoiceSheet(rows: InvoiceSheetRow[]) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Invoices')
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  sheet.columns = [{ width: 22 }, { width: 16 }, { width: 30 }, { width: 25 }, { width: 35 }, { width: 14 }, { width: 16 }]
  for (const row of rows) sheet.addRow([row.number, row.date, row.customer, row.paymentTerm, row.item, row.quantity, row.unitPrice])
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'sales-invoices.xlsx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readInvoiceSheet(file: File): Promise<InvoiceSheetRow[]> {
  if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) throw new Error('Choose an .xlsx file.')
  if (file.size > 2_000_000) throw new Error('Excel file must be 2 MB or smaller.')
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('The workbook has no worksheet.')
  if (sheet.rowCount > 501) throw new Error('Import at most 500 invoices at a time.')
  if (headers.some((header, index) => sheet.getRow(1).getCell(index + 1).text.trim() !== header)) {
    throw new Error('Column headers do not match the downloaded template.')
  }
  const rows: InvoiceSheetRow[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    if (!row.hasValues) continue
    for (let column = 1; column <= headers.length; column++) {
      const value = row.getCell(column).value
      if (value && typeof value === 'object' && !(value instanceof Date)) throw new Error(`Row ${rowNumber} contains an unsupported cell value.`)
    }
    const dateValue = row.getCell(2).value
    const date = dateValue instanceof Date
      ? `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
      : row.getCell(2).text.trim()
    rows.push({
      number: row.getCell(1).text.trim(), date, customer: row.getCell(3).text.trim(),
      paymentTerm: row.getCell(4).text.trim(), item: row.getCell(5).text.trim(),
      quantity: Number(row.getCell(6).value), unitPrice: Number(row.getCell(7).value),
    })
  }
  return rows
}
