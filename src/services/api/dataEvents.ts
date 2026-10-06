const listeners = new Set<(resource: string) => void>()
export function onDataChanged(listener: (resource: string) => void) { listeners.add(listener) }
export function notifyDataChanged(resource: string) { listeners.forEach((listener) => listener(resource)) }
