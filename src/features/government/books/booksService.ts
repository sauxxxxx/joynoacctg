import { isPreviewMode } from '../../../services/api/config'
import { http } from '../../../services/api/httpClient'
import type { ListResponseDto } from '../../../contracts/dto'
import { previewBirBooksService } from './previewBirBooksService'
import type { BirBookEntry, BirBooksService } from './birBooksContract'

export const booksService: BirBooksService = isPreviewMode ? previewBirBooksService : {
  async list(query) {
    const result = await http.get<ListResponseDto<BirBookEntry>>('/posted-books', { query: { page: query.page, pageSize: query.pageSize, search: query.search, ...query.filters, sortBy: query.sortBy, sortDirection: query.sortDirection } })
    return { items: result.data, page: result.page, pageSize: result.pageSize, totalItems: result.total, totalPages: result.totalPages }
  },
}
