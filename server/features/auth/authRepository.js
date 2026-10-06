export async function findUser(db, identifier) {
  const { rows } = await db.query(`SELECT id, username, email, name, password_hash, active FROM users
    WHERE lower(username) = lower($1) OR (email <> '' AND lower(email) = lower($1))`, [identifier])
  return rows[0]
}

export async function activeMemberships(db, userId) {
  const { rows } = await db.query(`SELECT c.id AS company_id, c.name AS company_name, r.name AS role, r.permissions_json
    FROM company_memberships m JOIN companies c ON c.id = m.company_id
    JOIN roles r ON r.id = m.role_id AND r.company_id = c.id
    WHERE m.user_id = $1 AND m.active = 1 AND c.active = 1 AND r.active = 1 ORDER BY c.name, c.id`, [userId])
  return rows
}

export async function findSession(db, hash) {
  const { rows } = await db.query(`SELECT s.user_id, s.expires_at, s.revoked_at, u.active AS user_active
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`, [hash])
  const row = rows[0]
  return row && { ...row, expires_at: new Date(row.expires_at).toISOString() }
}

export async function findMembership(db, companyId, userId) {
  const { rows } = await db.query(`SELECT r.permissions_json FROM company_memberships m
    JOIN companies c ON c.id = m.company_id
    JOIN roles r ON r.id = m.role_id AND r.company_id = m.company_id
    WHERE m.company_id = $1 AND m.user_id = $2 AND m.active = 1 AND c.active = 1 AND r.active = 1`, [companyId, userId])
  return rows[0]
}
