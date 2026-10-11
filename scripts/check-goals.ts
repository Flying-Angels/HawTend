import assert from 'node:assert/strict'
import { seedJournal } from '../src/model.ts'
import { goalCosts, goalBudgetLabel, goalStatus, wishSaving } from '../src/goals.ts'
import { isJournal } from '../src/cloud/journal-validation.ts'

const legacy = seedJournal(), goal = legacy.goals[0]
assert.equal(isJournal(legacy), true, 'legacy wishes remain readable without adding fields')
const original = JSON.stringify(goal)
assert.equal(goalStatus(goal), 'ongoing', 'existing partial progress displays as ongoing')
assert.equal(goalStatus({ ...goal, progress: 100 }), 'done')
assert.equal(goalStatus({ ...goal, progress: 0 }), 'wish')
assert.equal(goalStatus({ ...goal, status: 'wish' }), 'wish', 'new status takes precedence over archival percentages')
assert.equal(wishSaving(goal, '2026-10-05').monthly, 370371, 'one-off estimate uses the whole cost over 27 month ends')
assert.deepEqual(wishSaving(goal, '2026-10-05'), wishSaving({ ...goal, allocatedCents: 0 }, '2026-10-05'), 'retired allocations do not reduce the forecast')
assert.equal(JSON.stringify(goal), original, 'reading wishes does not migrate or alter original data')

const mixed = { ...goal, budgetCents: 80000, monthlyBudgetCents: 30000, monthlyStartMonth: '2026-10', date: '2027-06-30', status: 'ongoing' as const }
assert.deepEqual(goalCosts(mixed), { once: 80000, monthly: 30000, months: 9, recurring: 270000, total: 350000 }, 'mixed costs include both start and end calendar months')
assert.match(goalBudgetLabel(mixed), /一次性 ¥800\.00 · 每月 ¥300\.00/, 'cards distinguish total and monthly amounts')
assert.equal(goalCosts({ ...mixed, monthlyStartMonth: '2027-06', date: '2027-06-01' }).months, 1, 'a partial month is budgeted as one month, not prorated')
assert.equal(goalCosts({ ...mixed, monthlyStartMonth: '2028-02', date: '2028-02-29' }).months, 1, 'leap-month budgeting is calendar-based')
assert.equal(wishSaving(mixed, '2026-10-05').monthly, 8889, 'only the 800 yuan one-off cost is saved over 9 months')
assert.equal(wishSaving({ ...mixed, budgetCents: 0 }, '2026-10-05').monthly, 0, 'recurring spending never becomes a savings target')
assert.equal(wishSaving({ ...mixed, newSavingRate: 5 }, '2026-10-05').monthly! < 8889, true, 'optional saving returns apply only to newly saved money')
assert.equal(wishSaving({ ...mixed, date: '2026-10-15' }, '2026-10-05').monthly, null, 'near dates cannot be divided into nonexistent month ends')

const valid = (edit: Record<string, unknown>) => isJournal({ ...legacy, goals: [{ ...mixed, ...edit }] })
assert.equal(valid({}), true)
assert.equal(valid({ budgetCents: 0 }), true, 'archived allocations may exceed a newly removed one-off budget')
assert.equal(valid({ monthlyStartMonth: '2027-07' }), false, 'start cannot be later than end')
assert.equal(valid({ monthlyStartMonth: '2026-13' }), false)
assert.equal(valid({ monthlyStartMonth: undefined }), false, 'positive monthly fees need an explicit start month')
for (const monthlyBudgetCents of [-1, .5, NaN, Infinity]) assert.equal(valid({ monthlyBudgetCents }), false, 'monthly budgets use nonnegative finite integer cents')
assert.equal(valid({ status: 'unknown' }), false)
assert.equal(valid({ monthlyBudgetCents: Number.MAX_SAFE_INTEGER }), false, 'multi-month totals must stay exact')
assert.equal(valid({ budgetCents: 0, monthlyBudgetCents: 0, monthlyStartMonth: undefined, status: 'wish' }), true, 'wishes do not require money')
const journal = { ...legacy, goals: [mixed] }
assert.equal(isJournal(JSON.parse(JSON.stringify(journal))), true, 'new budget/status fields survive JSON backup round trips')
assert.deepEqual(legacy.funds, seedJournal().funds, 'wish planning does not alter assets')
console.log('Wish budget, status and compatibility checks passed')
