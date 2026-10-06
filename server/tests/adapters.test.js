import test from 'node:test'
import assert from 'node:assert/strict'
import { postgresAdapter } from '../db/postgresAdapter.js'
import { sqliteAdapter } from '../db/sqliteAdapter.js'
import { openDatabase } from '../db/connection.js'

test('PostgreSQL transactions use one client and always roll back/release on failure', async () => {
  const calls = []
  const client = { query: async (sql) => { calls.push(sql); return { rows: [] } }, release: () => calls.push('RELEASE') }
  const db = postgresAdapter({ connect: async () => client, query: () => assert.fail('Pool query inside transaction') })
  const value = await db.transaction(async (tx) => { await tx.lockCompany('company'); return 42 })
  assert.equal(value, 42)
  assert.deepEqual(calls, ['BEGIN', 'SELECT id FROM companies WHERE id = $1 FOR UPDATE', 'COMMIT', 'RELEASE'])
  calls.length = 0
  await assert.rejects(db.transaction(async () => { throw new Error('failure') }), /failure/)
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', 'RELEASE'])
})

test('SQLite queues outside queries until an async transaction commits and handles repeated parameters', async () => {
  const db = sqliteAdapter(openDatabase(':memory:'))
  try {
    let resume
    const gate = new Promise((resolve) => { resume = resolve })
    const transaction = db.transaction(async (tx) => {
      await tx.query('INSERT INTO companies (id, name, created_at) VALUES ($1, $2, $3)', ['1', 'Test', new Date().toISOString()])
      await gate
      return (await tx.query('SELECT id FROM companies WHERE id = $1 OR name = $1', ['1'])).rows
    })
    const outside = db.query('SELECT COUNT(*) AS count FROM companies')
    resume()
    assert.equal((await transaction).length, 1)
    assert.equal((await outside).rows[0].count, 1)
    await assert.rejects(db.transaction(async (tx) => {
      await tx.query('DELETE FROM companies')
      throw new Error('rollback')
    }), /rollback/)
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM companies')).rows[0].count, 1)
  } finally { await db.close() }
})
