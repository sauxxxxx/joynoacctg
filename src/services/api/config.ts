import { isConnectedPage, isConnectedResource, resolveWorkspace, workspaceUrl, type WorkspaceMode } from './workspacePolicy'

// Normal local and hosted sessions use the same API. Sample adapters are test-only.
const workspace = resolveWorkspace(
  typeof window === 'undefined' ? '' : window.location.search,
  import.meta.env.VITE_API_BASE_URL ?? '', Boolean(import.meta.env.DEV), import.meta.env.MODE === 'test',
)

export const apiConfig = {
  baseUrl: workspace.baseUrl,
  /** Milliseconds before a request is abandoned and reported as a network error. */
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30_000,
} as const

export type DataMode = 'preview' | 'api'

export const dataMode: DataMode = workspace.mode === 'connected' ? 'api' : 'preview'

export const isPreviewMode = dataMode === 'preview'
export const workspaceMode = workspace.mode
export const connectedAvailable = workspace.connectedAvailable
export const usesApiResource = (resource: string) => !isPreviewMode && isConnectedResource(resource)
export const supportsWorkspacePage = (pageId: string) => isPreviewMode || isConnectedPage(pageId)

export function switchWorkspace(mode: WorkspaceMode) {
  if (mode !== workspaceMode) window.location.assign(workspaceUrl(window.location.href, mode))
}
