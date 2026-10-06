import { ApiFailure } from './errors.js'

export function signInRateLimit(message = 'Too many attempts. Try again in a minute.') {
  const attempts = new Map()
  const windowMs = 60_000
  return (req, res, next) => {
    const now = Date.now()
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key)
    const key = req.ip
    const entry = attempts.get(key) ?? { count: 0, resetAt: now + windowMs }
    entry.count += 1
    attempts.set(key, entry)
    if (entry.count > 10) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return next(new ApiFailure('RATE_LIMITED', 429, message))
    }
    next()
  }
}
