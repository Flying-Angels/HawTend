import { categories as defaults, defaultCategories } from './model.ts'
import type { CategoryDefinition, Journal } from './model'

export const MAX_CATEGORIES = 32
export const categoryIcons = [
  { id: 'sun', label: '日常' }, { id: 'sprout', label: '生长' },
  { id: 'mountain', label: '山川' }, { id: 'heart', label: '心意' },
  { id: 'book', label: '手账' }, { id: 'leaf', label: '叶片' },
  { id: 'star', label: '星光' }, { id: 'wallet', label: '积蓄' },
] as const
export const categoryColors = ['#a86d48', '#69769c', '#4f7e79', '#967493', '#60734f', '#a4656d', '#8b7348', '#5d7684']
export const categoryNameKey = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase()

export function isCategoryDefinitions(value: unknown): value is CategoryDefinition[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CATEGORIES) return false
  const ids = new Set<string>(), names = new Set<string>()
  return value.every(c => {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(c.id) || c.id === 'all'
      || ids.has(c.id) || typeof c.label !== 'string' || !c.label.trim() || c.label.length > 20
      || names.has(categoryNameKey(c.label)) || typeof c.color !== 'string' || !/^#[\da-f]{6}$/i.test(c.color)
      || !categoryIcons.some(icon => icon.id === c.icon)) return false
    ids.add(c.id); names.add(categoryNameKey(c.label)); return true
  })
}

export function journalCategories(journal: Journal): CategoryDefinition[] {
  return journal.categories ?? defaultCategories()
}

// Loading old journals adds definitions in memory, without changing record IDs or writing to storage.
export function withCategories(journal: Journal): Journal {
  const categories = journalCategories(journal)
  if (!isCategoryDefinitions(categories)) throw new Error('分类设置无法读取，已保留原有手账。')
  const ids = new Set(categories.map(c => c.id))
  if ([...journal.moments, ...journal.goals].some(item => !ids.has(item.category))) {
    throw new Error('记录的分类无法读取，已保留原有手账。')
  }
  return { ...journal, categories }
}

export function categoryAppearance(category: CategoryDefinition) {
  return { ...category, light: defaults[category.id]?.color === category.color ? defaults[category.id].light : `${category.color}1f` }
}
