import type { FinancialPlan, Goal, Journal } from './model.ts'
import { availableForPlanning, manualValue } from './assets.ts'
import { futureValue } from './finance.ts'
import { goalStatus } from './goals.ts'
import { monthAt, monthIndex } from './timeline-range.ts'
import { isSalaryDeductions, MAX_SALARY_CENTS, salaryFromGross } from './income-tax.ts'

const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
const lastDay = (month: string) => new Date(dayTime(`${monthAt(monthIndex(month) + 1)}-01`) - 86400000).toISOString().slice(0, 10)
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function isFinancialPlan(value: unknown): value is FinancialPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return money(row.monthlyExpenseCents) && typeof row.annualRate === 'number' && Number.isFinite(row.annualRate) && row.annualRate >= 0 && row.annualRate <= 30
    && (row.monthlyIncomeCents === undefined || money(row.monthlyIncomeCents))
    && (row.includeRedeemable === undefined || typeof row.includeRedeemable === 'boolean')
    && (row.includedMonthlyGoalIds === undefined || Array.isArray(row.includedMonthlyGoalIds) && row.includedMonthlyGoalIds.length <= 2000 && row.includedMonthlyGoalIds.every(id => typeof id === 'string') && new Set(row.includedMonthlyGoalIds).size === row.includedMonthlyGoalIds.length)
    && (row.incomeBasis === undefined || row.incomeBasis === 'net' || row.incomeBasis === 'gross')
    && (row.salaryDeductions === undefined || isSalaryDeductions(row.salaryDeductions))
    && (row.grossMonthlyIncomeCents === undefined || money(row.grossMonthlyIncomeCents) && row.grossMonthlyIncomeCents <= MAX_SALARY_CENTS && row.incomeBasis === 'gross' && row.monthlyIncomeCents === salaryFromGross(row.grossMonthlyIncomeCents, row.salaryDeductions as FinancialPlan['salaryDeductions'] ?? { monthlyEmployeeCents: 0, monthlyAdditionalCents: 0 }).netCents)
}

export function financialDefaults(journal: Journal, today: string): FinancialPlan {
  const recent = [...(journal.monthlySummaries ?? [])].filter(row => row.month < today.slice(0, 7)).sort((a, b) => b.month.localeCompare(a.month))[0]
  return journal.financialPlan ?? { monthlyExpenseCents: recent?.expenseCents ?? 0, annualRate: .8, includeRedeemable: false }
}

export function planningHorizon(journal: Journal, today: string): string {
  const dates = journal.goals.filter(g => goalStatus(g) !== 'done' && g.date >= today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0)).map(g => g.date)
  return dates.length ? dates.sort().at(-1)! : lastDay(monthAt(monthIndex(today) + 12))
}

export interface MonthFlow {
  month: string
  date: string
  incomeCents: number
  interestCents: number
  expenseCents: number
  dailyExpenseCents: number
  wishExpenseCents: number
  maturityCents: number
  balanceCents: number
  minimumCents: number
  wishes: { id: string; title: string; amountCents: number; kind: 'once' | 'monthly'; date: string }[]
}
interface Event { date: string; kind: 'income' | 'expense' | 'maturity' | 'close'; amount: number; wish?: Goal; monthly?: boolean }

function schedule(journal: Journal, plan: FinancialPlan, today: string, end: string) {
  const active = journal.goals.filter(g => goalStatus(g) !== 'done' && g.date >= today)
  const included = new Set(plan.includedMonthlyGoalIds ?? [])
  const events: Event[] = []
  const origin = monthIndex(today), finish = Math.max(origin, monthIndex(end))
  for (let index = origin; index <= finish; index++) {
    const month = monthAt(index), date = `${month}-01`
    // Current balances already contain this month's completed income and expenses.
    // Full monthly flows start next month; pending one-off wishes still use exact dates.
    if (index > origin) {
      events.push({ date, kind: 'income', amount: 0 }, { date, kind: 'expense', amount: plan.monthlyExpenseCents })
      for (const wish of active) if ((wish.monthlyBudgetCents ?? 0) > 0 && wish.monthlyStartMonth && month >= wish.monthlyStartMonth && month <= wish.date.slice(0, 7) && !included.has(wish.id)) {
        events.push({ date, kind: 'expense', amount: wish.monthlyBudgetCents!, wish, monthly: true })
      }
    }
    events.push({ date: lastDay(month) < end ? lastDay(month) : end, kind: 'close', amount: 0 })
  }
  let opening = 0, excluded = 0
  for (const fund of journal.funds) {
    if (manualValue(fund) && !plan.includeRedeemable) { excluded += fund.principalCents; continue }
    if (availableForPlanning(fund, today)) opening += fund.principalCents
    else if (fund.maturityDate > today && fund.maturityDate <= end) events.push({ date: fund.maturityDate, kind: 'maturity', amount: futureValue(fund, fund.maturityDate) })
  }
  for (const wish of active) if (wish.budgetCents > 0 && wish.date <= end) events.push({ date: wish.date, kind: 'expense', amount: wish.budgetCents, wish })
  const order = { maturity: 0, income: 1, expense: 2, close: 3 }
  events.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind])
  return { opening, excluded, events: events.filter(e => e.date >= today && e.date <= end) }
}

