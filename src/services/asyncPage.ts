import { defineAsyncComponent, type Component } from 'vue'
import AppSkeleton from '../components/ui/AppSkeleton.vue'
import AsyncPageError from '../components/ui/AsyncPageError.vue'

/** Keep the page frame visible while a route's code is downloaded. */
export const asyncPage = (loader: () => Promise<Component | { default: Component }>) => defineAsyncComponent({ loader, loadingComponent: AppSkeleton, errorComponent: AsyncPageError, delay: 0, timeout: 30_000 })
