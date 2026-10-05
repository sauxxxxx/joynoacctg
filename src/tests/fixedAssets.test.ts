import { describe, expect, it } from 'vitest'
import { accumulatedDepreciationCents, bookValueCents, monthlyDepreciationCents, type FixedAssetRecord } from '../features/assets/fixedAssetData'

const asset = { purchasePriceCents: 100000, salvageValueCents: 10000, usefulLifeMonths: 3, lapsedMonths: 2 } as FixedAssetRecord

describe('fixed asset depreciation', () => {
  it('calculates and caps straight-line depreciation in centavos', () => {
    expect(monthlyDepreciationCents(asset)).toBe(30000)
    expect(accumulatedDepreciationCents(asset)).toBe(60000)
    expect(bookValueCents({ ...asset, lapsedMonths: 99 })).toBe(10000)
  })
})
