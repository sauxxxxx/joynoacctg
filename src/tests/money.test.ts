import { describe, expect, it } from 'vitest'
import { decimalToCents, formatMoney, parseMoneyToCents } from '../lib/money'

describe('money utilities', () => {
  it('parses decimal input without floating-point arithmetic', () => {
    expect(parseMoneyToCents('1,000.00')).toBeNull()
    expect(parseMoneyToCents('1000.09')).toBe(100009)
    expect(parseMoneyToCents('0.001')).toBeNull()
  })
  it('rounds numeric boundaries once', () => {
    expect(decimalToCents(10.235)).toBe(1023)
    expect(formatMoney(9007199254740991)).toContain(',')
  })
})
