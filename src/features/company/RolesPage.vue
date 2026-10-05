<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Check, Info, Lock, Plus, Search, Trash2, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { roleRepository } from '../../services/previewRepositories'
import {
  emptyPermissions, permissionActions, permissionModules, recordAudit, roles, users,
  type PermissionAction, type PermissionModule, type Role,
} from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const clone = (role: Role): Role => JSON.parse(JSON.stringify(role))
const newRole = (): Role => ({ id: '', name: '', description: '', active: true, system: false, permissions: emptyPermissions() })

const search = ref('')
const status = ref('active')
const statusOptions = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'all', label: 'All roles' }]
const draft = ref<Role>(newRole())
const error = ref('')
const notice = ref('')
const formDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const pendingDelete = ref<Role | null>(null)

const assigned = (id: string) => users.value.filter((user) => user.roleId === id).length
const locked = computed(() => draft.value.system)
const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return roles.value.filter((role) => (status.value === 'all' || role.active === (status.value === 'active'))
    && (!term || `${role.name} ${role.description}`.toLocaleLowerCase().includes(term)))
})

function openForm(role?: Role) {
  draft.value = role ? clone(role) : newRole()
  error.value = ''
  formDialog.value?.showModal()
  nextTick(() => nameInput.value?.focus())
}

// Creating, editing, or deleting records requires seeing them, so any of those turns on View.
function toggle(module: PermissionModule, action: PermissionAction, value: boolean) {
  const row = draft.value.permissions[module]
  row[action] = value
  if (value && action !== 'view') row.view = true
  if (!value && action === 'view') permissionActions.forEach((item) => { row[item] = false })
}

function toggleRow(module: PermissionModule, value: boolean) {
  permissionActions.forEach((action) => { draft.value.permissions[module][action] = value })
}

