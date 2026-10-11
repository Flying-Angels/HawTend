import type { Goal } from './model.ts'
import { exactYuan, monthlySaving, monthsUntil } from './finance.ts'

export const goalStatuses = { wish: '想做', ongoing: '进行中', done: '已完成' } as const
export function goalStatus(goal: Goal): keyof typeof goalStatuses {
  return goal.status ?? (goal.progress >= 100 ? 'done' : goal.progress > 0 ? 'ongoing' : 'wish')
}

const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1
const validMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1

// Both kinds of cost can coexist. Monthly budgets count whole calendar months,
// including the start and end month, and never become recorded transactions.
export function goalCosts(goal: Goal) {
  const monthly = goal.monthlyBudgetCents ?? 0
  const start = goal.monthlyStartMonth ?? ''
  const end = goal.date.slice(0, 7)
  const months = monthly > 0 && validMonth(start) && validMonth(end)
    ? Math.max(0, monthIndex(end) - monthIndex(start) + 1) : 0
  const recurring = monthly * months
  return { once: goal.budgetCents, monthly, months, recurring, total: goal.budgetCents + recurring }
}

export function goalBudgetLabel(goal: Goal) {
  const { once, monthly } = goalCosts(goal)
  return [once ? `一次性 ¥${exactYuan(once)}` : '', monthly ? `每月 ¥${exactYuan(monthly)}` : ''].filter(Boolean).join(' · ') || '预算暂未填写'
}

// Legacy allocations are archival metadata, not an implied movement of money.
export function wishSaving(goal: Goal, today: string) {
  const months = monthsUntil(today, goal.date)
  return { ...monthlySaving(goal.budgetCents, 0, goal.newSavingRate ?? 0, months), months }
}

export function validGoalDetails(row: Record<string, unknown>): boolean {
  if (!money(row.budgetCents) || !money(row.allocatedCents) || typeof row.progress !== 'number' || !Number.isFinite(row.progress) || row.progress < 0 || row.progress > 100) return false
  if (row.status !== undefined && (typeof row.status !== 'string' || !Object.hasOwn(goalStatuses, row.status))) return false
  if (row.newSavingRate !== undefined && (typeof row.newSavingRate !== 'number' || !Number.isFinite(row.newSavingRate) || row.newSavingRate < 0 || row.newSavingRate > 30)) return false
  if (row.monthlyBudgetCents !== undefined && !money(row.monthlyBudgetCents)) return false
  if (row.monthlyStartMonth !== undefined && !validMonth(row.monthlyStartMonth)) return false
  if (typeof row.monthlyBudgetCents === 'number' && row.monthlyBudgetCents > 0) {
    if (!validMonth(row.monthlyStartMonth) || typeof row.date !== 'string' || row.monthlyStartMonth > row.date.slice(0, 7)) return false
    if (!Number.isSafeInteger(goalCosts(row as unknown as Goal).total)) return false
  }
  return true
}
