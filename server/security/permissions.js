export const modules = ['Sales', 'Purchases', 'Accounting', 'Government', 'Banking', 'Asset Management', 'Company', 'Documents']
export const actions = ['view', 'create', 'edit', 'delete']

export function administratorPermissions() {
  return Object.fromEntries(modules.map((module) => [module,
    Object.fromEntries(actions.map((action) => [action, true])),
  ]))
}
