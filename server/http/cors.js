import { config } from '../config.js'

export function localCors(req, res, next) {
  const origin = req.get('Origin')
  if (origin && config.allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-Id, X-Document-Metadata')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}
