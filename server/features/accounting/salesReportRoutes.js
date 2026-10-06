import { Router } from 'express'
import { authorizeCompanyAny } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { settingsService } from '../company/settingsService.js'
export function salesReportRoutes(db) {
  const router = Router({ mergeParams: true })
  router.get('/', authorizeCompanyAny(db, [['Accounting', 'view'], ['Sales', 'view']]), async (req, res) => {
    const settings = settingsService(db)
    const companyId = req.auth.companyId
    const [documents, customers, profile, reporting, templates] = await Promise.all([
      jsonRecordRepository(db, 'sales-documents').all(companyId), jsonRecordRepository(db, 'customers').all(companyId),
      settings.load(companyId, 'profile'), settings.load(companyId, 'reporting'), jsonRecordRepository(db, 'report template').all(companyId),
    ])
    sendData(req, res, { documents, customers: customers.map(({ id, name }) => ({ id, name })), profile, reporting, templates })
  })
  return router
}
