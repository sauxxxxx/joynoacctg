import test from 'node:test'
import assert from 'node:assert/strict'
import { openapi } from '../openapi.js'
test('OpenAPI includes implemented registers, versioned writes and safe identity responses', () => {
  const root = '/companies/{companyId}'
  for (const resource of ['journal-entries', 'roles', 'company/user', 'company/owner', 'tax-forms', 'yearly-tax-forms', 'tax-certificates', 'customers', 'sales-setup', 'purchase-setup', 'bank-accounts', 'fixed-assets', 'bank-transactions']) {
    assert.ok(openapi.paths[`${root}/${resource}`].post)
    const patch = openapi.paths[`${root}/${resource}/{id}`].patch.requestBody.content['application/json'].schema
    assert.ok(patch.required.includes('expectedVersion'))
  }
  const user = openapi.paths[`${root}/company/user/{id}`].get.responses[200].content['application/json'].schema.properties.data
  assert.equal(user.properties.password, undefined)
  assert.equal(user.properties.password_hash, undefined)
  const settings = openapi.paths[`${root}/settings/profile`].put.requestBody.content['application/json'].schema
  assert.equal(settings.properties.expectedVersion.minimum, 0)
  const posted = openapi.paths[`${root}/journal-entries/{id}/post`].post.responses[200].content['application/json'].schema.properties.data
  assert.ok(posted.required.includes('id'))
  assert.ok(posted.required.includes('version'))
  assert.ok(openapi.paths[`${root}/bank-transactions/create-journals`].post)
  assert.ok(openapi.paths[`${root}/bank-transactions/{id}/void`].post)
  assert.ok(openapi.paths[`${root}/documents`].post.requestBody.content['application/octet-stream'])
  assert.ok(openapi.paths[`${root}/documents/{id}/restore`].post)
  assert.equal(openapi.paths['/auth/me'].get.responses[200].content['application/json'].schema.properties.data.properties.password_hash, undefined)
  assert.ok(openapi.paths['/auth/change-password'].post.requestBody.content['application/json'].schema.required.includes('currentPassword'))
})
