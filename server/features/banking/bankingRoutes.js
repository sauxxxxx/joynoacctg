import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { bankingService } from './bankingService.js'

export function bankingRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = bankingService(db)
  const permission = (module, action) => authorizeCompany(db, module, action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  router.get('/', permission('Banking', 'view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.post('/create-journals', permission('Banking', 'edit'), permission('Accounting', 'create'), permission('Accounting', 'edit'), async (req, res) => sendData(req, res, await service.createJournals(context(req), req.body)))
  router.post('/:id/void', permission('Banking', 'edit'), permission('Accounting', 'edit'), async (req, res) => sendData(req, res, await service.voidTransaction(context(req), req.params.id, req.body)))
  router.get('/:id', permission('Banking', 'view'), async (req, res) => sendData(req, res, await service.get(req.auth.companyId, req.params.id)))
  router.post('/', permission('Banking', 'create'), async (req, res) => sendData(req, res, await service.save(context(req), null, req.body), 201))
  router.patch('/:id', permission('Banking', 'edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.id, req.body)))
  router.delete('/:id', permission('Banking', 'delete'), async (req, res) => { await service.remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
