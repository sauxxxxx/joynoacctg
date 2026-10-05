import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { accountService } from './accountService.js'

export function accountRoutes(db, kind) {
  const router = Router({ mergeParams: true })
  const service = accountService(db, kind)
  const permission = (action) => authorizeCompany(db, 'Accounting', action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  router.get('/', permission('view'), (req, res) => res.json({ ...service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.get('/:id', permission('view'), (req, res) => sendData(req, res, service.get(req.auth.companyId, req.params.id)))
  router.post('/', permission('create'), (req, res) => sendData(req, res, service.create(context(req), req.body), 201))
  router.patch('/:id', permission('edit'), (req, res) => sendData(req, res, service.update(context(req), req.params.id, req.body)))
  router.delete('/:id', permission('delete'), (req, res) => {
    service.remove(context(req), req.params.id, req.query.expectedVersion)
    res.sendStatus(204)
  })
  return router
}
