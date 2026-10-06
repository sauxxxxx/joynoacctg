import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { invalid } from './documentMath.js'

const types = { 'sales-invoices': 'Sales invoice', 'sales-receipts': 'Collection receipt', 'acknowledgement-receipts': 'Acknowledgement receipt' }
export async function assignDocumentNumber(tx, context, value, records) {
  const seriesRepository = jsonRecordRepository(tx, 'series')
  const series = (await seriesRepository.all(context.companyId)).find((record) => record.active && record.documentType === types[value.kind])
  if (!series) throw invalid('Enter a document number or configure an active numbering series.')
  const year = value.date.slice(0, 4)
  const month = value.date.slice(5, 7)
  const period = series.resetFrequency === 'Monthly' ? value.date.slice(0, 7) : series.resetFrequency === 'Yearly' ? year : 'all'
  const pattern = series.prefix + series.suffix
  if (series.resetFrequency !== 'Never' && !/\{YYYY\}|\{YY\}/.test(pattern)) throw invalid('A restarting series needs a year token to keep document numbers unique.')
  if (series.resetFrequency === 'Monthly' && !pattern.includes('{MM}')) throw invalid('A monthly series also needs the {MM} token.')
  const counters = jsonRecordRepository(tx, 'series-number-counters')
  const counter = (await counters.all(context.companyId)).find((record) => record.seriesId === series.id && record.period === period)
  let number = series.resetFrequency === 'Never' ? series.nextNumber : counter?.nextNumber ?? series.nextNumber
  const tokens = (text) => text.replaceAll('{YYYY}', year).replaceAll('{YY}', year.slice(2)).replaceAll('{MM}', month)
  // Manual numbers may occupy a sequence position. Skip collisions under the same company lock.
  for (let attempts = 0; attempts < 1000; attempts++, number++) {
    if (number >= 1_000_000_000) throw invalid('This numbering series is exhausted. Update its prefix and next number.')
    const candidate = tokens(series.prefix) + String(number).padStart(series.padding, '0') + tokens(series.suffix)
    if (records.some((record) => record.kind === value.kind && record.number.toLowerCase() === candidate.toLowerCase())) continue
    value.number = candidate
    await counters.save(context.companyId, counter?.id || null, { seriesId: series.id, period, nextNumber: number + 1 })
    if (series.resetFrequency === 'Never') {
      const { id, version: _version, ...fields } = series
      const saved = await seriesRepository.save(context.companyId, id, { ...fields, nextNumber: number + 1 })
      await appendAudit(tx, context, 'Number assigned', 'company/series', id, series, saved)
    } else await appendAudit(tx, context, 'Number assigned', 'company/series', series.id, null, { documentType: series.documentType, number: candidate, period })
    return
  }
  throw invalid('This numbering range is occupied. Update the series before saving.')
}
