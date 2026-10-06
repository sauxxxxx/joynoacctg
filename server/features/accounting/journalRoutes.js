import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { journalService } from './journalService.js'

export function journalRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = journalService(db)
  const permission = (action) => authorizeCompany(db, 'Accounting', action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  router.get('/', permission('view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.post('/transition', permission('edit'), async (req, res) => sendData(req, res, await service.transitionBatch(context(req), req.body)))
  router.get('/:id', permission('view'), async (req, res) => sendData(req, res, await service.get(req.auth.companyId, req.params.id)))
  router.post('/', permission('create'), async (req, res) => sendData(req, res, await service.save(context(req), null, req.body), 201))
  router.patch('/:id', permission('edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.id, req.body)))
  router.delete('/:id', permission('delete'), async (req, res) => { await service.remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  for (const action of ['post', 'void']) router.post(`/:id/${action}`, permission('edit'), async (req, res) => sendData(req, res, await service.transition(context(req), req.params.id, req.body, action)))
  return router
}
