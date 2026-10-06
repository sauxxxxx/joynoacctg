export function identityRepository(db) {
  const role = (row) => row && ({ id: row.id, version: row.version, name: row.name, description: row.description,
    active: Boolean(row.active), system: Boolean(row.system), permissions: JSON.parse(row.permissions_json) })
  const user = (row) => row && ({ id: row.id, version: row.version, username: row.username, email: row.email, name: row.name,
    roleId: row.role_id, active: Boolean(row.active && row.membership_active) })
  const roleQuery = 'SELECT * FROM roles WHERE company_id = $1'
  const userQuery = `SELECT u.id, u.version, u.username, u.email, u.name, u.active, m.role_id, m.active AS membership_active
    FROM users u JOIN company_memberships m ON m.user_id = u.id WHERE m.company_id = $1`
  return {
    roles: async (companyId) => (await db.query(roleQuery + ' ORDER BY name, id', [companyId])).rows.map(role),
    users: async (companyId) => (await db.query(userQuery + ' ORDER BY u.name, u.id', [companyId])).rows.map(user),
    role: async (companyId, id) => role((await db.query(roleQuery + ' AND id = $2', [companyId, id])).rows[0]),
    user: async (companyId, id) => user((await db.query(userQuery + ' AND u.id = $2', [companyId, id])).rows[0]),
  }
}
