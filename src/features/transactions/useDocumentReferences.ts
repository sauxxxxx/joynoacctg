import { onMounted, ref } from 'vue'
import { getApiCredentials } from '../../services/api/session'
import { errorMessage } from '../../services/api/errors'
import { customerRepository, salesSetupRepository, purchaseSetupRepository } from '../../services/previewRepositories'
import { accountStore } from '../accounting/setup/accountSetupData'
import { customers } from '../sales/customers/customerPreviewStore'
import { setupRecords } from '../sales/salesPreviewStore'
import { purchaseSetupRecords } from '../purchases/setup/purchaseSetupData'
import { createHttpRepository } from '../../services/repository'
import { isPreviewMode } from '../../services/api/config'
import { documentSeries, goods, services, otherItems, type CompanyItem, type DocumentSeries } from '../company/companyStore'

export function useDocumentReferences(domain: 'sales-documents' | 'purchases') {
  const loading = ref(false); const error = ref('')
  let generation = 0
  async function load() {
    const current = ++generation; const token = getApiCredentials()?.accessToken
    loading.value = true; error.value = ''
    try {
      if (domain === 'sales-documents') {
        const [clients, setup, series, catalog] = await Promise.all([customerRepository.listAll(), salesSetupRepository.listAll(),
          isPreviewMode ? Promise.resolve(documentSeries.value) : createHttpRepository<DocumentSeries>('/reference-data/series').listAll(),
          isPreviewMode ? Promise.resolve([...goods.value, ...services.value, ...otherItems.value]) : createHttpRepository<CompanyItem>('/reference-data/catalog').listAll(), accountStore.reload()])
        if (accountStore.error.value) throw new Error(accountStore.error.value)
        if (current === generation && token === getApiCredentials()?.accessToken) {
          customers.value = clients; setupRecords.value = setup; documentSeries.value = series
          goods.value = catalog.filter((item) => item.kind === 'goods'); services.value = catalog.filter((item) => item.kind === 'services'); otherItems.value = catalog.filter((item) => item.kind === 'others')
        }
      } else {
        const setup = await purchaseSetupRepository.listAll()
        if (current === generation && token === getApiCredentials()?.accessToken) purchaseSetupRecords.value = setup
      }
    } catch (cause) { if (current === generation) error.value = errorMessage(cause, 'Record choices could not be loaded.') }
    finally { if (current === generation) loading.value = false }
  }
  onMounted(load)
  return { loading, error, load }
}
