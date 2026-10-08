import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { BrandMark, Icon, Landscape } from './Icons'
import { emptyJournal, importanceLabels } from './model'
import type { Category, CategoryDefinition, AssetAccount, Fund, Goal, Importance, Journal, Moment, MonthlySummary } from './model'
import { CategoryField, CategoryManager, CategoryProvider, useCategories, useCategory } from './CategoryManager'
import { categoryAppearance, isCategoryDefinitions, journalCategories, withCategories } from './categories'
import { cents, exactYuan, futureValue, monthlySaving, monthsUntil, yuan } from './finance'
import { readJournal, writeJournal } from './storage'
import { MAX_TIMELINE_MONTH, MIN_TIMELINE_MONTH, centeredTimelineRange, lastTimelineMonth, monthAt, monthIndex, monthsForZoom, timelineBounds, timelineMarks, timelinePeriodLabel, timelineRange, timelineSpanLabel, zoomForMonths } from './timeline-range'
import type { TimelineRange } from './timeline-range'
import { MonthRangeEditor } from './MonthRangeEditor'
import { localDay, welcomeDay, yearsAfter } from './calendar'
import { useToday } from './useToday'
import { RichText } from './RichText'
import { RichTextEditor } from './RichTextEditor'
import { MonthlyLedger } from './MonthlyLedger'
import { previousMonth } from './monthly'
import { FundsPage } from './FundsPage'
import { assetSample } from './asset-demo'
import { DesktopContinuity, desktopTheme, isDesktop } from './DesktopContinuity'
import { FundEditor, ValuationEditor } from './FundEditor'
import { availableForPlanning, isAssetAccounts, manualValue, planningRate } from './assets'

const dateLabel = (date: string) => date.replaceAll('-', '.')
const navItems = [{ id: 'home', label: '我的手账', short: '手账', icon: 'home' }, { id: 'timeline', label: '人生时间轴', short: '时间轴', icon: 'timeline' }, { id: 'goals', label: '心愿与目标', short: '心愿', icon: 'flag' }, { id: 'funds', label: '资金安排', short: '资金', icon: 'wallet' }] as const
type Page = typeof navItems[number]['id']
type Panel = { type: 'moment'; item: Moment; fresh?: boolean } | { type: 'goal'; item: Goal; fresh?: boolean } | { type: 'fund'; item: Fund; fresh?: boolean } | { type: 'valuation'; item: Fund } | { type: 'settings' } | { type: 'new' }
  | { type: 'cluster'; items: { kind: 'moment' | 'goal'; item: Moment | Goal }[] }
type Status = 'loading' | 'saved' | 'saving' | 'failed'

function CategoryTag({ category }: { category: Category }) {
  const c = useCategory(category)
  return <span className="category-tag" title={c.label} style={{ '--category': c.color, '--category-light': c.light } as CSSProperties}><Icon name={c.icon} size={14} /><span>{c.label}</span></span>
}

function Modal({ title, subtitle, children, close }: { title: string; subtitle?: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const container = ref.current!
    const focusable = () => [...container.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0)
    focusable()[0]?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; previous?.focus() }
  }, [close])
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) close() }}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-header"><div><span className="eyebrow">HAWTEND / MY JOURNAL</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭详情" onClick={close}><Icon name="close" /></button></div>
    {children}
  </div></div>
}

function TimelineRangeEditor({ range, apply, close }: { range: TimelineRange; apply: (range: TimelineRange) => void; close: () => void }) {
  return <Modal title="想看哪一段日子？" subtitle="选一段时间，把走过的路和未来的期待放在一起。" close={close}>
    <MonthRangeEditor range={range} apply={apply} close={close} />
  </Modal>
}

