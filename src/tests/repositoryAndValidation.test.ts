import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from '../services/repository'
import { createRefRepository } from '../services/refRepository'
import { UnauthorizedError, useAsyncResource } from '../lib/asyncState'
import { fixedAssetSchema, journalEntrySchema, purchaseDocumentSchema } from '../validation/schemas'

describe('repository and validation boundaries', () => {
  it('paginates 100+ records and returns empty pages safely', async () => {
    const repo = createMemoryRepository('/test-records', Array.from({ length: 105 }, (_, index) => ({ id: String(index), name: `Record ${index}` })), { searchText: (item) => item.name })
    const page = await repo.list({ page: 5, pageSize: 25 })
    expect(page.items).toHaveLength(5)
    expect(page.totalItems).toBe(105)
    expect((await repo.list({ search: 'missing' })).items).toEqual([])
  })
  it('keeps legacy reactive lists current when records are created, edited, and removed', async () => {
    const records = ref([{ id: 'existing', name: 'Original' }])
    const repository = createRefRepository('/test-records', records)
    const created = await repository.save({ id: 'chosen-id', name: 'New record' })
    expect(created.id).toBe('chosen-id')
    expect(records.value.map((item) => item.name)).toEqual(['Original', 'New record'])

    await repository.save({ ...created, name: 'Updated record' })
    expect((await repository.get(created.id))?.name).toBe('Updated record')
    expect(records.value).toHaveLength(2)

    await repository.remove(created.id)
    expect(records.value.map((item) => item.id)).toEqual(['existing'])
  })
  it('rejects invalid relationships, dates, and accounting totals', () => {
    expect(purchaseDocumentSchema.safeParse({ id: '1', vendorId: '', date: 'not-a-date', totalCents: 100, paidCents: 101 }).success).toBe(false)
    expect(journalEntrySchema.safeParse({ id: '1', date: '2026-09-30', lines: [{ accountId: '101', debitCents: 100, creditCents: 0 }, { accountId: '201', debitCents: 0, creditCents: 99 }] }).success).toBe(false)
    expect(fixedAssetSchema.safeParse({ id: '1', vendorId: 'v1', datePurchased: '2026-09-30', description: 'Asset', purchasePriceCents: 100, salvageValueCents: 101, usefulLifeMonths: 0, lapsedMonths: -1 }).success).toBe(false)
  })
  it('exposes retryable server and authorization failures', async () => {
    let attempt = 0
    const resource = useAsyncResource({
      load: async () => {
        attempt += 1
        if (attempt === 1) throw new Error('Preview repository failed.')
        if (attempt === 2) throw new UnauthorizedError()
        return ['recovered']
      },
      isEmpty: (items) => items.length === 0,
    })
    await resource.run()
    expect(resource.status.value).toBe('error')
    expect(resource.error.value).toBe('Preview repository failed.')
    await resource.run()
    expect(resource.status.value).toBe('unauthorized')
    await resource.run()
    expect(resource.status.value).toBe('success')
    expect(resource.data.value).toEqual(['recovered'])
  })
})
