import { computed, ref } from 'vue'
import { createHttpRepository } from '../../services/repository'
import { useRecordWorkspace } from '../../services/useRecordWorkspace'
import { isPreviewMode } from '../../services/api/config'
import { purchaseSetupRecords } from '../purchases/setup/purchaseSetupData'
import { goods } from '../company/companyStore'

interface AssetReference { id: string; name: string; code: string; active: boolean }
export function useAssetReferences() {
  const vendors = ref<AssetReference[]>([])
  const items = ref<AssetReference[]>([])
  const vendorSource = useRecordWorkspace(createHttpRepository<AssetReference>('/reference-data/vendors'), vendors)
  const itemSource = useRecordWorkspace(createHttpRepository<AssetReference>('/reference-data/goods'), items)
  return {
    vendors: computed(() => isPreviewMode ? purchaseSetupRecords.value.filter((item) => item.kind === 'vendors') : vendors.value),
    items: computed(() => isPreviewMode ? goods.value : items.value),
    loading: computed(() => !isPreviewMode && (vendorSource.loading.value || itemSource.loading.value)),
    error: computed(() => isPreviewMode ? '' : vendorSource.error.value || itemSource.error.value),
    retry: () => Promise.all([vendorSource.load(), itemSource.load()]),
  }
}
