import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { documentService } from './documentService.js'
import { documentPosting } from './documentPosting.js'
import { saveDocumentBulk } from './documentBulk.js'

export function documentRoutes(db, domain) {
  const router = Router({ mergeParams: true })
  const service = documentService(db, domain)
  const posting = documentPosting(db, domain)
  const module = domain === 'sales-documents' ? 'Sales' : 'Purchases'
  const permission = (action) => authorizeCompany(db, module, action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  if (domain === 'sales-documents') router.post('/bulk', permission('create'), async (req, res) => sendData(req, res, await saveDocumentBulk(db, context(req), req.body), 201))
  router.get('/', permission('view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.get('/:id', permission('view'), async (req, res) => sendData(req, res, await service.get(req.auth.companyId, req.params.id)))
  router.post('/:id/post', permission('edit'), authorizeCompany(db, 'Accounting', 'create'), authorizeCompany(db, 'Accounting', 'edit'), async (req, res) => sendData(req, res, await posting.post(context(req), req.params.id, req.body)))
  router.post('/:id/void', permission('edit'), authorizeCompany(db, 'Accounting', 'edit'), async (req, res) => sendData(req, res, await posting.void(context(req), req.params.id, req.body)))
  router.post('/', permission('create'), async (req, res) => sendData(req, res, await service.save(context(req), null, req.body), 201))
  router.patch('/:id', permission('edit'), async (req, res) => sendData(req, res, await service.save(context(req), req.params.id, req.body)))
  router.delete('/:id', permission('delete'), async (req, res) => { await service.remove(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
