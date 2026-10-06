import express, { Router } from 'express'
import { z } from 'zod'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData } from '../../http/errors.js'
import { signInRateLimit } from '../../http/rateLimit.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { MAX_FILE_BYTES } from './documentSchemas.js'
import { privateDocumentService } from './documentService.js'

/** Authenticated binary uploads stay outside the general JSON parser. No public file URLs. */
export function privateDocumentRoutes(db) {
  const router = Router({ mergeParams: true })
  const service = privateDocumentService(db)
  const permission = (action) => authorizeCompany(db, 'Documents', action)
  const context = (req) => ({ ...req.auth, requestId: req.requestId })
  router.get('/', permission('view'), async (req, res) => res.json({ ...await service.list(req.auth.companyId, req.query), requestId: req.requestId }))
  router.post('/', permission('create'), signInRateLimit('Too many uploads. Try again in a minute.'), express.raw({ type: 'application/octet-stream', limit: MAX_FILE_BYTES, inflate: false }), async (req, res) => sendData(req, res, await service.upload(context(req), req.get('X-Document-Metadata'), req.body), 201))
  router.get('/:id/content', permission('view'), async (req, res) => {
    const { metadata, bytes } = await service.content(req.auth.companyId, req.params.id)
    const encoded = encodeURIComponent(metadata.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    res.set('Content-Type', metadata.mimeType)
    res.set('Content-Disposition', `attachment; filename="document.${metadata.fileName.split('.').at(-1)}"; filename*=UTF-8''${encoded}`)
    res.set('Content-Security-Policy', "default-src 'none'; sandbox")
    res.send(bytes)
  })
  router.post('/:id/restore', permission('edit'), express.json({ limit: '10kb' }), async (req, res) => {
    const { expectedVersion } = z.object({ expectedVersion: versionSchema }).strict().parse(req.body)
    sendData(req, res, await service.archive(context(req), req.params.id, expectedVersion, false))
  })
  router.delete('/:id', permission('delete'), async (req, res) => { await service.archive(context(req), req.params.id, req.query.expectedVersion); res.sendStatus(204) })
  return router
}
