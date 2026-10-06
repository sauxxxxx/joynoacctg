import { domainPaths } from './openapi/domainContracts.js'
import { privatePaths } from './openapi/privateContracts.js'
const reference = (name) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema) => ({ 'application/json': { schema } })
const envelope = (schema) => ({ type: 'object', required: ['data', 'requestId'], properties: { data: schema, requestId: { type: 'string' } } })
const errorResponse = { description: 'Structured API error', content: json(reference('Error')) }
const failureResponses = { 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse }
const companyParameter = { name: 'companyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }

function resourcePaths(resource, name) {
  const path = `/companies/{companyId}/${resource}`
  const requestBody = (schema) => ({ required: true, content: json(schema) })
  return {
    [path]: {
      parameters: [companyParameter],
      get: {
        summary: `List ${resource}`, tags: ['Accounting'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'active', in: 'query', schema: { type: 'boolean' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: name === 'Account' ? ['code', 'name', 'type'] : ['code', 'name'], default: 'code' } },
          { name: 'sortDirection', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
        ],
        responses: { 200: { description: 'Paginated records', content: json({ type: 'object', properties: {
          data: { type: 'array', items: reference(name) }, page: { type: 'integer' }, pageSize: { type: 'integer' },
          total: { type: 'integer' }, totalPages: { type: 'integer' }, requestId: { type: 'string' },
        } }) }, ...failureResponses },
      },
      post: { summary: `Create ${name}`, tags: ['Accounting'], requestBody: requestBody(reference(`${name}Input`)),
        responses: { 201: { description: 'Created record', content: json(envelope(reference(name))) }, ...failureResponses } },
    },
    [`${path}/{id}`]: {
      parameters: [companyParameter, idParameter],
      get: { summary: `Get ${name}`, tags: ['Accounting'], responses: { 200: { description: 'Record', content: json(envelope(reference(name))) }, ...failureResponses } },
      patch: { summary: `Update ${name}`, description: 'Send the complete editable record and its current expectedVersion.', tags: ['Accounting'],
        requestBody: requestBody({ allOf: [reference(`${name}Input`), { type: 'object', required: ['expectedVersion'], properties: { expectedVersion: { type: 'integer', minimum: 1 } } }] }),
        responses: { 200: { description: 'Updated record with incremented version', content: json(envelope(reference(name))) }, ...failureResponses } },
      delete: { summary: `Delete unreferenced ${name}`, tags: ['Accounting'], parameters: [
        { name: 'expectedVersion', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
      ], responses: { 204: { description: 'Deleted' }, ...failureResponses } },
    },
  }
}

const common = {
  code: { type: 'string', pattern: '^[A-Z0-9-]{1,24}$' }, name: { type: 'string', minLength: 1, maxLength: 120 },
  parentCode: { type: 'string', maxLength: 24 }, remarks: { type: 'string', maxLength: 240, default: '' }, active: { type: 'boolean', default: true },
}
const accountType = { type: 'string', enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] }
const recordFields = { id: { type: 'string', format: 'uuid' }, version: { type: 'integer', minimum: 1 } }
const accountInput = { type: 'object', required: ['code', 'name', 'parentCode', 'type'], properties: {
  ...common, type: accountType, itr: { type: 'string', maxLength: 100, default: '' }, legalBasis: { type: 'string', maxLength: 160, default: '' },
} }
const categoryInput = { type: 'object', required: ['code', 'name'], properties: { ...common, accountType } }

export const openapi = {
  openapi: '3.1.0', info: { title: 'Joyno Accounting API', version: '0.1.0', description: 'Company-scoped accounting, journal posting, company administration and tax record tracking. Payroll calculation and official tax filing submission are outside the scope.' },
  servers: [{ url: '/api/v1' }], security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { summary: 'Database health', security: [], responses: { 200: { description: 'Healthy', content: json(envelope({ type: 'object', properties: { status: { const: 'ok' }, service: { type: 'string' } } })) } } } },
    '/auth/sign-in': { post: { summary: 'Sign in', tags: ['Authentication'], security: [], requestBody: { required: true, content: json({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } }) },
      responses: { 200: { description: 'Session and active memberships', content: json(envelope(reference('Session'))) }, 429: errorResponse, ...failureResponses } } },
    '/auth/sign-out': { post: { summary: 'Revoke current session', tags: ['Authentication'], responses: { 200: { description: 'Signed out', content: json(envelope({ type: 'object', properties: { signedOut: { const: true } } })) }, ...failureResponses } } },
    ...resourcePaths('accounts', 'Account'), ...resourcePaths('account-categories', 'AccountCategory'),
    ...domainPaths, ...privatePaths,
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'Opaque access token returned by sign-in.' } },
    schemas: {
      AccountInput: accountInput, AccountCategoryInput: categoryInput,
      Account: { allOf: [accountInput, { type: 'object', required: ['id', 'version'], properties: recordFields }] },
      AccountCategory: { allOf: [categoryInput, { type: 'object', required: ['id', 'version'], properties: recordFields }] },
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message', 'requestId'], properties: {
        code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' },
        fieldErrors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
      } } } },
      Session: { type: 'object', required: ['accessToken', 'expiresAt', 'user', 'memberships'], properties: {
        accessToken: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' },
        user: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, username: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' }, active: { type: 'boolean' } } },
        memberships: { type: 'array', items: { type: 'object', properties: { companyId: { type: 'string', format: 'uuid' }, companyName: { type: 'string' }, role: { type: 'string' }, permissions: { type: 'object' } } } },
      } },
    },
  },
}
