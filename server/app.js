import express, { Router } from 'express'
import { ApiFailure, errorHandler, requestContext, sendData } from './http/errors.js'
import { localCors } from './http/cors.js'
import { authenticate } from './security/authorize.js'
import { authRoutes } from './features/auth/authRoutes.js'
import { accountRoutes } from './features/accounting/accountRoutes.js'
import { openapi } from './openapi.js'

export function createApp(db) {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestContext, localCors, express.json({ limit: '1mb' }))
  app.get('/api/v1/openapi.json', (_req, res) => res.json(openapi))
  app.get('/api/v1/health', (req, res) => {
    db.prepare('SELECT 1').get()
    sendData(req, res, { status: 'ok', service: 'joyno-accounting-api' })
  })
  app.use('/api/v1/auth', authRoutes(db))
  const company = Router({ mergeParams: true })
  company.use(authenticate(db))
  company.use('/accounts', accountRoutes(db, 'accounts'))
  company.use('/account-categories', accountRoutes(db, 'categories'))
  app.use('/api/v1/companies/:companyId', company)
  app.use((_req, _res, next) => next(new ApiFailure('NOT_FOUND', 404, 'Endpoint not found.')))
  app.use(errorHandler)
  return app
}
