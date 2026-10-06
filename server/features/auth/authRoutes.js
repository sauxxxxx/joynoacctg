import { Router } from 'express'
import { z } from 'zod'
import { sendData } from '../../http/errors.js'
import { signInRateLimit } from '../../http/rateLimit.js'
import { authenticate } from '../../security/authorize.js'
import { signIn, signOut } from './authService.js'
import { selfService } from './selfService.js'

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
}).strict()

export function authRoutes(db) {
  const router = Router()
  const self = selfService(db)
  router.get('/me', authenticate(db), async (req, res) => sendData(req, res, await self.profile(req.auth.userId)))
  router.patch('/me', authenticate(db), signInRateLimit(), async (req, res) => sendData(req, res, await self.update({ ...req.auth, requestId: req.requestId }, req.body)))
  router.post('/change-password', authenticate(db), signInRateLimit(), async (req, res) => sendData(req, res, await self.update({ ...req.auth, requestId: req.requestId }, req.body, true)))
  router.post('/sign-in', signInRateLimit(), async (req, res) => {
    sendData(req, res, await signIn(db, credentialsSchema.parse(req.body), req.requestId))
  })
  router.post('/sign-out', authenticate(db), async (req, res) => {
    await signOut(db, req.auth.token)
    sendData(req, res, { signedOut: true })
  })
  return router
}
