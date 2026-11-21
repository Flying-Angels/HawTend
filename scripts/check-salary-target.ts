import assert from 'node:assert/strict'
import type { Journal, FinancialPlan, Goal } from '../src/model.ts'
import { salaryTargetSummary, requiredIncome, cashflowProjection, financialDefaults, retirementScenarios, isFinancialPlan } from '../src/cashflow.ts'
const today = '2026-10-12'
const goal: Goal = { id: 'test-wish', title: '虚构旅行', date: '2027-10-31', category: 'travel', budgetCents: 6000000, allocatedCents: 0, progress: 0, status: 'wish', description: '' }
const journal: Journal = { schemaVersion: 1, theme: 'paper', moments: [], goals: [goal], funds: [] }
const zeroRate: FinancialPlan = { monthlyExpenseCents: 300000, annualRate: 0, fundingSource: 'salary-only' }
assert.equal(requiredIncome(journal, zeroRate, today).incomeCents, 800000, '60,000 yuan in 12 months plus 3,000 yuan monthly living costs requires 8,000 yuan net wage')
const assets: Journal = { ...journal, funds: [{ id: 'cash', name: '虚构存款', principalCents: 100000000, rate: 5, startDate: today, maturityDate: '', liquid: true, mode: 'compound' }, { id: 'term', name: '虚构定期', principalCents: 20000000, rate: 10, startDate: today, maturityDate: '2027-05-12', liquid: false, mode: 'compound' }] }
assert.equal(requiredIncome(assets, zeroRate, today).incomeCents, 800000, 'existing principal and maturity proceeds cannot lower the salary goal')
const manual = { ...assets, funds: assets.funds.map(f => ({ ...f, returnMode: 'manual' as const })) }
assert.equal(requiredIncome(manual, { ...zeroRate, includeRedeemable: true }, today).incomeCents, 800000, 'legacy manual-asset checkbox cannot reintroduce existing money')
assert.equal(cashflowProjection(assets, zeroRate, today, '2027-10-31').required.openingCents, 0)
assert.equal(cashflowProjection(assets, { ...zeroRate, monthlyIncomeCents: 123 }, today, '2027-10-31').monthlyIncomeCents, 800000, 'the wage is solved from budgets, never taken from a legacy self-filled income')
assert.equal(cashflowProjection(assets, zeroRate, today, '2027-10-31').rows.reduce((s, r) => s + r.maturityCents, 0), 0)
const compound = { ...zeroRate, annualRate: .8 }, target = requiredIncome(assets, compound, today)
assert.ok(target.incomeCents! < 800000 && target.incomeCents! > 795000)
assert.equal(target.incomeCents, requiredIncome(journal, compound, today).incomeCents, 'only future salary savings compound')
assert.ok(cashflowProjection(assets, compound, today, '2027-10-31').rows.every(r => r.minimumCents >= 0), 'solved wage covers all scheduled payments')
assert.equal(cashflowProjection(assets, compound, today, '2100-12-31').monthlyIncomeCents, target.incomeCents, 'visible range cannot change the salary goal')
const summary = salaryTargetSummary(assets, compound, today)
assert.deepEqual([summary.onceCents, summary.recurringCents, summary.livingCents, summary.totalCents, summary.salaryMonths], [6000000, 0, 3600000, 9600000, 12])
assert.equal(summary.required.incomeCents, summary.wishMonthlyCents! + 300000)
const mixed = { ...assets, goals: [{ ...goal, budgetCents: 1200000, monthlyBudgetCents: 100000, monthlyStartMonth: '2026-11' }] }
assert.deepEqual(salaryTargetSummary(mixed, zeroRate, today).rows.map(r => [r.onceCents, r.recurringCents, r.months]), [[1200000, 1200000, 12]])
assert.equal(requiredIncome(mixed, zeroRate, today).incomeCents, 500000)
assert.equal(requiredIncome(mixed, { ...zeroRate, includedMonthlyGoalIds: [goal.id] }, today).incomeCents, 400000)
const earlier = { ...journal, goals: [{ ...goal, date: '2026-11-20', budgetCents: 1000000 }, { ...goal, id: 'later', date: '2027-10-31', budgetCents: 1200000 }] }
assert.equal(requiredIncome(earlier, zeroRate, today).incomeCents, 1300000, 'first wish can bind the required salary before the final deadline')
assert.equal(requiredIncome({ ...assets, goals: [{ ...goal, date: '2026-10-20' }] }, zeroRate, today).incomeCents, null, 'next wage cannot pay a current-month wish even with excluded assets')
assert.equal(financialDefaults({ ...assets, financialPlan: { ...zeroRate, fundingSource: 'assets-and-salary' } }, today).fundingSource, 'salary-only')
const copy = JSON.stringify(assets); salaryTargetSummary(assets, compound, today); assert.equal(JSON.stringify(assets), copy)
console.log('Wish budgets reverse to monthly wages; existing assets and returns excluded; trace, timing and compounding checks passed')

