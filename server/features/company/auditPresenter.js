const names = { accounts: 'Account', categories: 'Account category', 'journal-entries': 'Journal entry', users: 'User', roles: 'Role',
  'company/user': 'User', 'company/owner': 'Owner', 'company/good': 'Good', 'company/service': 'Service', 'company/item': 'Item',
  'company/series': 'Numbering series', 'company/message template': 'Message template', 'company/report template': 'Report template',
  'tax-forms': 'Tax return record', 'yearly-tax-forms': 'Annual tax record', 'tax-certificates': 'Tax certificate', customers: 'Customer',
  'sales-setup': 'Sales setup', 'purchase-setup': 'Purchase setup', 'bank-accounts': 'Bank account', 'bank-transactions': 'Bank transaction', 'fixed-assets': 'Fixed asset', 'sales-documents': 'Sales document', purchases: 'Purchase document', documents: 'Document', 'self-profile': 'Personal profile', 'self-password': 'Account password' }
const modules = { customers: 'Sales', 'sales-setup': 'Sales', 'sales-documents': 'Sales', purchases: 'Purchases', 'purchase-setup': 'Purchases', 'bank-accounts': 'Banking', 'bank-transactions': 'Banking', 'fixed-assets': 'Asset Management', documents: 'Documents' }
const settingsNames = { profile: 'Company profile', registration: 'Registration', recording: 'Recording settings', reporting: 'Reporting settings', tax: 'Tax preferences', mappings: 'Account mappings' }
export function presentAudit(row) {
  const record = JSON.parse(row.after_json || row.before_json || '{}')
  const kind = row.entity_type
  const label = names[kind] || 'Record'
  const title = record.journalNumber ? `#${record.journalNumber}` : record.number || record.name || record.username || record.code || record.documentType || record.reference || record.trackingNumber || record.party || [record.firstName, record.lastName].filter(Boolean).join(' ') || record.formId?.replace('form-', '').toUpperCase() || ''
  const module = modules[kind] || (['accounts', 'categories', 'journal-entries'].includes(kind) ? 'Accounting' : kind.includes('tax-') ? 'Government' : 'Company')
  return { id: row.id, at: new Date(row.created_at).toISOString(), user: row.actor_name || '', module, action: row.action,
    reference: kind === 'settings' ? settingsNames[row.entity_id] || 'Company settings' : `${label}${title ? ': ' + title : ''}`, details: '' }
}
