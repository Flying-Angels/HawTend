// Category IDs stay stable when the user renames their labels.
export type Category = string
export interface CategoryDefinition {
  id: Category
  label: string
  color: string
  icon: string
}
export type Importance = 1 | 2 | 3
export type TextFormat = 'markdown'
export interface Moment {
  id: string
  title: string
  date: string
  category: Category
  importance: Importance
  story: string
  reflection: string
  // Absent on older records: display those strings literally until explicitly enabled.
  storyFormat?: TextFormat
  reflectionFormat?: TextFormat
}
export interface Goal {
  id: string
  title: string
  date: string
  category: Category
  budgetCents: number
  allocatedCents: number
  progress: number
  description: string
  newSavingRate?: number
}
export interface MonthlySummary { month: string; incomeCents: number; expenseCents: number; note: string }
export interface AssetAccount { id: string; name: string; kind: 'payment' | 'bank' | 'cash' | 'other' }
export type AssetType = 'cash' | 'deposit' | 'fund' | 'other'
export interface Valuation { date: string; valueCents: number; netFlowCents: number; cashIncomeCents: number; note: string }
export interface Fund {
  id: string
  name: string
  principalCents: number
  rate: number
  startDate: string
  maturityDate: string
  mode: 'simple' | 'compound'
  liquid: boolean
  accountId?: string
  assetType?: AssetType
  returnMode?: 'fixed' | 'manual'
  valuationBase?: { date: string; valueCents: number }
  valuations?: Valuation[]
}
export interface Journal {
  schemaVersion: 1
  moments: Moment[]
  goals: Goal[]
  funds: Fund[]
  theme: 'paper' | 'forest' | 'dusk'
  // Optional for compatibility with journals written before category management.
  categories?: CategoryDefinition[]
  monthlySummaries?: MonthlySummary[]
  accounts?: AssetAccount[]
}
export const categories: Record<Category, { label: string; color: string; light: string; icon: string }> = {
  life: { label: '生活', color: '#a86d48', light: '#f2e7dc', icon: 'sun' },
  growth: { label: '成长', color: '#69769c', light: '#e9ebf2', icon: 'sprout' },
  travel: { label: '远行', color: '#4f7e79', light: '#e2eeea', icon: 'mountain' },
  health: { label: '健康', color: '#967493', light: '#efe6ee', icon: 'heart' },
}
export const importanceLabels = { 1: '日常记录', 2: '重要事件', 3: '人生里程碑' }

export function defaultCategories(): CategoryDefinition[] {
  return Object.entries(categories).map(([id, { label, color, icon }]) => ({ id, label, color, icon }))
}

export function emptyJournal(theme: Journal['theme'] = 'paper'): Journal {
  return { schemaVersion: 1, theme, moments: [], goals: [], funds: [], categories: defaultCategories() }
}

// Only the untouched fixture is omitted; edited legacy journals must be preserved.
export function isUneditedSample(journal: Journal): boolean {
  const sample = seedJournal()
  return journal.schemaVersion === 1 && (['moments', 'goals', 'funds'] as const)
    .every(key => JSON.stringify(journal[key]) === JSON.stringify(sample[key]))
    && JSON.stringify(journal.categories ?? defaultCategories()) === JSON.stringify(sample.categories)
    && !journal.monthlySummaries?.length
    && !journal.accounts?.length
}

export function seedJournal(): Journal {
  return {
    schemaVersion: 1,
    theme: 'paper',
    categories: defaultCategories(),
    moments: [
      { id: 'm1', title: '搬进自己的小窝', date: '2026-03-15', category: 'life', importance: 3, story: '布置好书桌，买了一盏暖色的落地灯。窗边留给植物，也留给慢下来的自己。', reflection: '原来家的感觉，不是拥有多少东西，而是终于可以按自己的节奏生活。想把平凡的小日子，也认真收藏起来。' },
      { id: 'm2', title: '第一次跑完 5 公里', date: '2026-06-21', category: 'health', importance: 2, story: '傍晚沿河慢跑，第一次完整跑完了 5 公里。', reflection: '比速度更重要的，是我没有停下来。身体的变化慢一点也没关系。' },
      { id: 'm3', title: '山间的一次小出走', date: '2026-09-19', category: 'travel', importance: 1, story: '周末去了山里，走了一条安静的小路。', reflection: '山风吹过的时候，许多烦恼忽然变得很小。希望以后每年都给自己一点这样的时间。' },
    ],
    goals: [
      { id: 'g1', title: '去看一次极光', date: '2028-12-31', category: 'travel', budgetCents: 10000000, allocatedCents: 3000000, progress: 30, description: '给自己一段慢一点的旅程。预算暂按 10 万元规划，之后再细化交通、住宿和旅行天数。' },
      { id: 'g2', title: '留一笔安心的储蓄', date: '2027-12-31', category: 'life', budgetCents: 8000000, allocatedCents: 6000000, progress: 75, description: '为生活里的不确定留一些空间。这笔钱与旅行资金分开安排。' },
      { id: 'g3', title: '养成每周运动的习惯', date: '2027-06-30', category: 'health', budgetCents: 0, allocatedCents: 0, progress: 20, description: '每周运动三次，先从喜欢、能坚持的活动开始。进度由自己记录。' },
    ],
    funds: [
      { id: 'f1', name: '日常与未来的活期', principalCents: 20000000, rate: 1, startDate: '2026-10-05', maturityDate: '', mode: 'compound', liquid: true },
      { id: 'f2', name: '给十年后的自己', principalCents: 5000000, rate: 5, startDate: '2026-10-05', maturityDate: '2036-10-05', mode: 'compound', liquid: false },
    ],
  }
}