const earlyRetirement = { ...zeroRate, retirementYear: 2026 }
const early = requiredIncome(journal, earlyRetirement, today)
assert.equal(early.incomeCents, 4_800_000, 'two future wages fund the same twelve months of living costs and the 60,000 yuan wish')
assert.equal(early.salaryMonths, 2)
assert.equal(early.salaryEnd, '2026-12-31')
assert.equal(early.horizon, '2027-10-31', 'retirement never truncates the expense budget')
const retiredProjection = cashflowProjection(journal, earlyRetirement, today, '2028-12-31')
assert.ok(retiredProjection.rows.filter(row => row.month > '2026-12').every(row => row.incomeCents === 0), 'wages stop in both the budget and the extended timeline')
assert.equal(retiredProjection.rows.find(row => row.month === '2027-10')!.wishExpenseCents, 6_000_000)
assert.ok(retiredProjection.rows.filter(row => row.date <= early.horizon).every(row => row.minimumCents >= 0))
assert.equal(requiredIncome(assets, earlyRetirement, today).incomeCents, early.incomeCents)
assert.equal(requiredIncome(journal, { ...earlyRetirement, expenseThroughYear: 2028 }, today).incomeCents, 6_900_000, 'an extended living-cost budget is funded before retirement')
assert.equal(requiredIncome(journal, { ...zeroRate, expenseThroughYear: 2030 }, today).incomeCents, 800000, 'extra working years cannot delay an earlier wish payment')
assert.equal(requiredIncome(journal, { ...earlyRetirement, retirementYear: 2025 }, today).incomeCents, null, 'no future wage cannot pay future costs')
const scenarios = retirementScenarios(journal, compound, today)
assert.equal(scenarios[0].incomeCents, requiredIncome(journal, { ...compound, retirementYear: 2026 }, today).incomeCents)
assert.equal(scenarios.at(-1)!.incomeCents, target.incomeCents)
assert.ok(scenarios.every((row, index) => index === 0 || row.incomeCents! <= scenarios[index - 1].incomeCents!), 'later retirement cannot require a larger fixed wage for the same budget')
const retireSummary = salaryTargetSummary(journal, earlyRetirement, today)
assert.equal(retireSummary.livingMonthlyCents, 1_800_000)
assert.equal(retireSummary.wishMonthlyCents! + retireSummary.livingMonthlyCents!, early.incomeCents)
const discount = (day: string) => 1.008 ** ((Date.parse(day) - Date.parse(today)) / 86400000 / 365)
const pvWages = 1 / discount('2026-11-01') + 1 / discount('2026-12-01')
const costDates = cashflowProjection(journal, compound, today, '2027-10-31').rows.filter(row => row.month > today.slice(0, 7)).map(row => row.month + '-01')
const pvLiving = costDates.reduce((sum, day) => sum + 300000 / discount(day), 0)
assert.equal(requiredIncome(journal, { ...compound, retirementYear: 2026 }, today).incomeCents, Math.ceil((pvLiving + 6000000 / discount(goal.date)) / pvWages), 'retirement salary agrees with independent discounted cash-flow calculation')
for (const invalid of ['2040', NaN, 2201, 2030.5]) assert.equal(isFinancialPlan({ ...zeroRate, retirementYear: invalid }), false)
assert.equal(isFinancialPlan({ ...earlyRetirement, expenseThroughYear: 2087 }), true)
console.log('Retirement salary, persistent post-retirement costs, timeline cutoff, year comparison, discounted cash flow and legacy plan checks passed')
