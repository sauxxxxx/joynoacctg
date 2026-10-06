import { createCollectionStore } from '../../../services/collectionStore'
import { journalRepository } from './journalStore'
export const journalCollection = createCollectionStore(journalRepository)
