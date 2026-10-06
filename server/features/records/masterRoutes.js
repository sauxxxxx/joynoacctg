import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { masterModules } from './masterSchemas.js'
import { masterService } from './masterService.js'

export function masterRoutes(db, kind) {
  const router = Router({ mergeParams: true })
  const service = masterService(db, kind)
  const permission = (action) => authorizeCompany(db, masterModules[kind], action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  router.get('/', permission('view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.get('/:id', permission('view'), async (req, res) => sendData(req, res, await service.get(req.auth.companyId, req.params.id)))
  router.post('/', permission('create'), async (req, res) => sendData(req, res, await service.save(context(req), null, req.body), 201))
  router.patch('/:id', permission('edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.id, req.body)))
  router.delete('/:id', permission('delete'), async (req, res) => { await service.remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
