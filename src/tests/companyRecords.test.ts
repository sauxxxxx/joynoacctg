import { describe, expect, it } from 'vitest'
import { recordPages } from '../features/company/companyRecords'

describe('company record validation', () => {
  it('allows multiple users without an optional email and still rejects duplicate provided emails', () => {
    const validate = recordPages.users!.validate!
    const existing = [{ id: 'existing', username: 'first', email: '', name: 'First' }]
    expect(validate({ id: '', username: 'second', email: '', password: 'disposable-password-123' }, existing)).toBe('')
    expect(validate({ id: '', username: 'second', email: 'same@example.test', password: 'disposable-password-123' }, [{ ...existing[0], email: 'same@example.test' }])).toMatch(/email/)
  })
})
