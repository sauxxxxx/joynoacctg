export function findUser(db, identifier) {
  return db.prepare(`SELECT id, username, email, name, password_hash, active FROM users
    WHERE username = ? OR (email <> '' AND lower(email) = lower(?))`).get(identifier, identifier)
}

export function activeMemberships(db, userId) {
  return db.prepare(`SELECT c.id AS company_id, c.name AS company_name, r.name AS role, r.permissions_json
    FROM company_memberships m JOIN companies c ON c.id = m.company_id
    JOIN roles r ON r.id = m.role_id AND r.company_id = c.id
    WHERE m.user_id = ? AND m.active = 1 AND c.active = 1 AND r.active = 1 ORDER BY c.name, c.id`).all(userId)
}

export function findSession(db, hash) {
  return db.prepare(`SELECT s.user_id, s.expires_at, s.revoked_at, u.active AS user_active
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(hash)
}

export function findMembership(db, companyId, userId) {
  return db.prepare(`SELECT r.permissions_json FROM company_memberships m
    JOIN companies c ON c.id = m.company_id
    JOIN roles r ON r.id = m.role_id AND r.company_id = m.company_id
    WHERE m.company_id = ? AND m.user_id = ? AND m.active = 1 AND c.active = 1 AND r.active = 1`).get(companyId, userId)
}
