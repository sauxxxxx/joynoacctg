import type { EntityResponseDto } from '../../../contracts/dto'
import { http } from '../../../services/api/httpClient'
import { getApiCredentials } from '../../../services/api/session'
import { journalRepository } from '../journals/journalStore'
import { accountStore, categoryStore } from '../setup/accountSetupData'
import { companyProfile, reportingSettings, reportTemplates, type CompanyProfile, type ReportingSettings, type ReportTemplate } from '../../company/companyStore'
import type { AccountType, JournalSource, LedgerSource } from './ledgerContract'

export const liveLedger: LedgerSource = {
  label: 'Posted journal entries', isSample: false,
  async loadAccounts() {
    const token = getApiCredentials()?.accessToken
    const response = await http.get<EntityResponseDto<{ profile: CompanyProfile; reporting: ReportingSettings; templates: ReportTemplate[] }>>('/report-context')
    if (token !== getApiCredentials()?.accessToken) throw new Error('Your session changed. Please sign in again.')
    companyProfile.value = response.data.profile
    reportingSettings.value = response.data.reporting
    reportTemplates.value = response.data.templates
    await Promise.all([accountStore.reload(), categoryStore.reload()])
    if (accountStore.error.value || categoryStore.error.value) throw new Error(accountStore.error.value || categoryStore.error.value)
    return accountStore.items.value.map((account) => ({ id: account.id, code: account.code, name: account.name,
      type: account.type.toLowerCase() as AccountType, active: account.active,
      category: categoryStore.items.value.find((category) => category.code === account.parentCode)?.name || account.parentCode }))
  },
  async loadEntries() {
    return (await journalRepository.listAll()).map((entry) => ({ id: entry.id, entryNumber: entry.journalNumber, date: entry.date,
      source: entry.kind.replace('-journal', '') as JournalSource, reference: entry.referenceNumber, description: entry.remarks,
      status: entry.status === 'Posted' ? 'posted' as const : entry.status === 'Voided' ? 'void' as const : 'draft' as const,
      lines: entry.lines.map((line) => ({ accountId: line.accountId, debitCents: line.debitCents, creditCents: line.creditCents, memo: line.remarks })) }))
  },
}
