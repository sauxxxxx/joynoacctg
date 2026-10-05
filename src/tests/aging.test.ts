import { describe, expect, it } from 'vitest'
import { getAgingBucket } from '../lib/aging'

describe('aging buckets', () => {
  const asOf = new Date('2026-09-30T00:00:00')

  it.each([
    ['2026-10-01', 'current'],
    ['2026-09-30', 'current'],
    ['2026-09-29', '1-30'],
    ['2026-08-31', '1-30'],
    ['2026-08-30', '31-60'],
    ['2026-08-01', '31-60'],
    ['2026-07-31', '61-90'],
    ['2026-07-02', '61-90'],
    ['2026-07-01', '90+'],
  ])('classifies %s as %s', (dueDate, bucket) => {
    expect(getAgingBucket(dueDate, asOf)).toBe(bucket)
  })
})