async function save() {
  const name = draft.value.name.trim()
  if (!name) { error.value = 'Role name is required.'; return }
  if (roles.value.some((role) => role.id !== draft.value.id && role.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { error.value = 'Another role has this name.'; return }
  if (draft.value.id && !draft.value.active && assigned(draft.value.id)) { error.value = 'Users still have this role. Assign them another role before deactivating it.'; return }
  const isNew = !draft.value.id
  const role: Role = { ...clone(draft.value), id: draft.value.id || crypto.randomUUID(), name, description: draft.value.description.trim() }
  await roleRepository.save(role)
  recordAudit('Company', isNew ? 'Created' : 'Updated', `Role: ${role.name}`)
  notice.value = `${role.name} ${isNew ? 'added' : 'updated'}.`
  formDialog.value?.close()
}

function deleteFromForm() {
  const role = roles.value.find((item) => item.id === draft.value.id)
  if (!role) return
  if (role.system) { error.value = 'The Administrator role cannot be deleted.'; return }
  const count = assigned(role.id)
  if (count) { error.value = `${count} user${count === 1 ? ' has' : 's have'} this role. Assign another role first.`; return }
  formDialog.value?.close()
  pendingDelete.value = role
  deleteDialog.value?.showModal()
}

async function confirmDelete() {
  const role = pendingDelete.value
  if (!role) return
  await roleRepository.remove(role.id)
  recordAudit('Company', 'Deleted', `Role: ${role.name}`)
  notice.value = `${role.name} deleted.`
  deleteDialog.value?.close()
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Roles">
    <div class="ws-stack">
      <p class="ws-note"><Info :size="14" aria-hidden="true" />Preview permissions shape navigation and actions. Backend authorization remains the security boundary.</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>
      <div class="ws-panel ws-panel--clip">
        <div class="ws-panel__header">
          <div><h2>Company User Roles</h2><p>Roles group permissions by module. Each user has one role.</p></div>
          <div class="ws-panel__actions">
            <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" aria-label="Search roles" /></label>
            <div class="ws-toolbar__field"><AppSelect v-model="status" aria-label="Filter by status" :options="statusOptions" /></div>
            <button class="ws-button ws-button--primary" type="button" @click="openForm()"><Plus :size="16" aria-hidden="true" /> Add role</button>
          </div>
        </div>
        <table class="ws-table co-list">
          <thead><tr><th scope="col">Name</th><th scope="col">Description</th><th scope="col" class="co-list__center">Active?</th></tr></thead>
          <tbody>
            <tr v-for="role in visible" :key="role.id" class="co-list__row" @click="openForm(role)">
              <td><button class="co-list__link" type="button" :aria-label="`Open ${role.name}`" @click.stop="openForm(role)">{{ role.name }}</button></td>
              <td>{{ role.description }}</td>
              <td class="co-list__center"><span class="co-check" :class="{ 'co-check--on': role.active }" role="img" :aria-label="role.active ? 'Active' : 'Inactive'"><Check v-if="role.active" :size="13" :stroke-width="3" aria-hidden="true" /></span></td>
            </tr>
            <tr v-if="!visible.length" class="co-list__empty"><td colspan="3"><strong>No rows to show</strong><span>{{ roles.length ? 'Try another search or status.' : 'Add a role to get started.' }}</span></td></tr>
          </tbody>
          <tfoot><tr><td colspan="3">{{ visible.length }}</td></tr></tfoot>
        </table>
      </div>
    </div>

    <dialog ref="formDialog" class="ws-dialog ws-dialog--wide" aria-labelledby="role-dialog-title">
      <form novalidate @submit.prevent="save">
        <div class="ws-dialog__header"><h2 id="role-dialog-title">{{ draft.id ? 'Edit role' : 'Add role' }}</h2><button class="ws-icon-button" type="button" aria-label="Close" @click="formDialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div class="ws-dialog__body">
          <p v-if="locked" class="ws-note"><Lock :size="13" aria-hidden="true" />Built-in role with full access. Only the description can change.</p>
          <div class="ws-form">
            <label class="ws-field"><span>Name<em> *</em></span><input ref="nameInput" v-model="draft.name" maxlength="80" :disabled="locked" /></label>
            <label class="ws-check co-inline-check"><input v-model="draft.active" type="checkbox" :disabled="locked" /> Active</label>
            <label class="ws-field ws-form__full"><span>Description</span><input v-model="draft.description" maxlength="200" /></label>
          </div>
          <div class="ws-table-wrap co-matrix-wrap">
            <table class="ws-table co-matrix">
              <caption class="ws-visually-hidden">Permissions by module</caption>
              <thead><tr><th scope="col">Module</th><th v-for="action in permissionActions" :key="action" scope="col">{{ action }}</th><th scope="col">All</th></tr></thead>
              <tbody>
                <tr v-for="module in permissionModules" :key="module">
                  <th scope="row">{{ module }}</th>
                  <td v-for="action in permissionActions" :key="action"><input type="checkbox" :checked="draft.permissions[module][action]" :disabled="locked" :aria-label="`${module}: ${action}`" @change="toggle(module, action, ($event.target as HTMLInputElement).checked)" /></td>
                  <td><input type="checkbox" :checked="permissionActions.every((action) => draft.permissions[module][action])" :disabled="locked" :aria-label="`${module}: all actions`" @change="toggleRow(module, ($event.target as HTMLInputElement).checked)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="co-card__hint">Create, edit, and delete also turn on view.</p>
          <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        </div>
        <div class="ws-dialog__footer">
          <button v-if="draft.id && !locked" class="ws-button co-button--ghost-danger" type="button" @click="deleteFromForm"><Trash2 :size="15" aria-hidden="true" /> Delete</button>
          <button class="ws-button" type="button" @click="formDialog?.close()">Cancel</button>
          <button class="ws-button ws-button--primary" type="submit">{{ draft.id ? 'Save changes' : 'Add role' }}</button>
        </div>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="ws-dialog ws-dialog--small" aria-label="Confirm deletion" @close="pendingDelete = null">
      <div class="ws-dialog__header"><h2>Delete role?</h2></div>
      <div class="ws-dialog__body"><p>Remove <strong>{{ pendingDelete?.name }}</strong>? This cannot be undone.</p></div>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="ws-button ws-button--danger" type="button" @click="confirmDelete">Delete</button></div>
    </dialog>
  </section>
</template>
