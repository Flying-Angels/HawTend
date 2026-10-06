import type { AssetAccount, AssetType, Fund, Valuation } from './model.ts'

export const assetTypes: Record<AssetType, string> = { cash: '现金与闲置余额', deposit: '存款', fund: '基金', other: '其他资产' }
export const accountKinds: Record<AssetAccount['kind'], string> = { payment: '支付平台', bank: '银行', cash: '现金', other: '其他' }
export const assetType = (fund: Fund): AssetType => fund.assetType ?? (fund.rate === 0 && fund.liquid ? 'cash' : 'deposit')
export const manualValue = (fund: Fund) => fund.returnMode === 'manual'
export const planningRate = (fund: Fund) => manualValue(fund) ? 0 : fund.rate
export const availableForPlanning = (fund: Fund, today: string) => fund.liquid || Boolean(fund.maturityDate && fund.maturityDate <= today)
export const accountBalance = (funds: Fund[], id?: string) => funds.filter(f => f.accountId === id).reduce((sum, f) => sum + f.principalCents, 0)
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const signedMoney = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
export const validAssetDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const date = new Date(`${v}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v
}
export function isAssetAccounts(value: unknown): value is AssetAccount[] {
  if (!Array.isArray(value) || value.length > 100) return false
  const ids = new Set<string>(), names = new Set<string>()
  return value.every(row => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)
      || typeof row.name !== 'string' || row.name !== row.name.trim() || !row.name || row.name.length > 40
      || names.has(row.name.toLocaleLowerCase()) || !Object.hasOwn(accountKinds, row.kind)) return false
    ids.add(row.id); names.add(row.name.toLocaleLowerCase()); return true
  })
}
export function validFundDetails(row: Record<string, unknown>, accountIds: Set<string>): boolean {
  if (row.accountId !== undefined && (typeof row.accountId !== 'string' || !accountIds.has(row.accountId))) return false
  if (row.assetType !== undefined && !Object.hasOwn(assetTypes, row.assetType as string)) return false
  if (row.returnMode !== undefined && row.returnMode !== 'manual' && row.returnMode !== 'fixed') return false
  const base = row.valuationBase as Fund['valuationBase']
  if (base !== undefined && (!base || !validAssetDate(base.date) || !money(base.valueCents))) return false
  const records = row.valuations as Valuation[] | undefined
  if (records !== undefined) {
    if (!base || !Array.isArray(records) || records.length > 2000) return false
    let previous = ''
    for (const record of records) {
      if (!record || !validAssetDate(record.date) || record.date < base.date || record.date <= previous || !money(record.valueCents)
        || !signedMoney(record.netFlowCents) || !money(record.cashIncomeCents) || typeof record.note !== 'string') return false
      previous = record.date
    }
  }
  if (row.returnMode === 'manual') {
    if (!base) return false
    const latest = records?.at(-1) ?? base
    if (latest.date !== row.startDate || latest.valueCents !== row.principalCents) return false
  }
  return true
}
export function periodGain(fund: Fund, record: Valuation): number {
  const before = [...(fund.valuations ?? [])].filter(v => v.date < record.date).at(-1) ?? fund.valuationBase
  if (!before) throw new Error('请先记录初始市值。')
  return record.valueCents - before.valueCents - record.netFlowCents + record.cashIncomeCents
}
// A date is one snapshot, not an amount to add repeatedly. Corrections to the
// latest date use the preceding snapshot, keeping its original period intact.
export function recordValuation(fund: Fund, record: Valuation): Fund {
  if (!manualValue(fund) || !fund.valuationBase) throw new Error('请先设置为手动更新市值。')
  const latest = fund.valuations?.at(-1) ?? fund.valuationBase
  if (!validAssetDate(record.date) || record.date < latest.date) throw new Error('记录日期不能早于最近一次市值；可修改最近一条或记录新的日期。')
  if (!money(record.valueCents) || !signedMoney(record.netFlowCents) || !money(record.cashIncomeCents)) throw new Error('请填写有效金额，市值和现金分红不能为负。')
  const valuations = [...(fund.valuations ?? []).filter(v => v.date !== record.date), record]
  if (valuations.length > 2000) throw new Error('市值记录已达到当前上限，请先导出备份。')
  return { ...fund, principalCents: record.valueCents, startDate: record.date, valuations }
}
