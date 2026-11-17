import assert from 'node:assert/strict'
import { applyAccountUpdate, balanceComparison, bookkeepingDue, bookkeepingDays, isAccountSettlements, isAccountSnapshots, recordedIntervalGains, settlementExpense } from '../src/account-ledger.ts'
import { homeTimelineDates } from '../src/timeline-range.ts'
import { isJournal } from '../src/cloud/journal-validation.ts'
import type { Fund, Journal } from '../src/model.ts'

const today = '2026-11-17', from = '2026-10-23'
const asset = (id: string, accountId: string, principalCents: number): Fund => ({ id, name: id, accountId, principalCents, startDate: from, rate: 0, liquid: true, mode: 'compound', maturityDate: '' })
const a = asset('现金 A', 'a', 6_000_000), b = asset('现金 B', 'b', 4_000_000)
const initial: Journal = { schemaVersion: 1, theme: 'paper', moments: [], goals: [], funds: [a, b], accounts: [{ id: 'a', name: '银行甲', kind: 'bank' }, { id: 'b', name: '银行乙', kind: 'bank' }], monthlySummaries: [{ month: '2026-10', incomeCents: 10_000, expenseCents: 5_000, note: '历史' }] }
const historical = applyAccountUpdate(applyAccountUpdate(initial, { accountId: 'a', date: from, balanceCents: a.principalCents }, today), { accountId: 'b', date: from, balanceCents: b.principalCents }, today)
const edit = (journal: Journal, fund: Fund, balanceCents: number) => applyAccountUpdate(journal, { accountId: fund.accountId!, date: today, newCashId: 'unused', assets: [{ id: fund.id, balanceCents, netFlowCents: 0, distributionCents: 0 }] }, today)
const partial = edit(historical, a, 5_620_000)
assert.equal(partial.funds[0].principalCents, 5_620_000)
assert.equal(partial.funds[1], b, 'other accounts are not touched when saving one')
assert.deepEqual(balanceComparison(partial, from, today).missingClosing, ['银行乙'])
assert.equal(balanceComparison(partial, from, today).ready, false)
const full = edit(partial, b, 5_000_000)
const comparison = balanceComparison(full, from, today)
assert.equal(comparison.ready, true)
assert.equal(settlementExpense({ from, to: today, ...comparison, incomeCents: 1_000_000, gainCents: 20_000, openingDebtCents: 0, closingDebtCents: 0 }), 400_000)
assert.equal(settlementExpense({ from, to: today, ...comparison, incomeCents: 1_000_000, gainCents: 20_000, openingDebtCents: 15_000, closingDebtCents: 25_000 }), 410_000, 'net asset comparison accounts for new debt')
assert.equal(full.monthlySummaries, initial.monthlySummaries, 'new balance and interval tracking keep old monthly entries')
const correction = edit(full, a, 5_600_000)
assert.equal(correction.accountSnapshots!.length, full.accountSnapshots!.length, 'same date replaces rather than adding')
const backfill = applyAccountUpdate(correction, { accountId: 'a', date: from, balanceCents: 6_123_456 }, today)
assert.equal(backfill.funds, correction.funds, 'backfill must not change current assets')
assert.throws(() => applyAccountUpdate(correction, { accountId: 'a', date: from, newCashId: 'unused', assets: [{ id: a.id, balanceCents: a.principalCents, netFlowCents: 0, distributionCents: 0 }] }, today), /更新的记录/)
assert.throws(() => applyAccountUpdate(full, { accountId: 'b', date: '2026-11-18', balanceCents: 100 }, today), /不晚于今天/)
const manual: Fund = { ...asset('基金', 'a', 120_000), assetType: 'fund', returnMode: 'manual', valuationBase: { date: from, valueCents: 100_000 }, startDate: today, valuations: [{ date: today, valueCents: 120_000, netFlowCents: 30_000, cashIncomeCents: 2_000, note: '' }] }
assert.deepEqual(recordedIntervalGains([manual], from, today), { gainCents: -8_000, count: 1 })
assert.deepEqual(recordedIntervalGains([manual], '2026-10-22', today), { gainCents: 0, count: 0 }, 'do not apply a spanning gain as if it were exact')
const locked = { ...b, liquid: false, maturityDate: '2026-11-01' }
assert.throws(() => edit({ ...initial, funds: [a, locked] }, locked, 0), /已到期/)
const archived = { ...historical, accounts: [initial.accounts![0]], funds: [a] }
assert.ok(balanceComparison(archived, '2026-11-01', today).missingClosing.includes('银行乙'), 'archiving does not silently drop prior balances from comparison')
assert.equal(isJournal(full), true)
assert.equal(isAccountSnapshots([...full.accountSnapshots!, full.accountSnapshots![0]]), false)
assert.equal(isAccountSettlements([{ from, to: today, ...comparison, incomeCents: 0, gainCents: 0, openingDebtCents: 0, closingDebtCents: 0 }]), false)
assert.equal(bookkeepingDays(from, today), 25)
assert.equal(bookkeepingDue('2026-10-24', today), false)
assert.equal(bookkeepingDue(from, today), true)
assert.equal(bookkeepingDue(undefined, today), false)
assert.equal(bookkeepingDue('2026-12-08', '2027-01-02'), true)
assert.deepEqual(homeTimelineDates(today), { first: '2026-09-17', last: '2026-12-17' })
assert.deepEqual(homeTimelineDates('2024-01-31'), { first: '2023-11-30', last: '2024-02-29' })
console.log('Account ledger checks passed: isolated writes, complete date boundaries, gain/debt handling, legacy compatibility, 25-day reminder, and rolling home dates')
