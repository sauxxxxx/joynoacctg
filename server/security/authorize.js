import { ApiFailure } from '../http/errors.js'
import { tokenHash } from './session.js'
import { findMembership, findSession } from '../features/auth/authRepository.js'

export function authenticate(db) {
  return (req, _res, next) => {
    const match = /^Bearer ([0-9a-f]{64})$/i.exec(req.get('Authorization') || '')
    if (!match) return next(new ApiFailure('UNAUTHENTICATED', 401, 'Sign in to continue.'))
    const session = findSession(db, tokenHash(match[1]))
    if (!session || session.revoked_at || !session.user_active) return next(new ApiFailure('UNAUTHENTICATED', 401, 'Sign in to continue.'))
    if (session.expires_at <= new Date().toISOString()) return next(new ApiFailure('SESSION_EXPIRED', 401, 'Your session has expired.'))
    req.auth = { userId: session.user_id, token: match[1] }
    next()
  }
}

export function authorizeCompany(db, module, action) {
  return (req, _res, next) => {
    const companyId = req.params.companyId
    const membership = findMembership(db, companyId, req.auth.userId)
    if (!membership) return next(new ApiFailure('NOT_FOUND', 404, 'Company not found.'))
    const permissions = JSON.parse(membership.permissions_json)
    if (!permissions[module]?.[action]) return next(new ApiFailure('FORBIDDEN', 403, 'You do not have permission for this action.'))
    req.auth.companyId = companyId
    next()
  }
}
