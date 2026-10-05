import type { Journal } from '../model'

const categories = new Set(['life', 'growth', 'travel', 'health'])
const themes = new Set(['paper', 'forest', 'dusk'])
const modes = new Set(['simple', 'compound'])
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const boundedNumber = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
const date = (value: unknown): value is string => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function records(value: unknown, valid: (row: Record<string, unknown>) => boolean): boolean {
  if (!Array.isArray(value) || value.length > 2000) return false
  const ids = new Set<string>()
  return value.every(row => {
    if (!object(row) || !text(row.id) || !row.id.trim() || ids.has(row.id) || !valid(row)) return false
    ids.add(row.id)
    return true
  })
}

// Validate remote data before a later sync coordinator is allowed to replace a local journal.
export function isJournal(value: unknown): value is Journal {
  if (!object(value) || value.schemaVersion !== 1 || !text(value.theme) || !themes.has(value.theme)) return false
  return records(value.moments, row => text(row.title) && date(row.date) && text(row.category) && categories.has(row.category)
    && [1, 2, 3].includes(row.importance as number) && text(row.story) && text(row.reflection))
    && records(value.goals, row => text(row.title) && date(row.date) && text(row.category) && categories.has(row.category)
      && money(row.budgetCents) && money(row.allocatedCents) && row.allocatedCents <= row.budgetCents
      && boundedNumber(row.progress, 100) && text(row.description))
    && records(value.funds, row => text(row.name) && money(row.principalCents) && boundedNumber(row.rate, 30)
      && date(row.startDate) && typeof row.liquid === 'boolean' && text(row.mode) && modes.has(row.mode)
      && (row.liquid ? row.maturityDate === '' : date(row.maturityDate) && row.maturityDate > row.startDate))
}

export function assertJournal(value: unknown): asserts value is Journal {
  if (!isJournal(value)) throw new Error('手账格式不受支持，已保留本地内容。')
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 900_000) {
    throw new Error('手账超出原型同步大小限制，请先导出留存。')
  }
}
