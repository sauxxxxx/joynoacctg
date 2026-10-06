// Transactions must use one checked-out connection, never pool.query across statements.
export function postgresAdapter(pool) {
  return {
    dialect: 'postgres',
    query: (sql, parameters) => pool.query(sql, parameters),
    async transaction(operation) {
      const client = await pool.connect()
      let releaseError
      try {
        await client.query('BEGIN')
        const scoped = {
          dialect: 'postgres',
          query: (sql, parameters) => client.query(sql, parameters),
          // Serialize each company's hierarchy changes and audit writes across API workers.
          lockCompany: (id) => client.query('SELECT id FROM companies WHERE id = $1 FOR UPDATE', [id]),
        }
        const result = await operation(scoped)
        await client.query('COMMIT')
        return result
      } catch (error) {
        try { await client.query('ROLLBACK') } catch (rollbackError) { releaseError = rollbackError }
        throw error
      } finally { client.release(releaseError) }
    },
    close: () => pool.end(),
  }
}
