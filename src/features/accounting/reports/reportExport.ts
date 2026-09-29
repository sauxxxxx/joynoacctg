import { recordAudit } from '../../company/companyStore'
import { downloadCsv, fileSlug } from './reportFormat'

/** Downloads a report as CSV and records the export in the audit trail. */
export function exportReport(title: string, period: string, rows: (string | number)[][]) {
  downloadCsv(`${fileSlug(`${title} ${period}`)}.csv`, [[title], [period], [], ...rows])
  recordAudit('Accounting', 'Exported', title, period)
}