const growth = (plan: FinancialPlan, before: string, after: string) => (1 + plan.annualRate / 100) ** ((dayTime(after) - dayTime(before)) / 86400000 / 365)

// Cash at each payment date is A + B * monthly income. Each date imposes a
// lower bound; taking the greatest one prevents early deficits even when a
// later deposit maturity would make the final balance positive.
export function requiredIncome(journal: Journal, plan: FinancialPlan, today: string) {
  const horizon = planningHorizon(journal, today), { opening, events, excluded } = schedule(journal, plan, today, horizon)
  let a = opening, b = 0, previous = today, required = 0, shortfall = 0, limitingDate = horizon
  for (const event of events) {
    const factor = growth(plan, previous, event.date); a *= factor; b *= factor; previous = event.date
    if (event.kind === 'income') b += 1
    if (event.kind === 'maturity') a += event.amount
    if (event.kind === 'expense') a -= event.amount
    if (a < 0 && b === 0) shortfall = Math.max(shortfall, -a)
    if (b > 0 && -a / b > required) { required = -a / b; limitingDate = event.date }
  }
  return { incomeCents: shortfall > .00001 ? null : Math.max(0, Math.ceil(required - 1e-8)), upfrontShortfallCents: Math.ceil(shortfall), horizon, limitingDate, openingCents: opening, excludedCents: excluded }
}

export function cashflowProjection(journal: Journal, plan: FinancialPlan, today: string, until: string) {
  const required = requiredIncome(journal, plan, today)
  const end = until > required.horizon ? until : required.horizon
  const { events, opening } = schedule(journal, plan, today, end)
  const monthlyIncome = plan.monthlyIncomeCents ?? required.incomeCents ?? 0
  const rows = new Map<string, MonthFlow>()
  let balance = opening, previous = today
  const get = (date: string) => {
    const month = date.slice(0, 7)
    if (!rows.has(month)) rows.set(month, { month, date: lastDay(month), incomeCents: 0, interestCents: 0, expenseCents: 0, dailyExpenseCents: 0, wishExpenseCents: 0, maturityCents: 0, balanceCents: 0, minimumCents: Math.round(balance), wishes: [] })
    return rows.get(month)!
  }
  for (const event of events) {
    const row = get(event.date)
    const interest = Math.max(0, balance) * (growth(plan, previous, event.date) - 1)
    row.interestCents += interest
    balance += interest; previous = event.date
    if (event.kind === 'income') { balance += monthlyIncome; row.incomeCents += monthlyIncome }
    if (event.kind === 'maturity') { balance += event.amount; row.maturityCents += event.amount }
    if (event.kind === 'expense') {
      balance -= event.amount; row.expenseCents += event.amount
      if (event.wish) { row.wishExpenseCents += event.amount; row.wishes.push({ id: event.wish.id, title: event.wish.title, amountCents: event.amount, kind: event.monthly ? 'monthly' : 'once', date: event.date }) }
      else row.dailyExpenseCents += event.amount
    }
    row.minimumCents = Math.min(row.minimumCents, Math.round(balance)); row.balanceCents = Math.round(balance)
    if (event.kind === 'close') row.date = event.date
  }
  return { required, monthlyIncomeCents: monthlyIncome, rows: [...rows.values()].map(row => ({ ...row, interestCents: Math.round(row.interestCents) })) }
}
