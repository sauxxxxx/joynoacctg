import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { settingsService } from '../company/settingsService.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'

export function reportContextRoutes(db) {
  const router = Router({ mergeParams: true })
  router.get('/', authorizeCompany(db, 'Accounting', 'view'), async (req, res) => {
    const settings = settingsService(db)
    const [profile, reporting] = await Promise.all([settings.load(req.auth.companyId, 'profile'), settings.load(req.auth.companyId, 'reporting')])
    const templates = await jsonRecordRepository(db, 'report template').all(req.auth.companyId)
    sendData(req, res, { profile, reporting, templates })
  })
  return router
}
