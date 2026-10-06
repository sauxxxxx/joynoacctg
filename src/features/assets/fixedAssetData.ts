import { ref } from 'vue'
import { toIsoDate } from '../../components/ui/dateUtils'

export interface FixedAssetRecord {
  id: string
  version?: number
  salesInvoice: string
  trackingNumber: string
  datePurchased: string
  description: string
  vendorId: string
  itemId: string
  purchasePriceCents: number
  vatCents: number
  usefulLifeMonths: number
  salvageValueCents: number
  remarks: string
  lapsedMonths: number
  warrantyExpirationDate: string
}

export interface UnclaimedAssetRecord {
  id: string
  invoiceNumber: string
  invoiceDate: string
  itemName: string
  amountCents: number
  vatCents: number
  deferredVat: boolean
}

export const fixedAssets = ref<FixedAssetRecord[]>([])
export const unclaimedAssets = ref<UnclaimedAssetRecord[]>([])

export function emptyFixedAsset(): FixedAssetRecord {
  return {
    id: '', salesInvoice: '', trackingNumber: '', datePurchased: toIsoDate(new Date()), description: '', vendorId: '', itemId: '',
    purchasePriceCents: 0, vatCents: 0, usefulLifeMonths: 60, salvageValueCents: 0, remarks: '', lapsedMonths: 0,
    warrantyExpirationDate: '',
  }
}

export function monthlyDepreciationCents(asset: FixedAssetRecord): number {
  if (asset.usefulLifeMonths <= 0) return 0
  return Math.round(Math.max(asset.purchasePriceCents - asset.salvageValueCents, 0) / asset.usefulLifeMonths)
}

export function accumulatedDepreciationCents(asset: FixedAssetRecord): number {
  return Math.min(monthlyDepreciationCents(asset) * Math.max(asset.lapsedMonths, 0), Math.max(asset.purchasePriceCents - asset.salvageValueCents, 0))
}

export function bookValueCents(asset: FixedAssetRecord): number {
  return Math.max(asset.purchasePriceCents - accumulatedDepreciationCents(asset), asset.salvageValueCents)
}

export function isDepreciated(asset: FixedAssetRecord): boolean {
  return asset.usefulLifeMonths > 0 && asset.lapsedMonths >= asset.usefulLifeMonths
}
