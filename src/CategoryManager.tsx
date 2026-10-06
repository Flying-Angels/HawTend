import { createContext, useContext, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icons'
import { categoryAppearance, categoryColors, categoryIcons, categoryNameKey, journalCategories, MAX_CATEGORIES } from './categories'
import type { CategoryDefinition, Journal } from './model'

type CategorySettings = {
  categories: CategoryDefinition[]
  counts: Map<string, number>
  busy: boolean
  save: (categories: CategoryDefinition[]) => Promise<boolean>
}
const CategoryContext = createContext<CategorySettings | null>(null)

export function CategoryProvider({ journal, busy, save, children }: { journal: Journal; busy: boolean; save: CategorySettings['save']; children: ReactNode }) {
  const counts = new Map<string, number>()
  for (const item of [...journal.moments, ...journal.goals]) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  return <CategoryContext.Provider value={{ categories: journalCategories(journal), counts, busy, save }}>{children}</CategoryContext.Provider>
}

export function useCategories() {
  const context = useContext(CategoryContext)
  if (!context) throw new Error('Category settings provider is missing.')
  return context
}

export function useCategory(id: string) {
  const { categories } = useCategories()
  return categoryAppearance(categories.find(c => c.id === id) ?? categories[0])
}

export function CategoryField({ value, change, manage, expanded, managerId }: { value: string; change: (id: string) => void; manage: () => void; expanded: boolean; managerId: string }) {
  const { categories, busy } = useCategories()
  const selectId = useId()
  useEffect(() => { if (!categories.some(c => c.id === value)) change(categories[0].id) }, [categories, value, change])
  return <div className="category-field"><div className="category-field-heading"><label htmlFor={selectId}>分类</label><button type="button" className="text-button" disabled={busy} aria-expanded={expanded} aria-controls={managerId} onClick={manage}><Icon name="settings" size={13} />{expanded ? '收起管理' : '管理分类'}</button></div><select id={selectId} value={value} onChange={e => change(e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
}

// This group can sit inside a record form; its buttons never submit or discard the record draft.
export function CategoryManager({ id, onCreated, onRemoved }: { id?: string; onCreated?: (id: string) => void; onRemoved?: (id: string, replacement: string) => void }) {
  const { categories, counts, busy, save } = useCategories()
  const [draft, setDraft] = useState<CategoryDefinition | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const nameId = useId()
  const locked = busy || pending
  const start = (category?: CategoryDefinition) => {
    setDraft(category ? { ...category } : { id: `cat-${crypto.randomUUID()}`, label: '', color: categoryColors[categories.length % categoryColors.length], icon: 'book' })
    setError('')
  }
  const submit = async () => {
    if (!draft || locked) return
    const label = draft.label.trim()
    if (!label) { setError('给这个分类起个名字吧。'); return }
    if (categories.some(c => c.id !== draft.id && categoryNameKey(c.label) === categoryNameKey(label))) { setError('已经有这个分类了，换一个名字吧。'); return }
    const exists = categories.some(c => c.id === draft.id)
    if (!exists && categories.length >= MAX_CATEGORIES) { setError(`最多可以设置 ${MAX_CATEGORIES} 个分类。`); return }
    const next = exists ? categories.map(c => c.id === draft.id ? { ...draft, label } : c) : [...categories, { ...draft, label }]
    setPending(true)
    try {
      if (await save(next)) { setDraft(null); setError(''); if (!exists) onCreated?.(draft.id) }
      else setError('分类未保存，填写的内容还在这里，请重试。')
    } finally { setPending(false) }
  }
  const remove = async (category: CategoryDefinition) => {
    if (locked || counts.get(category.id) || categories.length === 1) return
    const next = categories.filter(c => c.id !== category.id)
    setPending(true)
    try {
      if (await save(next)) { setError(''); if (draft?.id === category.id) setDraft(null); onRemoved?.(category.id, next[0].id) }
      else setError('分类未删除，请重试。')
    } finally { setPending(false) }
  }
  return <section id={id} className="category-manager" aria-label="管理分类"><div className="category-manager-heading"><div><h3>把日子分成自己的颜色</h3><p>名称、颜色和小图案，都由你来定。</p></div>{!draft && <button type="button" className="quiet-button" disabled={locked || categories.length >= MAX_CATEGORIES} onClick={() => start()}><Icon name="plus" size={15} />新增分类</button>}</div>
    <div className="category-list">{categories.map(c => <div className="category-row" key={c.id}><span className="category-symbol" style={{ color: c.color, background: categoryAppearance(c).light }}><Icon name={c.icon} size={18} /></span><div className="category-row-copy"><strong>{c.label}</strong><small>{counts.get(c.id) ?? 0} 条记录与心愿</small></div><button type="button" className="text-button" disabled={locked} aria-label={`编辑分类：${c.label}`} onClick={() => start(c)}>编辑</button><button type="button" className="icon-button category-remove" disabled={locked || !!counts.get(c.id) || categories.length === 1} aria-label={`删除分类：${c.label}`} title={counts.get(c.id) ? '已有记录使用此分类，更换记录的分类后才能删除' : categories.length === 1 ? '至少保留一个分类' : '删除未使用的分类'} onClick={() => remove(c)}><Icon name="close" size={16} /></button></div>)}</div>
    {draft && <div className="category-draft" role="group" aria-label={categories.some(c => c.id === draft.id) ? '编辑分类' : '新增分类'}><label htmlFor={nameId}>分类名称<input id={nameId} maxLength={20} value={draft.label} placeholder="比如：家人、工作、兴趣" disabled={locked} onChange={e => setDraft({ ...draft, label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit() } }} /></label><fieldset disabled={locked}><legend>分类颜色</legend><div className="category-color-options">{categoryColors.map(color => <button type="button" key={color} className={draft.color === color ? 'chosen' : ''} aria-label={`颜色 ${color}`} aria-pressed={draft.color === color} style={{ background: color }} onClick={() => setDraft({ ...draft, color })}>{draft.color === color && <Icon name="check" size={15} />}</button>)}<label className="custom-category-color" title="自由选择颜色"><Icon name="plus" size={15} /><input type="color" aria-label="自选分类颜色" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} /></label></div></fieldset><fieldset disabled={locked}><legend>小图案</legend><div className="category-icon-options">{categoryIcons.map(icon => <button type="button" key={icon.id} className={draft.icon === icon.id ? 'chosen' : ''} aria-label={`图案：${icon.label}`} aria-pressed={draft.icon === icon.id} onClick={() => setDraft({ ...draft, icon: icon.id })}><Icon name={icon.id} size={19} /></button>)}</div></fieldset><div className="category-draft-actions"><button type="button" className="text-button" disabled={locked} onClick={() => { setDraft(null); setError('') }}>取消编辑</button><button type="button" className="quiet-button" disabled={locked} onClick={() => void submit()}><Icon name="check" size={15} />{pending ? '正在保存…' : '保存分类'}</button></div></div>}
    {error && <p className="form-error" role="alert">{error}</p>}<p className="category-manager-note">已有记录使用中的分类会保留；修改名称和颜色会一起更新到时间轴。{categories.length >= MAX_CATEGORIES && `最多 ${MAX_CATEGORIES} 个分类。`}</p>
  </section>
}
