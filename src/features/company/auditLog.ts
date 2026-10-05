import { isPreviewMode } from '../../services/api/config'
import { createMemoryBackend, selectRepository, type Entity } from '../../services/repository'
import { currentActorName } from '../auth/authStore'

export interface AuditEvent extends Entity {
  /** UTC ISO 8601. */
  at: string
  user: string
  module: string
  action: string
  reference: string
  details: string
}

export type AuditFilters = { module?: string; from?: string; to?: string }

const auditBackend = createMemoryBackend<AuditEvent, AuditFilters>('/audit-events', [], {
  searchText: (event) => `${event.user} ${event.module} ${event.action} ${event.reference} ${event.details}`,
  matches: (event, filters) => (!filters.module || event.module === filters.module)
    && (!filters.from || event.at.slice(0, 10) >= filters.from) && (!filters.to || event.at.slice(0, 10) <= filters.to),
  defaultSort: { by: 'at', direction: 'desc' },
})

/** Read-only for the app. The API writes audit events itself; see BACKEND_SPEC › Audit logging. */
export const auditRepository = selectRepository('/audit-events', auditBackend)

/**
 * Records an audit event in preview mode. With an API configured this does nothing, because the
 * server records every audited action from the authenticated request.
 */
export function recordAudit(module: string, action: string, reference: string, details = '') {
  if (!isPreviewMode) return
  auditBackend.write({ id: '', at: new Date().toISOString(), user: currentActorName(), module, action, reference, details })
}