function Timeline({ journal, compact = false, open }: { journal: Journal; compact?: boolean; open: (panel: Panel) => void }) {
  const today = useToday()
  const { categories } = useCategories()
  const [filter, setFilter] = useState<Category | 'all'>('all')
  useEffect(() => { if (filter !== 'all' && !categories.some(c => c.id === filter)) setFilter('all') }, [categories, filter])
  const [onlyImportant, setOnlyImportant] = useState(false)
  const [range, setRange] = useState<TimelineRange>(() => timelineRange(`${today.slice(0, 4)}-01`, 36))
  const [zoom, setZoom] = useState(50)
  const [editingRange, setEditingRange] = useState(false)
  const closeRange = useCallback(() => setEditingRange(false), [])
  const [curve, setCurve] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const scrollTarget = useRef<string | null>(null)
  const pan = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const items = [
    ...journal.moments.map(m => ({ kind: 'moment' as const, item: m })),
    ...journal.goals.map(g => ({ kind: 'goal' as const, item: g })),
  ].filter(({ kind, item }) => (filter === 'all' || item.category === filter) && (!onlyImportant || kind === 'goal' || (item as Moment).importance >= 2)).sort((a, b) => a.item.date.localeCompare(b.item.date))
  const width = compact ? Math.max(1060, items.length * 188 + 260) : 1900
  const { start, end } = timelineBounds(range)
  const position = (date: string) => 64 + (Date.parse(date) - start) / (end - start) * (width - 252)
  const visibleItems = compact ? items : items.filter(({ item }) => Date.parse(item.date) >= start && Date.parse(item.date) < end)
  const groups: (typeof items)[] = []
  visibleItems.forEach(entry => {
    const group = groups[groups.length - 1]
    // A cluster must never mix yesterday, today and the future across the present marker.
    const side = (date: string) => date < today ? -1 : date > today ? 1 : 0
    if (group && side(entry.item.date) === side(group[0].item.date) && (compact ? entry.item.date === group[0].item.date : position(entry.item.date) - position(group[0].item.date) < 90)) group.push(entry)
    else groups.push([entry])
  })
  const todayX = compact ? 64 + groups.filter(group => group[0].item.date < today).length * 188 + 46 : position(today)
  useLayoutEffect(() => {
    if (!scroll.current || !scrollTarget.current) return
    const target = scrollTarget.current
    scrollTarget.current = null
    scroll.current.scrollTo({ left: target === 'start' ? 0 : Math.max(0, position(target) - scroll.current.clientWidth * .4), behavior: 'instant' })
  }, [range, todayX])
  const changeRange = (next: TimelineRange) => { scrollTarget.current = 'start'; setRange(next); setZoom(zoomForMonths(next.months)) }
  const returnToday = () => { scrollTarget.current = today; setRange(centeredTimelineRange(today, range.months)) }
  const zoomRange = (value: number) => {
    setZoom(value)
    const months = monthsForZoom(value)
    if (months === range.months) return
    const viewport = scroll.current
    const todayVisible = todayX >= (viewport?.scrollLeft ?? 0) && todayX <= (viewport?.scrollLeft ?? 0) + (viewport?.clientWidth ?? width)
    const focusX = Math.max(64, Math.min(width - 188, (viewport?.scrollLeft ?? 0) + (viewport?.clientWidth ?? width) / 2))
    const focusDay = todayVisible ? today : new Date(start + (focusX - 64) / (width - 252) * (end - start)).toISOString().slice(0, 10)
    scrollTarget.current = focusDay
    setRange(centeredTimelineRange(focusDay, months))
  }
  const spanLabel = timelineSpanLabel(range.months)
  const isEmpty = visibleItems.length === 0
  return <section className={`timeline-section ${compact ? 'compact' : 'expanded'}${isEmpty ? ' is-empty' : ''}`}>
    <div className="section-heading"><div><span className="eyebrow">THE DAYS THAT MAKE YOU</span><h2>{compact ? '一路走来，也一路向前' : '每一个节点，都是你的一部分'}</h2></div>{compact ? <button className="text-button" onClick={() => { window.dispatchEvent(new Event('open-timeline')) }}>展开时间轴<Icon name="arrow" size={16} /></button> : <button className="quiet-button" onClick={returnToday}><Icon name="sun" size={16} />回到今天</button>}</div>
    <div className="timeline-toolbar"><div className="filter-group" aria-label="时间轴分类"><button className={`filter-chip ${filter === 'all' ? 'selected' : ''}`} onClick={() => setFilter('all')}>全部</button>{categories.map(c => <button key={c.id} className={`filter-chip ${filter === c.id ? 'selected' : ''}`} onClick={() => setFilter(c.id)}><span className="color-dot" style={{ background: c.color }} />{c.label}</button>)}</div>{!compact && <label className="checkbox-label"><input type="checkbox" checked={onlyImportant} onChange={e => setOnlyImportant(e.target.checked)} />只看重要节点</label>}</div>
    {!compact && <div className="range-toolbar">
      <div className="range-controls">
        <button className="icon-button" aria-label="上一段时间" title={`向前查看 ${spanLabel}`} disabled={range.startMonth === MIN_TIMELINE_MONTH} onClick={() => changeRange(timelineRange(monthAt(monthIndex(range.startMonth) - range.months), range.months))}><Icon name="chevron" className="reverse" size={17} /></button>
        <button className="range-period" title="设置起止月份" aria-label={`设置时间范围，${range.startMonth} 至 ${lastTimelineMonth(range)}，共 ${spanLabel}`} onClick={() => setEditingRange(true)}><span>{timelinePeriodLabel(range)}</span><Icon name="chevron" className="range-chevron" size={12} /></button>
        <button className="icon-button" aria-label="下一段时间" title={`向后查看 ${spanLabel}`} disabled={lastTimelineMonth(range) === MAX_TIMELINE_MONTH} onClick={() => changeRange(timelineRange(monthAt(monthIndex(range.startMonth) + range.months), range.months))}><Icon name="chevron" size={17} /></button>
      </div>
      <label className="zoom-label"><span>跨度</span><span className="zoom-scale">
        <input aria-label="时间跨度" aria-valuetext={spanLabel} type="range" min="0" max="100" step="0.1" value={zoom} onChange={e => zoomRange(Number(e.target.value))} />
        <span className="zoom-landmarks" aria-hidden="true"><span>1个月</span><span>3年</span><span>100年</span></span>
      </span><output>{spanLabel}</output></label>
      <button className={`quiet-button ${curve ? 'active' : ''}`} aria-pressed={curve} onClick={() => setCurve(!curve)}><Icon name="wallet" size={16} />资金轨迹</button>
    </div>}
    {isEmpty && <div className="timeline-empty" role="status"><Icon name="leaf" size={28} /><div><p>这段时间还没有节点</p><span>换个分类，或写下一个值得记住的日子。</span></div></div>}
    <div ref={scroll} className="timeline-scroll" tabIndex={0} role="region" aria-label="可横向拖动的人生时间轴" onKeyDown={e => { if (e.target === e.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); scroll.current!.scrollLeft += e.key === 'ArrowLeft' ? -180 : 180 } }}
      onPointerDown={e => { if (e.pointerType !== 'mouse' || (e.target as HTMLElement).closest('button')) return; pan.current = { x: e.clientX, left: scroll.current!.scrollLeft, moved: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (!pan.current) return; const delta = e.clientX - pan.current.x; if (Math.abs(delta) > 4) pan.current.moved = true; scroll.current!.scrollLeft = pan.current.left - delta }}
      onPointerUp={() => { pan.current = null }} onPointerCancel={() => { pan.current = null }}>
      <div className="timeline-canvas" style={{ width }}>
        <div className="axis-line" />
        <span className="axis-origin">过去</span><span className="axis-future">未来 <Icon name="arrow" size={16} /></span>
        {!compact && timelineMarks(range, width - 252).map(mark => <span className="year-mark" key={mark.date} style={{ left: position(mark.date) }}>{mark.label}</span>)}
        {todayX >= 0 && todayX <= width && <div className="today-marker" data-date={today} style={{ left: todayX }}><span>今天 · {today.slice(5).replace('-', '.')}</span><i /></div>}
        {groups.map((group, index) => {
          const { kind, item } = group[0]
          const x = compact ? item.date === today ? todayX : 64 + index * 188 + (item.date > today ? 92 : 0) : position(item.date)
          // Move the whole hit area with the card, keeping its dot fixed on the date.
          // Nearby past/future cards sit on their own side of the present marker.
          const cardLeft = item.date < today && x > 170 && x + 143 > todayX ? -143 : item.date > today && x - 20 < todayX ? 20 : 0
          const nodeStyle = { left: x - 20 + cardLeft, '--node-anchor': `${20 - cardLeft}px` } as CSSProperties
          const lane = index % 2
          const c = categoryAppearance(categories.find(c => c.id === item.category) ?? categories[0])
          if (group.length > 1) return <button key={`cluster-${item.id}`} data-date={item.date} className={`timeline-node cluster lane-${lane}`} style={{ ...nodeStyle, '--category': '#777e68', '--category-light': '#e9ebdf' } as CSSProperties} onClick={() => open({ type: 'cluster', items: group })}><span className="node-stem" /><span className="node-dot" /><span className="node-card"><span className="node-meta">{dateLabel(item.date)}<span>聚合节点</span></span><strong>这段日子的 {group.length} 个节点</strong><span className="node-category"><Icon name="book" size={13} />点击展开 · 保留各自日期</span></span></button>
          return <button key={item.id} data-date={item.date} className={`timeline-node lane-${lane} ${kind} importance-${kind === 'moment' ? (item as Moment).importance : 2}`} style={{ ...nodeStyle, '--category': c.color, '--category-light': c.light } as CSSProperties} onClick={() => open(kind === 'moment' ? { type: 'moment', item: item as Moment } : { type: 'goal', item: item as Goal })}>
            <span className="node-stem" /><span className="node-dot">{kind === 'goal' ? <Icon name="flag" size={11} /> : (item as Moment).importance === 3 ? <Icon name="star" size={11} /> : null}</span>
            <span className="node-card"><span className="node-meta">{dateLabel(item.date)}<span>{kind === 'goal' ? '计划' : importanceLabels[(item as Moment).importance]}</span></span><strong>{item.title}</strong><span className="node-category"><Icon name={c.icon} size={13} /><span className="node-category-name" title={c.label}>{c.label}</span>{kind === 'goal' && (item as Goal).budgetCents > 0 && <span className="node-amount">¥{yuan((item as Goal).budgetCents)}</span>}</span></span>
          </button>
        })}
      </div>
    </div>
    <div className="timeline-caption"><span><span className="legend-dot solid" />已发生 <span className="legend-dot dashed" />未来计划</span><span>{compact ? '节点概览 · 间距不代表时长' : '左右拖动浏览 · 点击查看详情'}</span></div>
    {curve && <FinanceCurve funds={journal.funds} />}
    {editingRange && <TimelineRangeEditor range={range} apply={next => { changeRange(next); closeRange() }} close={closeRange} />}
  </section>
}

