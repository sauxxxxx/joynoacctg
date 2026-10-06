const tables = ['companies', 'users', 'roles', 'company_memberships', 'sessions', 'account_categories', 'accounts', 'company_settings', 'company_records', 'journal_entries', 'journal_lines', 'document_contents']

export async function grantRuntime(db, role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw new Error('JOYNO_DB_RUNTIME_ROLE must be a lowercase PostgreSQL role name.')
  return db.transaction(async (tx) => {
    await tx.query(`GRANT USAGE ON SCHEMA public TO "${role}"`)
    await tx.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tables.join(', ')} TO "${role}"`)
    // Runtime cannot alter migrations, update/delete audits, or create/drop tables.
    await tx.query(`GRANT SELECT ON TABLE schema_migrations TO "${role}"`)
    await tx.query(`GRANT SELECT, INSERT ON TABLE audit_events TO "${role}"`)
  })
}
