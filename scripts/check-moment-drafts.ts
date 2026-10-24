import assert from 'node:assert/strict'
import type { Moment } from '../src/model.ts'
import { MOMENT_DRAFT_PREFIX, finishMomentDraft, matchesPublished, parseMomentDraft, readMomentDrafts, removeMomentDraft, writeMomentDraft } from '../src/moment-drafts.ts'
import type { DraftStorage, MomentDraft } from '../src/moment-drafts.ts'

class MemoryStorage implements DraftStorage {
  data = new Map<string, string>(); failWrite = false
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('quota exceeded'); this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}
const storage = new MemoryStorage()
const base: Moment = { id: 'fictional-day', title: '', date: '2026-10-24', category: 'life', importance: 2, story: '', reflection: '', storyFormat: 'markdown', reflectionFormat: 'markdown' }
const first: MomentDraft = { version: 1, id: 'draft-one', base, item: { ...base, title: '虚构草稿', story: '正文 **保留格式** 和 $x^2$\n最后一个字', reflection: '感想也保留。' }, updatedAt: '2026-10-24T08:00:00Z' }
assert.equal(writeMomentDraft(first, storage), true)
assert.deepEqual(readMomentDrafts(storage).drafts, [first], 'closing/reopening reads every field and the last character')
assert.equal(base.title, '', 'autosave never mutates the original moment')
assert.equal(finishMomentDraft(first.id, { ...first.item, story: '尚未写入的旧版本' }, storage), false, 'a later draft edit must not be removed by an earlier formal save')
assert.equal(readMomentDrafts(storage).drafts.length, 1)
const other = { ...first, id: 'draft-two', updatedAt: '2026-10-24T09:00:00Z' }
assert.equal(writeMomentDraft(other, storage), true)
assert.equal(readMomentDrafts(storage).drafts[0].id, other.id, 'multiple editor sessions for the same moment remain separate')
assert.equal(finishMomentDraft(first.id, first.item, storage), true)
assert.deepEqual(readMomentDrafts(storage).drafts, [other], 'publishing removes only its own matching draft')
assert.equal(matchesPublished({ ...base, title: ' 标题 ' }, { ...base, title: '标题' }), true)
storage.failWrite = true
assert.equal(writeMomentDraft({ ...other, item: { ...other.item, story: '写入失败的新内容' } }, storage), false)
assert.deepEqual(readMomentDrafts(storage).drafts, [other], 'quota failure preserves the last good persisted draft')
storage.data.set(MOMENT_DRAFT_PREFIX + 'broken', '{broken')
storage.data.set('other-app-data', 'unrelated')
assert.equal(readMomentDrafts(storage).unreadable, 1)
assert.equal(storage.data.get(MOMENT_DRAFT_PREFIX + 'broken'), '{broken', 'unreadable data is preserved for recovery')
assert.equal(readMomentDrafts(storage).drafts.length, 1, 'one damaged entry does not hide other drafts')
for (const value of [null, '{}', JSON.stringify({ ...first, version: 2 }), JSON.stringify({ ...first, item: { ...base, date: '2026-02-30' } }), JSON.stringify({ ...first, item: { ...base, id: 'different' } })]) assert.equal(parseMomentDraft(value), null)
assert.equal(removeMomentDraft('../invalid', storage), false)
assert.equal(removeMomentDraft(other.id, storage), true)
assert.equal(storage.getItem('other-app-data'), 'unrelated')
console.log('Moment drafts: exact recovery, separate sessions, successful-save cleanup, race protection, quota failure and damaged-data preservation passed')
