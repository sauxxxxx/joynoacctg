import type { Ref } from 'vue'
import { createSettingsStore } from '../../services/settingsStore'
import { cloneRecord } from '../../services/repository'
import { createRefRepository } from '../../services/refRepository'
import { getApiCredentials, onSessionReset } from '../../services/api/session'
import { accountMappings, companyProfile, recordingSettings, registrationSettings, reportingSettings, roles, taxSettings, users } from './companyStore'

const settings = [
  { source: companyProfile, kind: 'profile' }, { source: recordingSettings, kind: 'recording' },
  { source: registrationSettings, kind: 'registration' }, { source: reportingSettings, kind: 'reporting' }, { source: taxSettings, kind: 'tax' },
].map(({ source, kind }) => {
  const target = source as Ref<object>
  const store = createSettingsStore(`/settings/${kind}`, target.value)
  const blank = cloneRecord(target.value)
  onSessionReset(() => { target.value = cloneRecord(blank) })
  return { source: target, store }
})
const mappings = createSettingsStore('/settings/mappings', { rows: cloneRecord(accountMappings.value) })
const blankMappings = cloneRecord(accountMappings.value).map((row) => ({ ...row, accountId: '' }))
onSessionReset(() => { accountMappings.value = cloneRecord(blankMappings) })
export const usersRepository = createRefRepository('/company/user', users)
export const rolesRepository = createRefRepository('/roles', roles)

export async function loadCompanySettings() {
  const token = getApiCredentials()?.accessToken
  await Promise.all(settings.map(async ({ source, store }) => {
    await store.ensureLoaded()
    if (token !== getApiCredentials()?.accessToken) throw new Error('Your session changed. Please sign in again.')
    if (store.error.value) throw new Error(store.error.value)
    source.value = cloneRecord(store.value.value)
  }))
  await mappings.ensureLoaded()
  if (token !== getApiCredentials()?.accessToken) throw new Error('Your session changed. Please sign in again.')
  if (mappings.error.value) throw new Error(mappings.error.value)
  if (mappings.value.value.rows.length) accountMappings.value = cloneRecord(mappings.value.value.rows)
}
export async function loadCompanyAccess() {
  const token = getApiCredentials()?.accessToken
  const [nextUsers, nextRoles] = await Promise.all([usersRepository.listAll(), rolesRepository.listAll()])
  if (token !== getApiCredentials()?.accessToken) throw new Error('Your session changed. Please sign in again.')
  users.value = nextUsers; roles.value = nextRoles
}
export async function saveCompanySettings<T extends object>(source: Ref<T>, value: T) {
  const entry = settings.find((item) => item.source === source)
  if (!entry) throw new Error('These settings cannot be saved.')
  const saved = await entry.store.save(value)
  source.value = cloneRecord(saved) as T
}
export async function saveAccountMappings(rows: typeof accountMappings.value) {
  const saved = await mappings.save({ rows })
  accountMappings.value = cloneRecord(saved.rows)
}
