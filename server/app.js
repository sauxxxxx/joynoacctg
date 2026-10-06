import express, { Router } from 'express'
import { ApiFailure, errorHandler, requestContext, sendData } from './http/errors.js'
import { localCors } from './http/cors.js'
import { authenticate } from './security/authorize.js'
import { authRoutes } from './features/auth/authRoutes.js'
import { accountRoutes } from './features/accounting/accountRoutes.js'
import { openapi } from './openapi.js'
import { asBackend } from './db/backend.js'
import { config } from './config.js'
import { journalRoutes } from './features/accounting/journalRoutes.js'
import { reportContextRoutes } from './features/accounting/reportRoutes.js'
import { dashboardRoutes } from './features/accounting/dashboardService.js'
import { taxRoutes } from './features/government/taxRoutes.js'
import { masterRoutes } from './features/records/masterRoutes.js'
import { bankingRoutes } from './features/banking/bankingRoutes.js'
import { referenceRoutes } from './features/records/referenceRoutes.js'
import { documentRoutes } from './features/transactions/documentRoutes.js'
import { privateDocumentRoutes } from './features/documents/documentRoutes.js'
import { booksRoutes } from './features/government/booksRoutes.js'
import { salesReportRoutes } from './features/accounting/salesReportRoutes.js'
import { auditRoutes, companyIdentityRoutes, companyRecordRoutes, companySettingsRoutes } from './features/company/companyRoutes.js'

export function createApp(db) {
  db = asBackend(db)
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use(requestContext, localCors)
  app.use('/api/v1/companies/:companyId/documents', authenticate(db), privateDocumentRoutes(db))
  app.use(express.json({ limit: '1mb' }))
  app.get('/api/v1/openapi.json', (_req, res) => res.json(openapi))
  app.get('/api/v1/health', async (req, res) => {
    await db.query('SELECT 1')
    sendData(req, res, { status: 'ok', service: 'joyno-accounting-api', database: db.dialect })
  })
  app.use('/api/v1/auth', authRoutes(db))
  const company = Router({ mergeParams: true })
  company.use(authenticate(db))
  company.use((req, _res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return next(new ApiFailure('VALIDATION_ERROR', 422, 'Send a JSON object for this action.'))
    next()
  })
  company.use('/accounts', accountRoutes(db, 'accounts'))
  company.use('/account-categories', accountRoutes(db, 'categories'))
  company.use('/settings', companySettingsRoutes(db))
  company.use('/roles', companyIdentityRoutes(db, 'roles'))
  company.use('/company/user', companyIdentityRoutes(db, 'users'))
  company.use('/company', companyRecordRoutes(db))
  company.use('/audit-events', auditRoutes(db))
  company.use('/journal-entries', journalRoutes(db))
  company.use('/report-context', reportContextRoutes(db))
  company.use('/sales-report-context', salesReportRoutes(db))
  company.use('/posted-books', booksRoutes(db))
  company.use('/dashboard', dashboardRoutes(db))
  for (const kind of ['tax-forms', 'yearly-tax-forms', 'tax-certificates']) company.use(`/${kind}`, taxRoutes(db, kind))
  for (const kind of ['customers', 'sales-setup', 'purchase-setup', 'bank-accounts', 'fixed-assets']) company.use(`/${kind}`, masterRoutes(db, kind))
  company.use('/bank-transactions', bankingRoutes(db))
  company.use('/reference-data', referenceRoutes(db))
  for (const domain of ['sales-documents', 'purchases']) company.use(`/${domain}`, documentRoutes(db, domain))
  app.use('/api/v1/companies/:companyId', company)
  app.use((_req, _res, next) => next(new ApiFailure('NOT_FOUND', 404, 'Endpoint not found.')))
  app.use(errorHandler)
  return app
}
