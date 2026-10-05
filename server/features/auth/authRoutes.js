import { Router } from 'express'
import { z } from 'zod'
import { sendData } from '../../http/errors.js'
import { signInRateLimit } from '../../http/rateLimit.js'
import { authenticate } from '../../security/authorize.js'
import { signIn, signOut } from './authService.js'

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
})

export function authRoutes(db) {
  const router = Router()
  router.post('/sign-in', signInRateLimit(), async (req, res) => {
    sendData(req, res, await signIn(db, credentialsSchema.parse(req.body)))
  })
  router.post('/sign-out', authenticate(db), (req, res) => {
    signOut(db, req.auth.token)
    sendData(req, res, { signedOut: true })
  })
  return router
}
