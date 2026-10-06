// Serialize all work on a single SQLite connection, including asynchronous transactions.
export function sqliteAdapter(connection) {
  let pending = Promise.resolve()
  function enqueue(operation) {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }
  const scoped = {
    dialect: 'sqlite',
    async query(sql, parameters = []) {
      const bindings = []
      const statement = connection.prepare(sql.replace(/\$(\d+)/g, (_match, index) => {
        bindings.push(parameters[Number(index) - 1])
        return '?'
      }))
      if (statement.columns().length) {
        const rows = statement.all(...bindings)
        return { rows, rowCount: rows.length }
      }
      const result = statement.run(...bindings)
      return { rows: [], rowCount: Number(result.changes) }
    },
    async lockCompany() {},
  }
  return {
    dialect: scoped.dialect,
    query: (sql, parameters) => enqueue(() => scoped.query(sql, parameters)),
    transaction: (operation) => enqueue(async () => {
      connection.exec('BEGIN IMMEDIATE')
      try {
        const result = await operation(scoped)
        connection.exec('COMMIT')
        return result
      } catch (error) { connection.exec('ROLLBACK'); throw error }
    }),
    close: () => enqueue(() => connection.close()),
  }
}
