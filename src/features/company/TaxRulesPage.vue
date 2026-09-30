<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle, ClipboardList, ListChecks, MoreHorizontal } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { taxSettings, type TaxSettings } from './companyStore'
import { toOptions } from './recordConfig'
import SaveBar from './SaveBar.vue'
import SubNavLayout from './SubNavLayout.vue'
import { useSettingsDraft } from './useSettingsDraft'
import '../workspace/workspace.css'
import './company.css'

type Section = 'basic' | 'advance' | 'others'
const sections: { id: Section; label: string; icon: typeof ClipboardList }[] = [
  { id: 'basic', label: 'Basic', icon: ClipboardList },
  { id: 'advance', label: 'Advance', icon: ListChecks },
  { id: 'others', label: 'Others', icon: MoreHorizontal },
]
const section = ref<Section>('basic')

// Categories only. The app does not hold tax rates or decide which rules apply.
const deductionMethods = toOptions(['Itemized Deduction', 'Optional Standard Deduction'])
const filingMethods = toOptions(['eFiling and Payment System', 'eBIRForms', 'Manual Filing'])
const classifications = toOptions(['Micro', 'Small', 'Medium', 'Large'])
const incomeTaxTypes = toOptions(['Regular Rate', 'Special Rate'])
type TaxKey = 'vat' | 'vatExempt' | 'zeroRated' | 'twa'
const activations: { key: TaxKey; title: string }[] = [
  { key: 'vat', title: 'Value Added Tax' },
  { key: 'vatExempt', title: 'Value Added Tax Exempt' },
  { key: 'zeroRated', title: 'Zero Rated' },
  { key: 'twa', title: 'TWA' },
]

function validate(draft: TaxSettings): string {
  if (!draft.deductionMethod) return 'Choose the Method of Deduction in Basic.'
  for (const { key, title } of activations) {
    const tax = draft[key]
    if (tax.active && (!tax.taxCode.trim() || !tax.startDate)) return `${title} is activated. Enter its Tax Code and Start Date in Advance.`
  }
  if (draft.availsTaxRelief && !draft.taxReliefDetails.trim()) return 'Specify the Special Law or International Tax Treaty in Others.'
  return ''
}
const { draft, error, notice, dirty, save, discard } = useSettingsDraft(taxSettings, 'Tax rules', validate)
</script>

<template>
  <section class="ws-page co-page" aria-label="Tax Rules">
    <div class="ws-stack">
      <p v-if="notice && !dirty" class="ws-notice" role="status">{{ notice }}</p>
      <SubNavLayout v-model="section" :items="sections" label="Tax rule sections">
        <div v-if="section === 'basic'" class="ws-stack">
          <div class="ws-panel co-card">
            <div class="ws-form">
              <div class="ws-field"><AppSelect id="tax-deduction" v-model="draft.deductionMethod" label="Method of Deduction" required placeholder="Select method" :options="deductionMethods" /></div>
              <div class="ws-field"><AppSelect id="tax-filing" v-model="draft.filingMethod" label="Filing Method" placeholder="Select filing method" :options="filingMethods" /></div>
              <div class="ws-field"><AppSelect id="tax-classification" v-model="draft.taxpayerClassification" label="Tax Payer Classification" placeholder="Select classification" :options="classifications" /></div>
            </div>
            <p class="co-callout co-callout--warning"><AlertTriangle :size="15" aria-hidden="true" />The system does not file tax returns. After finalizing a form, file it yourself{{ draft.filingMethod ? ` through ${draft.filingMethod}` : '' }}.</p>
          </div>
          <div class="ws-panel co-card">
            <h2 class="co-card__title">Income Tax Computation</h2>
            <div class="ws-form co-form--type-atc">
              <div class="ws-field"><AppSelect id="tax-income-type" v-model="draft.incomeTaxType" label="Type" placeholder="Select type" :options="incomeTaxTypes" /></div>
              <label class="ws-field"><span>ATC</span><input v-model="draft.incomeTaxAtc" maxlength="160" placeholder="e.g. Corporation in general" /></label>
            </div>
          </div>
        </div>

        <div v-else-if="section === 'advance'" class="ws-stack">
          <div v-for="item in activations" :key="item.key" class="ws-panel co-card">
            <h2 class="co-card__title">{{ item.title }}</h2>
            <label class="ws-switch">
              <input v-model="draft[item.key].active" type="checkbox" />
              <span class="ws-switch__track" aria-hidden="true" />Activate
            </label>
            <div v-if="draft[item.key].active" class="ws-form co-card__follow">
              <label class="ws-field"><span>Tax Code<em> *</em></span><input v-model="draft[item.key].taxCode" maxlength="160" placeholder="e.g. VAT on business services in general" /></label>
              <div class="ws-field"><AppDatePicker :id="`tax-${item.key}-start`" v-model="draft[item.key].startDate" label="Start Date" required /></div>
            </div>
          </div>
        </div>

        <div v-else class="ws-panel co-card">
          <label class="ws-check"><input v-model="draft.availsTaxRelief" type="checkbox" /> Is this company availing tax relief under Special Law or International Tax Treaty?</label>
          <label class="ws-field co-card__follow"><span>If yes, please specify<em v-if="draft.availsTaxRelief"> *</em></span><input v-model="draft.taxReliefDetails" maxlength="300" :disabled="!draft.availsTaxRelief" /></label>
        </div>
      </SubNavLayout>
      <SaveBar :dirty="dirty" :error="error" @save="save" @discard="discard" />
    </div>
  </section>
</template>
