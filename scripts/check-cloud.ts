import assert from 'node:assert/strict'
import { seedJournal } from '../src/model.ts'
import { assertJournal, isJournal } from '../src/cloud/journal-validation.ts'

assertJournal(seedJournal())
assertJournal({ schemaVersion: 1, theme: 'forest', moments: [], goals: [], funds: [] })
const mutate = (change: (journal: ReturnType<typeof seedJournal>) => void) => {
  const journal = seedJournal()
  change(journal)
  return journal
}
assert.equal(isJournal({ ...seedJournal(), schemaVersion: 2 }), false, 'unknown remote schemas must not replace local data')
assert.equal(isJournal(mutate(j => { j.moments[0].date = '2026-02-30' })), false, 'invalid calendar dates must be rejected')
assert.equal(isJournal(mutate(j => { j.goals[0].budgetCents = 12.5 })), false, 'money uses whole cents')
assert.equal(isJournal(mutate(j => { j.funds[0].principalCents = Number.MAX_SAFE_INTEGER + 1 })), false, 'unsafe integers must be rejected')
assert.equal(isJournal(mutate(j => { j.moments.push({ ...j.moments[0] }) })), false, 'duplicate records must be rejected')
assert.equal(isJournal(mutate(j => { j.funds[1].maturityDate = '2025-10-05' })), false, 'locked funds must mature after their start')
assert.equal(isJournal(mutate(j => { j.goals[0].allocatedCents = j.goals[0].budgetCents + 1 })), false, 'a goal cannot allocate more than its budget')
assert.throws(() => assertJournal(mutate(j => { j.moments[0].reflection = '感'.repeat(310_000) })), /大小限制/, 'UTF-8 size must be checked before upload')
console.log('Cloud payload checks passed: 10 boundaries. Database RLS/CAS checks run separately on the configured project.')
