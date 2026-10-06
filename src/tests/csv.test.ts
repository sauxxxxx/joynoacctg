import { describe, expect, it } from 'vitest'
import { csvCell } from '../lib/csv'
describe('CSV cell safety', () => {
  it('quotes separators and escapes quotation marks', () => {
    expect(csvCell('A,"B"')).toBe('"A,""B"""')
    expect(csvCell('line\nnext')).toBe('"line\nnext"')
  })
  it('exports untrusted formulas as text while keeping numeric values', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(csvCell('\t+formula')).toBe("'\t+formula")
    expect(csvCell('-123')).toBe('-123')
    expect(csvCell('-1+formula')).toBe("'-1+formula")
    expect(csvCell(-123)).toBe('-123')
  })
})
