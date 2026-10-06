import assert from 'node:assert/strict'
import { seedJournal } from '../src/model.ts'
import { assertJournal, isJournal } from '../src/cloud/journal-validation.ts'
import { isUneditedSample } from '../src/model.ts'
import { withCategories } from '../src/categories.ts'

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
const legacy = seedJournal()
delete legacy.categories
assertJournal(legacy)
assert.equal(isUneditedSample(legacy), true, 'old untouched samples must still be recognized')
assert.deepEqual(withCategories(legacy).moments, legacy.moments, 'adding category definitions must preserve records')
assert.equal(legacy.categories, undefined, 'reading old definitions must not mutate the original journal')
const personalCategories = seedJournal()
personalCategories.categories![0].label = '家人与生活'
assert.equal(isUneditedSample(personalCategories), false, 'category-only edits must keep a legacy journal personal')
const custom = seedJournal()
custom.categories!.push({ id: 'cat-work', label: '工作', color: '#5d7684', icon: 'book' })
custom.moments[0].category = 'cat-work'
custom.goals[0].category = 'cat-work'
assertJournal(custom)
assert.equal(isJournal({ ...custom, categories: custom.categories!.filter(c => c.id !== 'cat-work') }), false, 'dangling category IDs must be rejected')
assert.throws(() => withCategories({ ...custom, categories: custom.categories!.filter(c => c.id !== 'cat-work') }), /分类/, 'local writes must also reject dangling category IDs')
assert.equal(isJournal(mutate(j => { j.categories!.push({ ...j.categories![0], label: '重复 ID' }) })), false, 'duplicate category IDs must be rejected')
assert.equal(isJournal(mutate(j => { j.categories![1].label = '生活 ' })), false, 'duplicate category names must be rejected')
assert.equal(isJournal(mutate(j => { j.categories![0].color = 'url(example)' })), false, 'category colors must be plain hex values')
assert.equal(isJournal(mutate(j => { j.categories = [] })), false, 'at least one category must remain')
console.log('Journal payload checks passed, including legacy records, custom categories and reference integrity. Database RLS/CAS checks run separately on the configured project.')
