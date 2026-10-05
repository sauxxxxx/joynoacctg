import { fixedAssets } from '../features/assets/fixedAssetData'
import { roles, storedDocuments } from '../features/company/companyStore'
import { taxCertificateRecords } from '../features/government/tax/taxCertificateData'
import { taxFormRecords } from '../features/government/tax/taxFormData'
import { yearlyTaxRecords } from '../features/government/tax/yearlyTaxData'
import { purchaseRecords, purchaseVendorName } from '../features/purchases/purchasePreviewData'
import { purchaseSetupRecords } from '../features/purchases/setup/purchaseSetupData'
import { customers } from '../features/sales/customers/customerPreviewStore'
import { salesDocuments, setupRecords } from '../features/sales/salesPreviewStore'
import { createRefRepository } from './refRepository'

export const roleRepository = createRefRepository('/roles', roles, { searchText: (item) => `${item.name} ${item.description}` })
export const documentRepository = createRefRepository('/documents', storedDocuments, { searchText: (item) => `${item.name} ${item.fileName} ${item.reference}` })
export const fixedAssetRepository = createRefRepository('/fixed-assets', fixedAssets, { searchText: (item) => `${item.trackingNumber} ${item.description} ${item.remarks}` })
export const purchaseRepository = createRefRepository('/purchases', purchaseRecords, { searchText: (item) => `${item.number} ${purchaseVendorName(item.vendorId)} ${item.remarks}` })
export const purchaseSetupRepository = createRefRepository('/purchase-setup', purchaseSetupRecords, { searchText: (item) => `${item.name} ${item.tin} ${item.address}` })
export const customerRepository = createRefRepository('/customers', customers, { searchText: (item) => `${item.name} ${item.tin} ${item.email}` })
export const salesDocumentRepository = createRefRepository('/sales-documents', salesDocuments, { searchText: (item) => `${item.number} ${item.remarks}` })
export const salesSetupRepository = createRefRepository('/sales-setup', setupRecords, { searchText: (item) => item.name })
export const taxFormRepository = createRefRepository('/tax-forms', taxFormRecords)
export const yearlyTaxFormRepository = createRefRepository('/yearly-tax-forms', yearlyTaxRecords)
export const taxCertificateRepository = createRefRepository('/tax-certificates', taxCertificateRecords, { searchText: (item) => `${item.party} ${item.tin}` })
