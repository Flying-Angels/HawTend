import type { AccountSettlement, AccountSnapshot, Fund, Journal } from './model.ts'
import { assetType, manualValue, recordValuation, validAssetDate } from './assets.ts'
import { calendarTime } from './calendar-picker.ts'

export const BOOKKEEPING_INTERVAL = 25
const dayMs = 86_400_000
const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n)
const money = (n: unknown): n is number => integer(n) && n >= 0
const key = (id: string | null) => id === null ? 'unassigned' : `account:${id}`
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export const bookkeepingDays = (last: string | undefined, today: string) => last && validAssetDate(last) ? Math.max(0, (calendarTime(today) - calendarTime(last)) / dayMs) : null
export const bookkeepingDue = (last: string | undefined, today: string) => (bookkeepingDays(last, today) ?? 0) >= BOOKKEEPING_INTERVAL

export function ledgerAccounts(journal: Journal) {
  const result = new Map<string, { id: string | null; name: string; active: boolean }>()
  for (const account of journal.accounts ?? []) result.set(key(account.id), { id: account.id, name: account.name, active: true })
  if (journal.funds.some(f => !f.accountId)) result.set(key(null), { id: null, name: '暂未归到账户', active: true })
  for (const row of journal.accountSnapshots ?? []) {
    const id = key(row.accountId)
    if (!result.has(id)) result.set(id, { id: row.accountId, name: row.name, active: false })
  }
  return [...result.values()]
}

export function isAccountSnapshots(value: unknown): value is AccountSnapshot[] {
  if (!Array.isArray(value) || value.length > 5000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!object(row) || !(row.accountId === null || typeof row.accountId === 'string' && !!row.accountId.trim()) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80 || !validAssetDate(row.date) || !money(row.balanceCents)) return false
    const id = `${row.date}/${key(row.accountId)}`
    if (seen.has(id)) return false
    seen.add(id); return true
  })
}

export const settlementExpense = (row: AccountSettlement) => (row.openingCents - row.openingDebtCents) + row.incomeCents + row.gainCents - (row.closingCents - row.closingDebtCents)

export function isAccountSettlements(value: unknown): value is AccountSettlement[] {
  if (!Array.isArray(value) || value.length > 2000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!object(row) || !validAssetDate(row.from) || !validAssetDate(row.to) || row.from >= row.to || seen.has(`${row.from}/${row.to}`)
      || ![row.openingCents, row.closingCents, row.incomeCents, row.openingDebtCents, row.closingDebtCents].every(money) || !integer(row.gainCents) || !money(settlementExpense(row as unknown as AccountSettlement))) return false
    seen.add(`${row.from}/${row.to}`); return true
  })
}

export interface BalanceEdit { id: string; balanceCents: number; netFlowCents: number; distributionCents: number }
export type AccountUpdate = { accountId: string | null; date: string } & ({ balanceCents: number } | { assets: BalanceEdit[]; newCashId: string })

function updateAsset(fund: Fund, entry: BalanceEdit, day: string): Fund {
  if (!money(entry.balanceCents) || !integer(entry.netFlowCents) || !money(entry.distributionCents)) throw new Error('请填写有效余额与资金进出金额。')
  if (day < fund.startDate) throw new Error('该日早于已有余额日期，请只补录历史余额。')
  if (manualValue(fund)) {
    const same = fund.valuations?.find(v => v.date === day)
    if (entry.balanceCents === fund.principalCents && entry.netFlowCents === (same?.netFlowCents ?? 0) && entry.distributionCents === (same?.cashIncomeCents ?? 0) && day === fund.startDate) return fund
    return recordValuation(fund, { date: day, valueCents: entry.balanceCents, netFlowCents: entry.netFlowCents, cashIncomeCents: entry.distributionCents, note: same?.note ?? '' })
  }
  if (entry.balanceCents === fund.principalCents) return fund
  if (!fund.liquid && day >= fund.maturityDate) throw new Error(`「${fund.name}」已到期。请在资金安排中处理这项存款，或只记录当天总额。`)
  return { ...fund, principalCents: entry.balanceCents, startDate: day }
}

