import type { Fund } from './model.ts'

export const cents = (yuan: string | number): number => Math.round(Number(yuan) * 100)
export const yuan = (value: number): string => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value / 100)
export const exactYuan = (value: number): string => new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)
const utc = (date: string) => new Date(`${date}T00:00:00Z`)

// 原型采用参考日余额、固定年利率、实际天数/365；定期到期后默认零收益。
export function futureValue(fund: Fund, targetDate: string): number {
  const end = !fund.liquid && fund.maturityDate && targetDate > fund.maturityDate ? fund.maturityDate : targetDate
  const start = utc(fund.startDate)
  const endDate = utc(end)
  // 完整周年按整数年计，周年之后的零头按实际天数/365。
  let years = Math.max(0, endDate.getUTCFullYear() - start.getUTCFullYear())
  const anniversary = new Date(start)
  anniversary.setUTCFullYear(start.getUTCFullYear() + years)
  if (anniversary > endDate) { years = Math.max(0, years - 1); anniversary.setUTCFullYear(start.getUTCFullYear() + years) }
  const fraction = Math.max(0, (endDate.getTime() - anniversary.getTime()) / 86400000 / 365)
  const duration = endDate < start ? 0 : years + fraction
  const rate = fund.rate / 100
  return Math.round(fund.principalCents * (fund.mode === 'compound' ? (1 + rate) ** duration : 1 + rate * duration))
}

export function monthsUntil(referenceDate: string, targetDate: string): number {
  const a = utc(referenceDate), b = utc(targetDate)
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return 0
  const difference = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()
  const targetMonthEnd = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0))
  return Math.max(0, difference + (b.getUTCDate() === targetMonthEnd.getUTCDate() ? 1 : 0))
}

// 月末投入、有效年化转月利率、已有分配资金独立计息；结果向上取整到分。
export function monthlySaving(budgetCents: number, allocatedCents: number, annualRate: number, months: number): { futureAllocated: number; gap: number; monthly: number | null } {
  const rate = (1 + annualRate / 100) ** (1 / 12) - 1
  const factor = (1 + rate) ** months
  const futureAllocated = Math.round(allocatedCents * factor)
  const gap = Math.max(0, budgetCents - futureAllocated)
  if (!gap) return { futureAllocated, gap, monthly: 0 }
  if (months <= 0) return { futureAllocated, gap, monthly: null }
  const accumulation = Math.abs(rate) < 1e-12 ? months : (factor - 1) / rate
  return { futureAllocated, gap, monthly: Math.ceil(gap / accumulation) }
}
