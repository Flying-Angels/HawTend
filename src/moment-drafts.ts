import type { Moment } from './model.ts'
import { isCalendarDay } from './calendar-picker.ts'

// Drafts are separate from the published journal and scoped to this local origin.
// One key per editor session also keeps two windows from overwriting each other.
export const MOMENT_DRAFT_PREFIX = 'hawtend:personal-local-v1:moment-draft:'
export interface MomentDraft { version: 1; id: string; item: Moment; base: Moment; updatedAt: string }
export interface DraftStorage { readonly length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const fields = ['id', 'title', 'date', 'category', 'importance', 'story', 'reflection', 'storyFormat', 'reflectionFormat'] as const
export const sameMoment = (a: Moment, b: Moment) => fields.every(key => a[key] === b[key])
export const matchesPublished = (a: Moment, b: Moment) => sameMoment({ ...a, title: a.title.trim() }, b)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)
function isMoment(value: unknown): value is Moment {
  if (!object(value)) return false
  return typeof value.id === 'string' && !!value.id && typeof value.title === 'string'
    && typeof value.date === 'string' && isCalendarDay(value.date) && typeof value.category === 'string' && !!value.category
    && [1, 2, 3].includes(value.importance as number) && typeof value.story === 'string' && typeof value.reflection === 'string'
    && (value.storyFormat === undefined || value.storyFormat === 'markdown') && (value.reflectionFormat === undefined || value.reflectionFormat === 'markdown')
}
export function parseMomentDraft(raw: string | null): MomentDraft | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!object(value) || value.version !== 1 || !validId(value.id) || !isMoment(value.item) || !isMoment(value.base) || value.item.id !== value.base.id
      || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null
    return value as unknown as MomentDraft
  } catch { return null }
}
export function readMomentDrafts(storage?: DraftStorage): { drafts: MomentDraft[]; unavailable: boolean; unreadable: number } {
  const drafts: MomentDraft[] = []; let unreadable = 0
  try {
    const target = storage ?? window.localStorage
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index)
      if (!key?.startsWith(MOMENT_DRAFT_PREFIX)) continue
      const draft = parseMomentDraft(target.getItem(key))
      if (draft && key === MOMENT_DRAFT_PREFIX + draft.id) drafts.push(draft)
      else unreadable++ // Keep malformed records untouched; never silently delete them.
    }
    return { drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), unavailable: false, unreadable }
  } catch { return { drafts, unavailable: true, unreadable } }
}
export function writeMomentDraft(draft: MomentDraft, storage?: DraftStorage): boolean {
  try {
    if (!parseMomentDraft(JSON.stringify(draft))) return false
    const target = storage ?? window.localStorage, key = MOMENT_DRAFT_PREFIX + draft.id
    target.setItem(key, JSON.stringify(draft))
    return true
  } catch { return false }
}
export function removeMomentDraft(id: string, storage?: DraftStorage): boolean {
  try { if (!validId(id)) return false; (storage ?? window.localStorage).removeItem(MOMENT_DRAFT_PREFIX + id); return true } catch { return false }
}
export function finishMomentDraft(id: string, published: Moment, storage?: DraftStorage): boolean {
  try {
    const target = storage ?? window.localStorage, draft = parseMomentDraft(target.getItem(MOMENT_DRAFT_PREFIX + id))
    // A character entered while the formal save was pending must survive too.
    if (!draft || !matchesPublished(draft.item, published)) return false
    return removeMomentDraft(id, target)
  } catch { return false }
}
export function downloadMomentDraft(item: Moment) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'HawTend moment draft', item }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `HawTend-草稿-${item.date}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
