import assert from 'node:assert/strict'
import type { Goal, Journal, FinancialPlan } from '../src/model.ts'
import { cashflowProjection, requiredIncome, financialDefaults, isFinancialPlan } from '../src/cashflow.ts'
import { isJournal } from '../src/cloud/journal-validation.ts'
import { isUneditedSample, seedJournal } from '../src/model.ts'

const today = '2026-10-11'
const plan: FinancialPlan = { monthlyExpenseCents: 10000, annualRate: 0, fundingSource: 'assets-and-salary' }
const wish = (edit: Partial<Goal>): Goal => ({ id: 'wish', title: '虚构心愿', date: '2027-01-31', category: 'life', budgetCents: 90000, allocatedCents: 0, progress: 0, description: '', ...edit })
const journal = (goals: Goal[], capital = 0): Journal => ({ schemaVersion: 1, theme: 'paper', moments: [], goals, funds: capital ? [{ id: 'cash', name: '测试现金', principalCents: capital, rate: 0, liquid: true, startDate: today, maturityDate: '', mode: 'compound' }] : [] })
assert.equal(requiredIncome(journal([wish({})]), plan, today).incomeCents, 40000, '3 incomes cover 900 yuan wish and 300 yuan baseline expense')
assert.equal(requiredIncome(journal([wish({})], 30000), plan, today).incomeCents, 30000, 'existing capital offsets the same full schedule once')
const mixed = journal([wish({ budgetCents: 60000, monthlyBudgetCents: 10000, monthlyStartMonth: '2026-10' })])
assert.equal(requiredIncome(mixed, plan, today).incomeCents, 40000, 'current month regular flows are already in opening balances; next 3 months add monthly wish fees')
assert.equal(requiredIncome(mixed, { ...plan, includedMonthlyGoalIds: ['wish'] }, today).incomeCents, 30000, 'fees already in baseline are not charged twice')
assert.equal(requiredIncome(journal([wish({ date: '2026-11-05', budgetCents: 60000 }), wish({ id: 'later', date: '2027-01-31', budgetCents: 0, monthlyBudgetCents: 1, monthlyStartMonth: '2027-01' })]), plan, today).incomeCents, 70000, 'early payment constraint overrides a smaller final-average income')
assert.equal(requiredIncome(journal([wish({ status: 'done' })]), plan, today).incomeCents, 10000, 'completed wishes are not paid a second time')
assert.equal(requiredIncome(journal([wish({ date: '2026-10-15' })]), plan, today).incomeCents, null, 'next-month income cannot fix a current-month shortfall')
assert.equal(requiredIncome(journal([wish({ date: '2026-10-15' })]), plan, today).upfrontShortfallCents, 90000)
const locked = journal([wish({ date: '2026-11-20', budgetCents: 100000 })])
locked.funds = [{ id: 'fixed', name: '测试定期', principalCents: 100000, rate: 5, startDate: '2025-11-20', maturityDate: '2026-11-20', liquid: false, mode: 'compound' }]
assert.equal(requiredIncome(locked, { ...plan, monthlyExpenseCents: 0 }, today).incomeCents, 0, 'maturity before same-day payment releases contract principal and interest')
assert.equal(requiredIncome({ ...locked, funds: [{ ...locked.funds[0], maturityDate: '2026-12-20' }] }, { ...plan, monthlyExpenseCents: 0 }, today).incomeCents, 100000, 'later locked money cannot fund an earlier wish')
const market = journal([wish({})], 100000)
market.funds[0] = { ...market.funds[0], returnMode: 'manual', assetType: 'fund', valuationBase: { date: today, valueCents: 100000 } }
assert.equal(requiredIncome(market, { ...plan, monthlyExpenseCents: 0 }, today).incomeCents, 30000, 'manual market values are excluded by default')
assert.equal(requiredIncome(market, { ...plan, monthlyExpenseCents: 0, includeRedeemable: true }, today).incomeCents, 0, 'explicit inclusion redeems at recorded value, not predicted fund appreciation')
const copy = JSON.stringify(mixed)
const result = cashflowProjection(mixed, { ...plan, annualRate: .8 }, today, '2028-12-31')
assert.ok(result.required.incomeCents! < 40000, '0.8% compound balance slightly reduces income')
assert.ok(result.rows.filter(r => r.date <= result.required.horizon).every(r => r.minimumCents >= 0), 'suggested income covers every payment')
assert.equal(result.rows.find(r => r.month === '2027-01')!.wishExpenseCents, 70000, 'mixed final month includes one-off plus recurring expense')
assert.equal(JSON.stringify(mixed), copy, 'simulation never mutates records')
assert.equal(cashflowProjection(mixed, { ...plan, annualRate: .8 }, today, '2100-12-31').required.incomeCents, result.required.incomeCents, 'panning and zooming do not alter the income horizon or suggestion')
assert.ok(cashflowProjection(mixed, { ...plan, monthlyIncomeCents: 0 }, today, '2027-01-31').rows.at(-1)!.balanceCents < 0, 'insufficient custom income shows a deficit')
const zero = cashflowProjection(journal([]), { monthlyExpenseCents: 0, annualRate: .8 }, today, '2027-10-31')
assert.equal(zero.required.incomeCents, 0, 'empty plan has no invented income requirement')
assert.deepEqual(financialDefaults({ ...journal([]), monthlySummaries: [{ month: '2026-09', incomeCents: 1800000, expenseCents: 650000, note: '' }] }, today), { monthlyExpenseCents: 650000, annualRate: .8, includeRedeemable: false, fundingSource: 'salary-only', incomeBasis: 'gross' })
assert.equal(isJournal({ ...mixed, financialPlan: plan }), true)
assert.equal(isUneditedSample({ ...seedJournal(), financialPlan: plan }), false, 'a saved personal plan must preserve an edited legacy journal')
const monthlyRows = cashflowProjection(mixed, plan, today, '2027-01-31').rows
assert.equal(monthlyRows.find(r => r.month === '2026-10')!.incomeCents, 0, 'do not credit a second current-month salary')
assert.deepEqual(monthlyRows.filter(r => r.month > '2026-10').map(r => [r.incomeCents, r.dailyExpenseCents, r.wishExpenseCents]), [[40000, 10000, 10000], [40000, 10000, 10000], [40000, 10000, 70000]], 'month totals reconcile with scheduled one-off and recurring payments')
const maturityRow = cashflowProjection(locked, { ...plan, monthlyExpenseCents: 0 }, today, '2026-11-30').rows.at(-1)!
assert.equal(maturityRow.maturityCents, 105000)
assert.equal(maturityRow.incomeCents, 0, 'maturity principal and contract interest are a transfer into cash, not salary again')
// Independent discounting formula for one future payment, no daily expenses.
const compoundPlan: FinancialPlan = { monthlyExpenseCents: 0, annualRate: .8, fundingSource: 'assets-and-salary' }
const due = '2027-01-31', discount = (day: string) => 1.008 ** ((Date.parse(day) - Date.parse(today)) / 86400000 / 365)
const discountedSalary = ['2026-11-01', '2026-12-01', '2027-01-01'].reduce((sum, day) => sum + 1 / discount(day), 0)
const independentlyRequired = Math.ceil((90000 / discount(due) - 10000) / discountedSalary)
assert.equal(requiredIncome(journal([wish({})], 10000), compoundPlan, today).incomeCents, independentlyRequired, '0.8% effective annual compounding agrees with discounted cash-flow formula')
const lateWish = journal([wish({ date: '2040-02-29' })])
assert.equal(cashflowProjection(lateWish, plan, today, '2027-12-31').required.horizon, '2040-02-29', 'wishes outside the visible range and beyond ten years remain in income planning')
for (const bad of [{ ...plan, annualRate: NaN }, { ...plan, monthlyExpenseCents: -1 }, { ...plan, monthlyIncomeCents: .5 }, { ...plan, includeRedeemable: 'yes' }]) assert.equal(isFinancialPlan(bad), false)
console.log('Cash-flow timing, compound-income, liquidity, overlap and compatibility checks passed')
