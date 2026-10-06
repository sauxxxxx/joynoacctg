import { downloadCsv } from '../../lib/csv'
import { accumulatedDepreciationCents, bookValueCents, monthlyDepreciationCents, type FixedAssetRecord } from './fixedAssetData'

export function exportFixedAssets(records: FixedAssetRecord[]) {
  const money = (cents: number) => (cents / 100).toFixed(2)
  downloadCsv('fixed-assets.csv', [['Tracking number', 'Description', 'Purchase date', 'Purchase price (PHP)', 'VAT (PHP)', 'Useful life (months)', 'Salvage value (PHP)', 'Recorded lapsed months', 'Monthly depreciation (PHP)', 'Accumulated depreciation (PHP)', 'Book value (PHP)', 'Invoice reference', 'Remarks'],
    ...records.map((item) => [item.trackingNumber, item.description, item.datePurchased, money(item.purchasePriceCents), money(item.vatCents), item.usefulLifeMonths, money(item.salvageValueCents), item.lapsedMonths, money(monthlyDepreciationCents(item)), money(accumulatedDepreciationCents(item)), money(bookValueCents(item)), item.salesInvoice, item.remarks])])
}