function FinanceCurve({ funds }: { funds: Fund[] }) {
  const today = useToday()
  if (!funds.length) return <div className="blank-card"><Icon name="sprout" size={32} /><h2>先放好你的第一笔积蓄</h2><p>添加资金后，这里会画出它慢慢生长的轨迹。</p></div>
  const fixed = funds.filter(f => !manualValue(f))
  if (!fixed.length) return <div className="manual-forecast-note"><Icon name="leaf" size={24} /><div><strong>市值由你更新，未来先留白。</strong><p>这些资产采用手动记录，不套用固定年化，也不把当前市值画成未来十年的收益预测。</p></div></div>
  const dates = Array.from({ length: 11 }, (_, i) => yearsAfter(today, i))
  const balances = dates.map(d => fixed.reduce((sum, f) => sum + futureValue(f, d), 0))
  const available = dates.map(d => fixed.filter(f => f.liquid || (f.maturityDate && f.maturityDate <= d)).reduce((sum, f) => sum + futureValue(f, d), 0))
  const max = Math.max(1, ...balances) * 1.1
  const points = (values: number[]) => values.map((v, i) => `${50 + i * 66},${168 - v / max * 136}`).join(' ')
  return <div className="finance-curve"><div><h3>固定年化资产的十年试算</h3><p>规划假设 · 未纳入手动市值资产、目标支出与新增储蓄</p></div><svg viewBox="0 0 760 206" role="img" aria-label={`${today.slice(0, 4)}至${dates[10].slice(0, 4)}年的预测总资产与可用余额曲线`}><path d="M50 30V168H710" fill="none" stroke="var(--line)" />{[0, 5, 10].map((y, i) => <text key={y} x={50 + i * 330} y={193}>{dates[y].slice(0, 4)}</text>)}<text x="50" y="18">余额 / 元</text><text x="600" y="18">¥{yuan(balances[10])}</text><polyline points={points(balances)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="7 5" /><polyline points={points(available)} fill="none" stroke="#b48352" strokeWidth="2.5" strokeDasharray="3 4" /></svg><div className="curve-legend"><span><i />预计总资产</span><span><i />预计可用余额</span><span>定期到期后计入可用余额</span></div><p className="fine-print">预测仅包含固定年化资产，按实际到期日期释放可用余额；手动市值资产未纳入，收益不代表真实到账。</p></div>
}

function GoalCard({ goal, open }: { goal: Goal; open: (panel: Panel) => void }) {
  const c = useCategory(goal.category)
  return <button className="goal-card" onClick={() => open({ type: 'goal', item: goal })} style={{ '--category': c.color, '--category-light': c.light } as CSSProperties}>
    <span className="goal-icon"><Icon name={c.icon} size={24} /></span><span className="goal-copy"><span className="goal-card-top"><strong>{goal.title}</strong><span>{goal.progress}%</span></span><span className="goal-date">{goal.date.slice(0, 4)} 年 {Number(goal.date.slice(5, 7))} 月 · {goal.budgetCents ? `预算 ¥${yuan(goal.budgetCents)}` : '让习惯慢慢发生'}</span><span className="progress-track"><i style={{ width: `${goal.progress}%` }} /></span></span><Icon name="chevron" size={16} />
  </button>
}

function MomentForm({ item, fresh, save, sample = false }: { item: Moment; fresh?: boolean; save: (item: Moment) => Promise<boolean>; sample?: boolean }) {
  const today = useToday()
  const [draft, setDraft] = useState(item)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [manageCategories, setManageCategories] = useState(false)
  const managerId = useId()
  const { busy } = useCategories()
  const changedDate = !fresh && draft.date !== item.date
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.title.trim()) { setError('给这一天写个标题吧。'); return }
    if (draft.date > localDay()) { setError('大事记记录已发生的日子，未来的事情请添加为目标。'); return }
    if (changedDate && !preview) { setPreview(true); return }
    setPending(true)
    const ok = await save({ ...draft, title: draft.title.trim() })
    setPending(false)
    if (!ok) setError('保存未完成。文字还在这里，请重试或复制留存。')
  }
  return <form className="editor" onSubmit={submit}><div className="detail-tags"><CategoryTag category={draft.category} /><span className="importance-tag"><Icon name={draft.importance === 3 ? 'star' : 'sun'} size={14} />{importanceLabels[draft.importance]}</span></div>
    <label>这一天的标题<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="有什么值得记住？" /></label>
    <div className="form-grid"><label>发生日期<input required type="date" max={today} value={draft.date} onChange={e => { setDraft({ ...draft, date: e.target.value }); setPreview(false) }} /></label><CategoryField value={draft.category} change={category => setDraft(current => ({ ...current, category }))} manage={() => setManageCategories(!manageCategories)} expanded={manageCategories} managerId={managerId} /></div>
    {manageCategories && <CategoryManager id={managerId} onCreated={category => setDraft(current => ({ ...current, category }))} />}
    <label>对我有多重要<select value={draft.importance} onChange={e => setDraft({ ...draft, importance: Number(e.target.value) as Importance })}>{Object.entries(importanceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <RichTextEditor label="发生了什么" value={draft.story} format={draft.storyFormat} change={(story, storyFormat) => setDraft(current => ({ ...current, story, storyFormat }))} placeholder="记录事情本身，几句话就好。" />
    <div className="reflection-field"><RichTextEditor label="留给自己的话" note="感想 · 可稍后补写" value={draft.reflection} format={draft.reflectionFormat} change={(reflection, reflectionFormat) => setDraft(current => ({ ...current, reflection, reflectionFormat }))} placeholder="当时的心情、后来想通的事，都可以留在这里。" /></div>
    {preview && <div className="notice">日期将从 {dateLabel(item.date)} 改为 {dateLabel(draft.date)}，节点位置随之更新。感想与资金安排不会改变；保存后可撤销。</div>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>{sample ? '样例体验 · 不写入个人手账' : '仅保存到本机'}</span><button className="primary-button" disabled={pending || busy} type="submit"><Icon name="check" size={17} />{pending ? '正在保存…' : changedDate && !preview ? '预览日期调整' : preview ? '确认调整并保存' : '收进手账'}</button></div>
  </form>
}

function GoalForm({ item, fresh, journal, save, sample = false }: { item: Goal; fresh?: boolean; journal: Journal; save: (item: Goal) => Promise<boolean>; sample?: boolean }) {
  const today = useToday()
  const [draft, setDraft] = useState(item)
  const [expense, setExpense] = useState(() => String((journal.monthlySummaries?.find(s => s.month === previousMonth(today))?.expenseCents ?? (sample ? 800000 : 0)) / 100))
  const [obligation, setObligation] = useState(sample ? '2000' : '0')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState(false)
  const [manageCategories, setManageCategories] = useState(false)
  const managerId = useId()
  const { busy } = useCategories()
  const liquidFunds = journal.funds.filter(f => availableForPlanning(f, today))
  const liquidAmount = liquidFunds.reduce((sum, f) => sum + f.principalCents, 0)
  const available = Math.max(0, liquidAmount - journal.goals.filter(g => g.id !== draft.id).reduce((sum, g) => sum + g.allocatedCents, 0))
  const weightedRate = liquidAmount ? liquidFunds.reduce((sum, f) => sum + f.principalCents * planningRate(f), 0) / liquidAmount : 0
  const months = monthsUntil(today, draft.date)
  const forecast = monthlySaving(draft.budgetCents, draft.allocatedCents, draft.newSavingRate ?? 0, months, weightedRate)
  const changedDate = !fresh && draft.date !== item.date
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.title.trim()) { setError('请填写目标名称。'); return }
    if ((fresh || changedDate) && draft.date < localDay()) { setError('目标日期不能早于今天。'); return }
    if (draft.allocatedCents > available) { setError(`扣除其他目标后，最多可分配 ¥${exactYuan(Math.max(0, available))}。`); return }
    if (draft.allocatedCents > draft.budgetCents) { setError('当前分配不能超过目标预算。'); return }
    if (changedDate && !preview) { setPreview(true); return }
    setPending(true); const ok = await save({ ...draft, title: draft.title.trim() }); setPending(false)
    if (!ok) setError('保存未完成，请重试。')
  }
  return <form className="editor" onSubmit={submit}><label>我想完成的事<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><div className="form-grid"><label>希望完成的日期<input required type="date" min={fresh || changedDate ? today : undefined} max="2100-12-31" value={draft.date} onChange={e => { setDraft({ ...draft, date: e.target.value }); setPreview(false) }} /></label><CategoryField value={draft.category} change={category => setDraft(current => ({ ...current, category }))} manage={() => setManageCategories(!manageCategories)} expanded={manageCategories} managerId={managerId} /></div>
    {manageCategories && <CategoryManager id={managerId} onCreated={category => setDraft(current => ({ ...current, category }))} />}
    <label>为什么想做这件事<textarea rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
    <div className="form-grid"><label>预计需要 / 元<input type="number" min="0" max="100000000" step=".01" value={draft.budgetCents / 100} onChange={e => setDraft({ ...draft, budgetCents: cents(e.target.value) })} required /></label><label>已为它分配 / 元<input type="number" min="0" step=".01" value={draft.allocatedCents / 100} onChange={e => setDraft({ ...draft, allocatedCents: cents(e.target.value) })} required /></label></div>
    <p className="fine-print">预算为手动估计。分配来自可规划资金池，包含你设为可赎回的资产；它们不一定即时到账。手动市值的未来收益假设为 0%，锁定资金在到期前不能分配。</p>
    {draft.budgetCents > 0 && <div className="forecast-box"><span className="eyebrow">为这个心愿，每月留一点</span><div className="forecast-number">{forecast.monthly === null ? '目标已临近' : <><small>¥</small>{exactYuan(forecast.monthly)}<span>/ 月</span></>}</div><p>{months} 次月末储蓄 · 已分配资金加权年化 {weightedRate.toFixed(2)}%<br />当前分配预计增长到 ¥{exactYuan(forecast.futureAllocated)}，剩余缺口 ¥{exactYuan(forecast.gap)}。</p><div className="form-grid"><label>每月生活开支 / 元<input aria-label="每月生活开支" type="number" min="0" step=".01" value={expense} onChange={e => setExpense(e.target.value)} /></label><label>每月固定义务 / 元<input aria-label="每月固定义务" type="number" min="0" step=".01" value={obligation} onChange={e => setObligation(e.target.value)} /></label></div><label>新增储蓄年化假设 / %<input aria-label="新增储蓄年化假设" type="number" min="0" max="30" step=".01" required value={draft.newSavingRate ?? 0} onChange={e => setDraft({ ...draft, newSavingRate: Number(e.target.value) })} /></label><div className="income-line"><span>所需月可支配收入</span><strong>{forecast.monthly === null ? '先调整日期' : `¥${exactYuan(forecast.monthly + cents(expense) + cents(obligation))}`}</strong></div><p className="fine-print">本目标测算，不含其他目标的月储蓄。收入指税后可支配收入；生活开支默认参考上月实际支出，可临时调整；义务请仅填未包含在生活开支中的金额，试算不会修改账单。新增储蓄默认 0% 收益；只有明确计划投入时再修改年化假设。</p></div>}
    <label>自己记录的进度 · {draft.progress}%<input aria-label="目标进度" className="progress-input" type="range" min="0" max="100" value={draft.progress} onChange={e => setDraft({ ...draft, progress: Number(e.target.value) })} /></label>
    {preview && <div className="notice">目标日期从 {dateLabel(item.date)} 调整到 {dateLabel(draft.date)}。上述月储蓄已按新日期重算；保存后可撤销。</div>}{error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>试算参考日：{dateLabel(today)}</span><button className="primary-button" disabled={pending || busy} type="submit">{pending ? '正在保存…' : changedDate && !preview ? '预览日期调整' : preview ? '确认调整并保存' : '保存这个心愿'}</button></div>
  </form>
}

export default function App() {
  const today = useToday()
  const [journal, setJournal] = useState<Journal>(emptyJournal)
  const [sampleMode, setSampleMode] = useState(false)
  const personalJournal = useRef<Journal>(emptyJournal())
  const [page, setPage] = useState<Page>('home')
  const [fundsView, setFundsView] = useState<'monthly' | 'funds'>('monthly')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [online, setOnline] = useState(navigator.onLine)
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<Journal | null>(null)
  const [cacheFailed, setCacheFailed] = useState(false)
  const closePanel = useCallback(() => setPanel(null), [])
  const saving = useRef(false)
  const loadError = useRef(false)
  const loaded = useRef(false)
  useEffect(() => {
    let active = true
    readJournal().then(saved => { if (active) { const next = withCategories(saved?.schemaVersion === 1 ? saved : emptyJournal()); setJournal(next); personalJournal.current = next; setStatus('saved'); loaded.current = true } }).catch(() => { if (active) { setStatus('failed'); loadError.current = true; loaded.current = true } })
    const network = () => setOnline(navigator.onLine)
    const timeline = () => { setPage('timeline'); window.scrollTo(0, 0) }
    const cacheError = () => setCacheFailed(true)
    window.addEventListener('online', network); window.addEventListener('offline', network); window.addEventListener('open-timeline', timeline); window.addEventListener('offline-cache-failed', cacheError)
    return () => { active = false; window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('open-timeline', timeline); window.removeEventListener('offline-cache-failed', cacheError) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = journal.theme; desktopTheme(journal.theme) }, [journal.theme])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => { setToast(''); setUndo(null) }, 10000); return () => clearTimeout(timer) }, [toast])
  const change = async (next: Journal, message = '已收进这台设备的手账', close = true, allowUndo = true) => {
    if (saving.current || !loaded.current || loadError.current) return false
    try { next = withCategories(next) } catch { return false }
    if (sampleMode) {
      if (allowUndo) setUndo(journal)
      setJournal(next); setToast('样例已更新，仅在本次体验中保留'); if (close) setPanel(null); return true
    }
    saving.current = true; setStatus('saving')
    try {
      await writeJournal(next)
      personalJournal.current = next
      if (allowUndo) setUndo(journal)
      setJournal(next); setStatus('saved'); setToast(message); if (close) setPanel(null); return true
    } catch { setStatus('failed'); return false }
    finally { saving.current = false }
  }
  const saveMoment = async (item: Moment) => change({ ...journal, moments: journal.moments.some(m => m.id === item.id) ? journal.moments.map(m => m.id === item.id ? item : m) : [...journal.moments, item] })
  const saveGoal = async (item: Goal) => change({ ...journal, goals: journal.goals.some(g => g.id === item.id) ? journal.goals.map(g => g.id === item.id ? item : g) : [...journal.goals, item] })
  const saveFund = async (item: Fund) => change({ ...journal, funds: journal.funds.some(f => f.id === item.id) ? journal.funds.map(f => f.id === item.id ? item : f) : [...journal.funds, item] })
  const saveAccounts = async (accounts: AssetAccount[]) => {
    if (!isAssetAccounts(accounts)) return false
    const ids = new Set(accounts.map(a => a.id))
    if (journal.funds.some(f => f.accountId && !ids.has(f.accountId))) return false
    return change({ ...journal, accounts }, '资金账户已保存', false)
  }
  const saveMonthly = (summary: MonthlySummary) => change({ ...journal, monthlySummaries: [...(journal.monthlySummaries ?? []).filter(s => s.month !== summary.month), summary] }, '这个月的收支已收好', false)
  const removeMonthly = (month: string) => change({ ...journal, monthlySummaries: (journal.monthlySummaries ?? []).filter(s => s.month !== month) }, '已移除这份月结算', false)
  const saveCategories = async (categories: CategoryDefinition[]) => {
    if (!isCategoryDefinitions(categories)) return false
    const ids = new Set(categories.map(c => c.id))
    if ([...journal.moments, ...journal.goals].some(item => !ids.has(item.category))) return false
    return change({ ...journal, categories }, '分类已保存，时间轴也已更新', false)
  }
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `HawTend-${sampleMode ? '样例手账' : '我的手账'}-${localDay()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const switchSample = () => {
    if (saving.current || !loaded.current || loadError.current) return
    if (sampleMode) setJournal(personalJournal.current)
    else { personalJournal.current = journal; setJournal({ ...assetSample(today), monthlySummaries: [{ month: previousMonth(today), incomeCents: 1800000, expenseCents: 650025, note: "虚构样例：生活、出行与日常开销。" }] }) }
    setSampleMode(!sampleMode); setPage('home'); setPanel(null); setToast(''); setUndo(null); setStatus('saved'); window.scrollTo(0, 0)
  }
  const newMoment = () => setPanel({ type: 'moment', fresh: true, item: { id: crypto.randomUUID(), title: '', date: localDay(), category: journalCategories(journal)[0].id, importance: 1, story: '', reflection: '', storyFormat: 'markdown', reflectionFormat: 'markdown' } })
  const newGoal = () => setPanel({ type: 'goal', fresh: true, item: { id: crypto.randomUUID(), title: '', date: `${Number(localDay().slice(0, 4)) + 1}-12-31`, category: journalCategories(journal)[0].id, budgetCents: 0, allocatedCents: 0, progress: 0, description: '' } })
  const newCashFund = () => setPanel({ type: 'fund', fresh: true, item: { id: crypto.randomUUID(), name: '日常余额', principalCents: 0, rate: 0, startDate: localDay(), maturityDate: '', mode: 'compound', liquid: true } })
  const newFund = () => setPanel({ type: 'fund', fresh: true, item: { id: crypto.randomUUID(), name: '', principalCents: 0, rate: 0, startDate: localDay(), maturityDate: '', mode: 'compound', liquid: true } })
  const navigate = (id: Page) => { setPage(id); window.scrollTo(0, 0) }
  const total = journal.funds.reduce((sum, f) => sum + f.principalCents, 0)
  const latest = [...journal.moments].sort((a, b) => b.date.localeCompare(a.date))[0]
  const disabled = status === 'loading' || status === 'saving' || loadError.current
  const isBlank = !journal.moments.length && !journal.goals.length && !journal.funds.length && !journal.monthlySummaries?.length && !journal.accounts?.length
  return <CategoryProvider journal={journal} busy={disabled} save={saveCategories}><div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => navigate('home')} aria-label="HawTend，返回我的手账"><span className="brand-symbol"><BrandMark size={36} /></span><span>HawTend<small>照料生活，慢慢生长</small></span></button><span className="sidebar-label">属于你的日子</span><nav aria-label="主要导航">{navItems.map(n => <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}><Icon name={n.icon} />{n.label}{page === n.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-note"><Icon name="sprout" size={27} /><p>不必把每一天填满，<br />慢慢走，也是在向前。</p><span>给未来的自己</span></div><div className="sidebar-bottom"><button className="settings-link" onClick={() => setPanel({ type: 'settings' })}><Icon name="settings" size={18} />手账设置</button><div className="profile"><span className="avatar">我</span><div><strong>我的人生手账</strong><small>{sampleMode ? "样例体验 · 虚构数据" : "个人空间 · 本机手账"}</small></div></div></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb">我的空间<span>/</span>{navItems.find(n => n.id === page)?.label}</div><span className="mobile-brand"><BrandMark size={28} />HawTend</span><div className="topbar-actions"><span className={`save-status ${status === 'failed' ? 'failed' : ''}`} role="status"><span className="status-dot" />{sampleMode ? '样例体验' : status === 'loading' ? '正在打开手账' : status === 'saving' ? '正在保存' : status === 'failed' ? '本地保存不可用' : !online ? '离线 · 本机保存' : '仅本机保存'}</span><button className="icon-button mobile-settings" aria-label="手账设置" onClick={() => setPanel({ type: 'settings' })}><Icon name="settings" size={18} /></button><button className="primary-button top-record" disabled={disabled} onClick={() => setPanel({ type: 'new' })}><Icon name="plus" size={17} />记下一刻</button></div></header>
      <div className="content"><div className="prototype-note"><span>{sampleMode ? '样例手账 · 虚构内容' : '我的手账 · 本机空间'}</span><button className="text-button" disabled={disabled} onClick={switchSample}>{sampleMode ? '回到我的手账' : '看看样例'}<Icon name="arrow" size={13} /></button></div>
      {sampleMode && <section className="sample-banner" aria-label="样例体验说明"><Icon name="book" size={23} /><div><strong>这是一本用来体验的样例手账</strong><p>可以自由试试。这里的修改不会保存，也不会加入你的个人手账。</p></div></section>}
      <DesktopContinuity journal={journal} busy={disabled} sample={sampleMode} exportData={exportData} save={next => change(next, '旧手账已接续到此窗口', false, false)} />
      {status === 'failed' && <div className="notice" role="alert">{loadError.current ? '本地手账读取失败，暂不显示已存内容并暂停写入，防止覆盖已有数据。请刷新重试。' : '刚才的修改未保存，请在详情中重试。原有记录仍保留。'} <button className="text-button" onClick={exportData}>导出当前内容</button></div>}
      {cacheFailed && <div className="notice" role="alert">离线页面缓存未建立，请联网使用。已写入本地的记录不受影响。</div>}
      {page === 'home' && <>
        <section className="welcome"><div className="welcome-copy"><span className="eyebrow">{welcomeDay(today)}</span><h1>把日子过成<br />喜欢的样子<span className="title-dot">。</span></h1><p>收藏走过的路，也给未来留一些期待。</p><button className="text-button" onClick={newGoal} disabled={disabled}>写下一个新心愿<Icon name="arrow" size={17} /></button></div><div className="welcome-art"><Landscape /><span>山有回响，日子有光。</span><Icon name="star" size={17} className="art-star" /></div></section>
        <section className="overview-stats" aria-label="手账概览"><div><span><Icon name="flag" size={16} />正在靠近的心愿</span><strong>{journal.goals.length}<small>个</small></strong><p>每一点进展，都算数</p></div><div><span><Icon name="wallet" size={16} />已为未来留存</span><strong><small>¥</small>{yuan(total)}</strong><p>参考日余额 · 含定期资金</p></div><div><span><Icon name="book" size={16} />值得记住的日子</span><strong>{journal.moments.length}<small>篇</small></strong><p>生活里的小小里程碑</p></div></section>
        {!sampleMode && isBlank && status === 'saved' && <section className="first-page-card"><span className="first-page-icon"><Icon name="leaf" size={26} /></span><div><h2>生活的第一页，留给你来写。</h2><p>从一个小小的心愿，或今天值得记住的事开始。</p></div><button className="primary-button" disabled={disabled} onClick={newMoment}>记下第一天<Icon name="arrow" size={16} /></button></section>}
        {status === "saved" && !journal.monthlySummaries?.some(s => s.month === previousMonth(today)) && <div className="home-month-reminder"><Icon name="wallet" size={20} /><span>{previousMonth(today).replace("-", ".")} 的收支还没收好，每月记一次就好。</span><button className="text-button" onClick={() => { setFundsView("monthly"); navigate("funds") }}>补记上个月<Icon name="arrow" size={15} /></button></div>}
        <Timeline journal={journal} compact open={setPanel} />
        <div className="home-bottom"><section className="goals-preview"><div className="section-heading"><div><span className="eyebrow">A LITTLE CLOSER</span><h2>想做的事，慢慢实现</h2></div><button className="text-button" onClick={() => navigate('goals')}>全部心愿<Icon name="arrow" size={16} /></button></div>{journal.goals.slice(0, 3).map(g => <GoalCard key={g.id} goal={g} open={setPanel} />)}{!journal.goals.length && <div className="empty-state">未来还空着，给它留一个心愿吧。<button className="text-button" onClick={newGoal}>添加心愿</button></div>}</section><section className="journal-preview"><div className="section-heading"><div><span className="eyebrow">A NOTE TO MYSELF</span><h2>留给自己的话</h2></div><Icon name="edit" size={19} /></div>{latest ? <button className="reflection-card" onClick={() => setPanel({ type: 'moment', item: latest })}><div><CategoryTag category={latest.category} /><span>{dateLabel(latest.date)}</span></div><span className="quote-mark">“</span><div className="reflection-excerpt"><RichText value={latest.reflection || '这一天的心情，可以慢慢写下来。'} format={latest.reflectionFormat} summary /></div><strong>{latest.title}<Icon name="arrow" size={15} /></strong></button> : <div className="empty-state">给今天的自己写几句话。<button className="text-button" onClick={newMoment}>记录一天</button></div>}</section></div>
      </>}
      {page === 'timeline' && <><div className="page-heading"><span className="eyebrow">PAST, PRESENT & POSSIBILITY</span><h1>日子连起来，就是人生。</h1><p>已发生的大事与未来的心愿，在这里相遇。</p></div><Timeline journal={journal} open={setPanel} /><div className="timeline-bottom-note"><Icon name="book" size={25} /><div><strong>事情有大小，感受没有。</strong><p>分类颜色帮你找到同类的日子；重要程度用星标、大小与文字一起区分。</p></div><button className="quiet-button" onClick={newMoment} disabled={disabled}><Icon name="plus" size={17} />记录一个日子</button></div></>}
      {page === 'goals' && <><div className="page-heading with-action"><div><span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>心愿有了位置，<br className="mobile-only" />未来就有了方向。</h1><p>给想做的事一点时间，也一点认真。</p></div><button className="primary-button" onClick={newGoal} disabled={disabled}><Icon name="plus" size={17} />添加心愿</button></div><div className="goal-grid">{journal.goals.map(g => <div key={g.id} className="goal-tile"><CategoryTag category={g.category} /><GoalCard goal={g} open={setPanel} /><p>{g.description}</p><button className="text-button" onClick={() => setPanel({ type: 'goal', item: g })}>看看如何靠近它<Icon name="arrow" size={16} /></button></div>)}</div>{!journal.goals.length && <section className="blank-card"><Icon name="flag" size={32} /><h2>把第一份期待，写在这里。</h2><p>不必一次想好整个人生，先给一件想做的事留个位置。</p><button className="quiet-button" disabled={disabled} onClick={newGoal}>添加第一个心愿<Icon name="plus" size={16} /></button></section>}<div className="gentle-banner"><Icon name="sprout" size={28} /><p>计划可以调整。<br /><span>改变日期前，先看一眼新的储蓄节奏，再决定怎么走。</span></p></div></>}
      {page === 'funds' && <><div className="page-heading with-action"><div><span className="eyebrow">A LITTLE PEACE OF MIND</span><h1>为想要的生活，<br className="mobile-only" />留一份底气。</h1><p>回看每月的花费，也安排慢慢长大的积蓄。</p></div>{fundsView === "funds" && <button className="primary-button" onClick={newFund} disabled={disabled}><Icon name="plus" size={17} />添加资金</button>}</div><div className="funds-tabs" role="group" aria-label="收支与资金视图"><button aria-pressed={fundsView === "monthly"} onClick={() => setFundsView("monthly")}><Icon name="book" size={17} />每月收支</button><button aria-pressed={fundsView === "funds"} onClick={() => setFundsView("funds")}><Icon name="wallet" size={17} />资金安排</button></div>{fundsView === "monthly" ? <MonthlyLedger summaries={journal.monthlySummaries ?? []} save={saveMonthly} remove={removeMonthly} busy={disabled} sample={sampleMode} uninvested={newCashFund} /> : <FundsPage journal={journal} edit={item => setPanel({ type: "fund", item })} update={item => setPanel({ type: "valuation", item })} saveAccounts={saveAccounts} busy={disabled} forecast={funds => <FinanceCurve funds={funds} />} />}</>}
      <footer className="page-footer"><span>HawTend · 好好生活，慢慢记录</span><button onClick={() => setPanel({ type: 'settings' })} className="text-button">本地原型 · 云同步未连接<Icon name="cloud" size={15} /></button></footer>
      </div></main>
    <nav className="mobile-nav" aria-label="手机主要导航">{navItems.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}><Icon name={n.icon} size={21} /><span>{n.short}</span></button>)}<button className="mobile-add" disabled={disabled} aria-label="记下一刻" onClick={() => setPanel({ type: 'new' })}><Icon name="plus" size={23} /><span>记录</span></button></nav>
    {panel && <Modal title={panel.type === 'moment' ? panel.fresh ? '记下一个日子' : '回到那一天' : panel.type === 'goal' ? panel.fresh ? '给未来一个心愿' : '慢慢靠近这个心愿' : panel.type === 'fund' ? panel.fresh ? '给积蓄一个位置' : '安排这笔积蓄' : panel.type === 'valuation' ? '记下这次市值变化' : panel.type === 'settings' ? '把手账调成喜欢的样子' : panel.type === 'cluster' ? '这一段，发生了这些事' : '这一刻，想记下什么？'} subtitle={panel.type === 'moment' ? '事情与感想，分别收藏。' : panel.type === 'new' ? '一个已经发生的日子，或一个正在期待的未来。' : undefined} close={closePanel}>
      {panel.type === 'cluster' && <div className="cluster-list">{panel.items.map(({ kind, item }) => <button key={item.id} onClick={() => setPanel(kind === 'moment' ? { type: 'moment', item: item as Moment } : { type: 'goal', item: item as Goal })}><CategoryTag category={item.category} /><span><strong>{item.title}</strong><small>{dateLabel(item.date)} · {kind === 'moment' ? importanceLabels[(item as Moment).importance] : '未来计划'}</small></span><Icon name="chevron" size={17} /></button>)}</div>}
      {sampleMode && panel.type !== 'settings' && <p className="notice">样例体验：这里的修改仅在本次浏览中保留，不会写入个人手账。</p>}
      {panel.type === 'moment' && <MomentForm key={panel.item.id} item={panel.item} fresh={panel.fresh} save={saveMoment} sample={sampleMode} />}
      {panel.type === 'goal' && <GoalForm key={panel.item.id} item={panel.item} fresh={panel.fresh} journal={journal} save={saveGoal} sample={sampleMode} />}
      {panel.type === 'fund' && <FundEditor key={panel.item.id} item={panel.item} fresh={panel.fresh} journal={journal} save={saveFund} saveAccounts={saveAccounts} update={() => setPanel({ type: "valuation", item: panel.item })} busy={disabled} />}
      {panel.type === 'valuation' && <ValuationEditor key={panel.item.id} item={panel.item} save={saveFund} busy={disabled} />}
      {panel.type === 'new' && <div className="new-options"><button onClick={newMoment}><span className="option-icon"><Icon name="book" size={26} /></span><span><strong>值得记住的日子</strong><small>记录事情，也记录当时的心情</small></span><Icon name="arrow" size={19} /></button><button onClick={newGoal}><span className="option-icon blue"><Icon name="flag" size={26} /></span><span><strong>对未来的一个期待</strong><small>放上时间轴，慢慢计划与实现</small></span><Icon name="arrow" size={19} /></button></div>}
      {panel.type === 'settings' && <div className="settings-panel"><p className="settings-intro">三种生活的底色，试试哪一种更像你。<br /><span>HawTend · 好好照料生活，也记录慢慢长大的自己。</span></p><div className="theme-options">{([{ id: 'paper', title: '暖纸手账', note: '纸色与鼠尾草绿，安静而有温度', colors: ['#f5f2eb', '#566958', '#c79265'] }, { id: 'forest', title: '森林笔记', note: '浅雾绿与深林色，清新、自然', colors: ['#edf1e9', '#41654f', '#94a881'] }, { id: 'dusk', title: '暮色日记', note: '浅燕麦与梅子色，柔软而内敛', colors: ['#f4eef0', '#805d70', '#c1949d'] }] as const).map(t => <button key={t.id} disabled={disabled} className={`theme-option ${journal.theme === t.id ? 'chosen' : ''}`} aria-pressed={journal.theme === t.id} onClick={() => change({ ...journal, theme: t.id }, '手账配色已保存到本机', false)}><span className="swatches">{t.colors.map(c => <i key={c} style={{ background: c }} />)}</span><strong>{t.title}</strong><span>{t.note}</span>{journal.theme === t.id && <Icon name="check" size={17} />}</button>)}</div><CategoryManager />{isDesktop() && !sampleMode && isBlank && <button className="quiet-button" disabled={disabled} onClick={() => { setPanel(null); setPage('home'); window.scrollTo(0, 0); window.dispatchEvent(new Event('hawtend-continue')) }}>接续以前的手账<Icon name="arrow" size={16} /></button>}<div className="settings-storage"><Icon name="book" size={25} /><div><h3>{sampleMode ? "正在体验样例手账" : "样例和你的手账，分别收藏"}</h3><p>新手账从空白开始。样例只用于体验，修改不会加入个人记录。</p><button className="text-button" disabled={disabled} onClick={switchSample}>{sampleMode ? "回到我的手账" : "查看样例手账"}<Icon name="arrow" size={16} /></button></div></div><div className="settings-storage"><Icon name="cloud" size={25} /><div><h3>这里是本地设计原型</h3><p>{isDesktop() ? "云同步尚未接入。编辑保存在这台电脑的独立手账空间，不会同步到另一台设备。可以导出文件留存。" : "云同步尚未接入。编辑仅存于当前浏览器，不会同步到另一台设备。浏览器清理可能删除本地内容，可以先导出留存。"}</p></div></div><button className="quiet-button export-button" onClick={exportData}><Icon name="download" size={18} />{sampleMode ? "导出样例手账 JSON" : "导出我的手账 JSON"}</button><p className="fine-print">账单导入、逐笔记账、数据恢复、账户登录与健康记录在后续分期实现。每月收支现已支持本机记录。请先用虚构内容体验流程。</p></div>}
    </Modal>}
    {toast && <div className="toast" role="status"><Icon name="check" size={18} /><span>{toast}</span>{undo && <button onClick={async () => { const previous = undo; if (previous && await change(previous, '已撤销上一次修改', false, false)) setUndo(null) }}>撤销</button>}<button className="icon-button" aria-label="关闭保存提示" onClick={() => { setToast(''); setUndo(null) }}><Icon name="close" size={15} /></button></div>}
  </div></CategoryProvider>
}