export function applyAccountUpdate(journal: Journal, input: AccountUpdate, today: string): Journal {
  const account = ledgerAccounts(journal).find(a => a.id === input.accountId)
  if (!account || !validAssetDate(input.date) || input.date > today) throw new Error('请选择有效账户和不晚于今天的日期。')
  let funds = journal.funds, balanceCents: number
  if ('assets' in input) {
    if (!account.active) throw new Error('已归档的账户只支持补录历史余额。')
    if (journal.accountSnapshots?.some(s => s.accountId === account.id && s.date > input.date)) throw new Error('这个账户已有更新的记录，请只补录历史余额。')
    const existing = funds.filter(f => (f.accountId ?? null) === account.id)
    const edits = new Map(input.assets.map(a => [a.id, a]))
    if (edits.size !== input.assets.length || (existing.length ? edits.size !== existing.length || existing.some(f => !edits.has(f.id)) : edits.size !== 1 || !edits.has(input.newCashId) || funds.some(f => f.id === input.newCashId))) throw new Error('账户资产已有变化，请重新打开此账户核对。')
    if (existing.length) funds = funds.map(f => (f.accountId ?? null) === account.id ? updateAsset(f, edits.get(f.id)!, input.date) : f)
    else funds = [...funds, { id: input.newCashId, name: '账户余额', accountId: account.id ?? undefined, principalCents: edits.get(input.newCashId)!.balanceCents, rate: 0, startDate: input.date, mode: 'compound', liquid: true, assetType: 'cash', returnMode: 'fixed', maturityDate: '' }]
    balanceCents = input.assets.reduce((sum, a) => sum + a.balanceCents, 0)
  } else balanceCents = input.balanceCents
  if (!money(balanceCents)) throw new Error('请填写有效的非负余额。')
  const accountSnapshots = [...(journal.accountSnapshots ?? []).filter(s => s.accountId !== account.id || s.date !== input.date), { accountId: account.id, name: account.name, date: input.date, balanceCents }]
  if (!isAccountSnapshots(accountSnapshots)) throw new Error('余额记录未能保存，请检查金额或先导出备份。')
  return { ...journal, funds, accountSnapshots, lastBookkeepingDay: today }
}

export function balanceComparison(journal: Journal, from: string, to: string) {
  const snapshots = journal.accountSnapshots ?? []
  const accounts = ledgerAccounts(journal).filter(a => a.active || snapshots.some(s => s.accountId === a.id && s.date >= from && s.date <= to)
    || (snapshots.filter(s => s.accountId === a.id && s.date < from).sort((a, b) => b.date.localeCompare(a.date))[0]?.balanceCents ?? 0) > 0)
  const opening = snapshots.filter(s => s.date === from), closing = snapshots.filter(s => s.date === to)
  const missing = (rows: AccountSnapshot[]) => accounts.filter(a => !rows.some(s => s.accountId === a.id)).map(a => a.name)
  const missingOpening = missing(opening), missingClosing = missing(closing)
  const openingCents = opening.reduce((sum, s) => sum + s.balanceCents, 0), closingCents = closing.reduce((sum, s) => sum + s.balanceCents, 0)
  return { openingCents, closingCents, missingOpening, missingClosing, ready: validAssetDate(from) && validAssetDate(to) && from < to && accounts.length > 0 && !missingOpening.length && !missingClosing.length }
}

// Only suggest recorded gains whose history starts and ends on these exact days.
export function recordedIntervalGains(funds: Fund[], from: string, to: string) {
  let gainCents = 0, count = 0
  for (const fund of funds) {
    if (!manualValue(fund) || assetType(fund) !== 'fund' || !fund.valuationBase) continue
    const values = fund.valuations ?? []
    const start = values.find(v => v.date === from)?.valueCents ?? (fund.valuationBase.date === from ? fund.valuationBase.valueCents : undefined)
    const end = values.find(v => v.date === to)
    if (start === undefined || !end || from >= to) continue
    gainCents += end.valueCents - start + values.filter(v => v.date > from && v.date <= to).reduce((sum, v) => sum - v.netFlowCents + v.cashIncomeCents, 0)
    count++
  }
  return { gainCents, count }
}
