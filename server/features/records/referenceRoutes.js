import { Router } from 'express'
import { authorizeCompanyAny } from '../../security/authorize.js'
import { referenceService } from './referenceService.js'

export function referenceRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = referenceService(db)
  const permissions = {
    accounts: ['Accounting', 'Banking', 'Sales', 'Purchases', 'Company', 'Asset Management'],
    vendors: ['Purchases', 'Asset Management'],
    goods: ['Company', 'Sales', 'Purchases', 'Asset Management'],
    catalog: ['Company', 'Sales', 'Purchases'],
    series: ['Company', 'Sales'],
  }
  for (const kind of Object.keys(permissions)) router.get(`/${kind}`, authorizeCompanyAny(db, permissions[kind].map((module) => [module, 'view'])), async (req, res) => {
    const result = kind === 'accounts' ? await service.accounts(req.auth.companyId, req.query) : await service.records(req.auth.companyId, kind, req.query)
    res.json({ ...result, requestId: req.requestId })
  })
  return router
}
