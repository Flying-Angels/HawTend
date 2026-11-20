import type { Journal } from './model.ts'
import { ledgerAccounts } from './account-ledger.ts'

export interface BalanceHistoryPoint {
  date: string
  balances: Map<string | null, number>
  totalCents: number | null
  missing: string[]
}

export function balanceHistory(journal: Journal) {
  const accounts = ledgerAccounts(journal)
  const dates = new Map<string, Map<string | null, number>>()
  for (const row of journal.accountSnapshots ?? []) {
    if (!dates.has(row.date)) dates.set(row.date, new Map())
    dates.get(row.date)!.set(row.accountId, row.balanceCents)
  }
  const previous = new Map<string | null, number>()
  const points: BalanceHistoryPoint[] = [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, balances]) => {
    // A closed account with a positive last balance still belongs to this total.
    const required = accounts.filter(a => a.active || balances.has(a.id) || (previous.get(a.id) ?? 0) > 0)
    const missing = required.filter(a => !balances.has(a.id)).map(a => a.name)
    const totalCents = missing.length ? null : [...balances.values()].reduce((sum, value) => sum + value, 0)
    for (const [id, value] of balances) previous.set(id, value)
    return { date, balances, totalCents, missing }
  })
  return { accounts, points }
}
