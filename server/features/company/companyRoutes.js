import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { identityService } from './identityService.js'
import { settingsService } from './settingsService.js'
import { companyRecordService } from './recordService.js'
import { requireAdministrator } from './identityService.js'
import { z } from 'zod'
import { presentAudit } from './auditPresenter.js'

const permission = (db, action) => authorizeCompany(db, 'Company', action)
const context = (req) => ({ ...req.auth, requestId: req.requestId })
export function companySettingsRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = settingsService(db)
  router.get('/:kind', permission(db, 'view'), async (req, res) => sendData(req, res, await service.load(req.auth.companyId, req.params.kind)))
  router.put('/:kind', permission(db, 'edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.kind, req.body)))
  return router
}
export function companyIdentityRoutes(db, kind) {
  const router = Router({ mergeParams: true })
  const service = identityService(db, kind)
  router.get('/', permission(db, 'view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.get('/:id', permission(db, 'view'), async (req, res) => sendData(req, res, await service.get(req.auth.companyId, req.params.id)))
  router.post('/', permission(db, 'create'), async (req, res) => sendData(req, res, await service.save(context(req), null, req.body), 201))
  router.patch('/:id', permission(db, 'edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.id, req.body)))
  router.delete('/:id', permission(db, 'delete'), async (req, res) => { await service.remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
export function companyRecordRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = (req) => companyRecordService(db, req.params.kind)
  router.get('/:kind', permission(db, 'view'), async (req, res) => res.json({ ...await service(req).list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.get('/:kind/:id', permission(db, 'view'), async (req, res) => sendData(req, res, await service(req).get(req.auth.companyId, req.params.id)))
  router.post('/:kind', permission(db, 'create'), async (req, res) => sendData(req, res, await service(req).save(context(req), null, req.body), 201))
  router.patch('/:kind/:id', permission(db, 'edit'), async (req, res) => sendData(req, res, await service(req).save(context(req), req.params.id, req.body)))
  router.delete('/:kind/:id', permission(db, 'delete'), async (req, res) => { await service(req).remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
export function auditRoutes(db) {
  const router = Router({ mergeParams: true })
  router.get('/', permission(db, 'view'), async (req, res) => {
    await requireAdministrator(db, req.auth.companyId, req.auth.userId)
    const { page, pageSize } = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }).strict().parse(req.query)
    const total = Number((await db.query('SELECT COUNT(*) AS count FROM audit_events WHERE company_id = $1', [req.auth.companyId])).rows[0].count)
    const { rows } = await db.query(`SELECT a.*, u.name AS actor_name FROM audit_events a JOIN users u ON u.id = a.actor_user_id
      WHERE a.company_id = $1 ORDER BY a.created_at DESC, a.id LIMIT $2 OFFSET $3`, [req.auth.companyId, pageSize, (page - 1) * pageSize])
    res.json({ data: rows.map(presentAudit), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), requestId: req.requestId })
  })
  return router
}
