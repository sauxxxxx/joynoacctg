import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'

export class ApiFailure extends Error {
  constructor(code, status, message, fieldErrors = {}) {
    super(message)
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export function requestContext(req, res, next) {
  const supplied = req.get('X-Request-Id')
  req.requestId = supplied && /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : randomUUID()
  res.set('X-Request-Id', req.requestId)
  next()
}

export function sendData(req, res, data, status = 200) {
  res.status(status).json({ data, requestId: req.requestId })
}

export function errorHandler(error, req, res, _next) {
  if (error.type === 'entity.parse.failed') error = new ApiFailure('VALIDATION_ERROR', 422, 'Request body must be valid JSON.')
  if (error.type === 'entity.too.large') error = new ApiFailure('VALIDATION_ERROR', 413, 'Request body exceeds the 1 MB limit.')
  if (error instanceof ZodError) {
    const fieldErrors = {}
    for (const issue of error.issues) {
      const path = issue.path.join('.')
      ;(fieldErrors[path] ??= []).push(issue.message)
    }
    error = new ApiFailure('VALIDATION_ERROR', 422, 'Check the highlighted fields.', fieldErrors)
  }
  if (!(error instanceof ApiFailure)) {
    console.error(`[${req.requestId}]`, error)
    error = new ApiFailure('INTERNAL_ERROR', 500, 'An unexpected error occurred.')
  }
  res.status(error.status).json({ error: {
    code: error.code, message: error.message, fieldErrors: error.fieldErrors, requestId: req.requestId,
  } })
}
