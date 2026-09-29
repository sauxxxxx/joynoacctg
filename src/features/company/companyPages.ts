export const companyPageIds = [
  'company-profile', 'company-owners', 'company-registration', 'company-recording', 'company-reporting', 'company-tax-rules',
  'users', 'roles', 'goods', 'services', 'other-items', 'message-templates', 'series', 'report-templates', 'audit-trail',
  'add-ons', 'documents',
] as const

export type CompanyPageId = typeof companyPageIds[number]
