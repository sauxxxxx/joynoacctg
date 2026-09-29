<script setup lang="ts">
import { computed, ref } from 'vue'
import { Info, Lock, Plus, Trash2 } from '@lucide/vue'
import {
  emptyPermissions, permissionActions, permissionModules, recordAudit, roles, users,
  type PermissionAction, type PermissionModule, type Role,
} from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const clone = (role: Role): Role => JSON.parse(JSON.stringify(role))
const newRole = (): Role => ({ id: '', name: '', description: '', active: true, system: false, permissions: emptyPermissions() })

const draft = ref<Role>(clone(roles.value[0] ?? newRole()))
const error = ref('')
const notice = ref('')
const deleteDialog = ref<HTMLDialogElement | null>(null)
const assigned = (id: string) => users.value.filter((user) => user.roleId === id).length
const saved = computed(() => roles.value.find((role) => role.id === draft.value.id))
const dirty = computed(() => !saved.value || JSON.stringify(saved.value) !== JSON.stringify(draft.value))
const locked = computed(() => draft.value.system)
const grantedCount = (role: Role) => permissionModules.reduce((sum, module) => sum + permissionActions.filter((action) => role.permissions[module][action]).length, 0)

function select(role?: Role) {
  draft.value = role ? clone(role) : newRole()
  error.value = ''
  notice.value = ''
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

function save() {
  const name = draft.value.name.trim()
  if (!name) { error.value = 'Role name is required.'; return }
  if (roles.value.some((role) => role.id !== draft.value.id && role.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { error.value = 'Another role has this name.'; return }
  if (!draft.value.active && assigned(draft.value.id)) { error.value = 'Users still have this role. Assign them another role before deactivating it.'; return }
  const isNew = !draft.value.id
  const role: Role = { ...clone(draft.value), id: draft.value.id || crypto.randomUUID(), name, description: draft.value.description.trim() }
  roles.value = isNew ? [...roles.value, role] : roles.value.map((item) => item.id === role.id ? role : item)
  recordAudit('Company', isNew ? 'Created' : 'Updated', `Role: ${role.name}`, `${grantedCount(role)} permissions granted`)
  draft.value = clone(role)
  error.value = ''
  notice.value = `${role.name} ${isNew ? 'created' : 'saved'}.`
}

function askDelete() {
  if (draft.value.system) { notice.value = 'The Administrator role cannot be deleted.'; return }
  const count = assigned(draft.value.id)
  if (count) { notice.value = `${count} user${count === 1 ? ' has' : 's have'} this role. Assign another role first.`; return }
  deleteDialog.value?.showModal()
}

function confirmDelete() {
  const role = saved.value
  if (!role) return
  roles.value = roles.value.filter((item) => item.id !== role.id)
  recordAudit('Company', 'Deleted', `Role: ${role.name}`)
  deleteDialog.value?.close()
  select(roles.value[0])
  notice.value = `${role.name} deleted.`
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Roles">
    <div class="ws-stack">
      <p class="co-intro">Roles group permissions by module. Each user has one role.</p>
      <p class="ws-note"><Info :size="14" aria-hidden="true" />Sign-in is not connected yet, so permissions are recorded but not enforced.</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>

      <div class="co-roles">
        <div class="ws-panel ws-panel--clip">
          <div class="ws-panel__header"><div><h2>Roles</h2><p>{{ roles.length }} role{{ roles.length === 1 ? '' : 's' }}</p></div><button class="ws-button ws-button--small" type="button" @click="select()"><Plus :size="14" aria-hidden="true" /> New</button></div>
          <nav class="co-role-list" aria-label="Roles">
            <button v-for="role in roles" :key="role.id" class="co-role" type="button" :aria-current="role.id === draft.id" @click="select(role)">
              <span><strong>{{ role.name }}</strong><small>{{ assigned(role.id) }} user{{ assigned(role.id) === 1 ? '' : 's' }} · {{ grantedCount(role) }} permissions</small></span>
              <span class="ws-badge" :class="role.active ? 'ws-badge--success' : ''">{{ role.active ? 'Active' : 'Inactive' }}</span>
            </button>
            <p v-if="!draft.id" class="co-role" aria-current="true"><span><strong>New role</strong><small>Not saved yet</small></span></p>
          </nav>
        </div>

        <form class="ws-panel ws-panel--clip" @submit.prevent="save">
          <div class="ws-panel__header">
            <div><h2>{{ draft.id ? draft.name || 'Untitled role' : 'New role' }}</h2><p v-if="locked"><Lock :size="11" aria-hidden="true" /> Built-in role with full access. Only the description can change.</p></div>
            <div class="ws-panel__actions">
              <button v-if="draft.id && !locked" class="ws-button ws-button--small" type="button" @click="askDelete"><Trash2 :size="14" aria-hidden="true" /> Delete</button>
              <button class="ws-button ws-button--primary ws-button--small" type="submit" :disabled="!dirty">{{ draft.id ? 'Save changes' : 'Create role' }}</button>
            </div>
          </div>
          <div class="ws-panel__body ws-stack">
            <div class="ws-form">
              <label class="ws-field"><span>Role name<em> *</em></span><input v-model="draft.name" maxlength="80" required :disabled="locked" /></label>
              <label class="ws-check co-inline-check"><input v-model="draft.active" type="checkbox" :disabled="locked" /> Active</label>
              <label class="ws-field ws-form__full"><span>Description</span><input v-model="draft.description" maxlength="200" /></label>
            </div>
            <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table co-matrix">
              <caption class="ws-visually-hidden">Permissions by module</caption>
              <thead><tr><th scope="col">Module</th><th v-for="action in permissionActions" :key="action" scope="col">{{ action }}</th><th scope="col">All</th></tr></thead>
              <tbody>
                <tr v-for="module in permissionModules" :key="module">
                  <th scope="row">{{ module }}</th>
                  <td v-for="action in permissionActions" :key="action">
                    <input type="checkbox" :checked="draft.permissions[module][action]" :disabled="locked" :aria-label="`${module}: ${action}`" @change="toggle(module, action, ($event.target as HTMLInputElement).checked)" />
                  </td>
                  <td><input type="checkbox" :checked="permissionActions.every((action) => draft.permissions[module][action])" :disabled="locked" :aria-label="`${module}: all actions`" @change="toggleRow(module, ($event.target as HTMLInputElement).checked)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="ws-panel__footer"><span>Create, edit, and delete also turn on view.</span></div>
        </form>
      </div>
    </div>

    <dialog ref="deleteDialog" class="ws-dialog ws-dialog--small" aria-label="Confirm deletion">
      <div class="ws-dialog__header"><h2>Delete role?</h2></div>
      <div class="ws-dialog__body"><p>Remove <strong>{{ saved?.name }}</strong>? This cannot be undone.</p></div>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="ws-button ws-button--danger" type="button" @click="confirmDelete">Delete</button></div>
    </dialog>
  </section>
</template>
