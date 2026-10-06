import { config } from '../config.js'
import { sqliteAdapter } from './sqliteAdapter.js'

export async function openBackend(settings = config) {
  if (settings.databaseDriver === 'postgres') {
    const { openPostgres } = await import('./postgresConnection.js')
    return openPostgres(settings)
  }
  const { openDatabase } = await import('./connection.js')
  return sqliteAdapter(openDatabase(settings.databasePath))
}

export const asBackend = (db) => db.query ? db : sqliteAdapter(db)
