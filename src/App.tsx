import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Icon, Landscape } from './Icons'
import { categories, importanceLabels, seedJournal } from './model'
import type { Category, Fund, Goal, Importance, Journal, Moment } from './model'
import { cents, exactYuan, futureValue, monthlySaving, monthsUntil, yuan } from './finance'
import { readJournal, writeJournal } from './storage'

const TODAY = '2026-10-05'
const dateLabel = (date: string) => date.replaceAll('-', '.')
const navItems = [{ id: 'home', label: '我的手账', short: '手账', icon: 'home' }, { id: 'timeline', label: '人生时间轴', short: '时间轴', icon: 'timeline' }, { id: 'goals', label: '心愿与目标', short: '心愿', icon: 'flag' }, { id: 'funds', label: '资金安排', short: '资金', icon: 'wallet' }] as const
type Page = typeof navItems[number]['id']
type Panel = { type: 'moment'; item: Moment; fresh?: boolean } | { type: 'goal'; item: Goal; fresh?: boolean } | { type: 'fund'; item: Fund; fresh?: boolean } | { type: 'settings' } | { type: 'new' }
  | { type: 'cluster'; items: { kind: 'moment' | 'goal'; item: Moment | Goal }[] }
type Status = 'loading' | 'saved' | 'saving' | 'failed'

function CategoryTag({ category }: { category: Category }) {
  const c = categories[category]
  return <span className="category-tag" style={{ '--category': c.color, '--category-light': c.light } as CSSProperties}><Icon name={c.icon} size={14} />{c.label}</span>
}

function Modal({ title, subtitle, children, close }: { title: string; subtitle?: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const container = ref.current!
    const focusable = () => [...container.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter(el => !el.hasAttribute('disabled'))
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
    <div className="modal-header"><div><span className="eyebrow">SHIGUANG / MY JOURNAL</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭详情" onClick={close}><Icon name="close" /></button></div>
    {children}
  </div></div>
}

function Timeline({ journal, compact = false, open }: { journal: Journal; compact?: boolean; open: (panel: Panel) => void }) {
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [onlyImportant, setOnlyImportant] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [year, setYear] = useState(2026)
  const [curve, setCurve] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const items = [
    ...journal.moments.map(m => ({ kind: 'moment' as const, item: m })),
    ...journal.goals.map(g => ({ kind: 'goal' as const, item: g })),
  ].filter(({ kind, item }) => (filter === 'all' || item.category === filter) && (!onlyImportant || kind === 'goal' || (item as Moment).importance >= 2)).sort((a, b) => a.item.date.localeCompare(b.item.date))
  const width = compact ? Math.max(1060, items.length * 188 + 260) : 1900 * zoom
  const start = Date.parse(`${year}-01-01`), end = Date.parse(`${year + 4}-01-01`)
  const position = (date: string) => 64 + (Date.parse(date) - start) / (end - start) * (width - 128)
  const visibleItems = compact ? items : items.filter(({ item }) => Date.parse(item.date) >= start && Date.parse(item.date) <= end)
  const groups: (typeof items)[] = []
  visibleItems.forEach(entry => {
    const group = groups[groups.length - 1]
    if (!compact && group && position(entry.item.date) - position(group[0].item.date) < 90) group.push(entry)
    else groups.push([entry])
  })
  const todayX = compact ? 80 + journal.moments.filter(m => m.date < TODAY && (filter === 'all' || m.category === filter) && (!onlyImportant || m.importance >= 2)).length * 188 : position(TODAY)
  const scrollToday = () => scroll.current?.scrollTo({ left: Math.max(0, todayX - scroll.current.clientWidth * .4), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  const returnToday = () => { setYear(2026); requestAnimationFrame(scrollToday) }
  return <section className={`timeline-section ${compact ? 'compact' : 'expanded'}`}>
    <div className="section-heading"><div><span className="eyebrow">THE DAYS THAT MAKE YOU</span><h2>{compact ? '一路走来，也一路向前' : '每一个节点，都是你的一部分'}</h2></div>{compact ? <button className="text-button" onClick={() => { window.dispatchEvent(new Event('open-timeline')) }}>展开时间轴<Icon name="arrow" size={16} /></button> : <button className="quiet-button" onClick={returnToday}><Icon name="sun" size={16} />回到今天</button>}</div>
    <div className="timeline-toolbar"><div className="filter-group" aria-label="时间轴分类">{(['all', ...Object.keys(categories)] as (Category | 'all')[]).map(c => <button key={c} className={`filter-chip ${filter === c ? 'selected' : ''}`} onClick={() => setFilter(c)}>{c === 'all' ? '全部' : <><span className="color-dot" style={{ background: categories[c].color }} />{categories[c].label}</>}</button>)}</div>{!compact && <label className="checkbox-label"><input type="checkbox" checked={onlyImportant} onChange={e => setOnlyImportant(e.target.checked)} />只看重要节点</label>}</div>
    {!compact && <div className="range-toolbar"><div className="range-controls"><button className="icon-button" aria-label="查看更早四年" onClick={() => setYear(year - 4)}><Icon name="chevron" className="reverse" size={17} /></button><span>{year} — {year + 3}</span><button className="icon-button" aria-label="查看更晚四年" onClick={() => setYear(year + 4)}><Icon name="chevron" size={17} /></button></div><label className="zoom-label">缩放<input aria-label="时间轴缩放" type="range" min=".7" max="2" step=".1" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><button className={`quiet-button ${curve ? 'active' : ''}`} aria-pressed={curve} onClick={() => setCurve(!curve)}><Icon name="wallet" size={16} />资金轨迹</button></div>}
    <div ref={scroll} className="timeline-scroll" tabIndex={0} role="region" aria-label="可横向拖动的人生时间轴" onKeyDown={e => { if (e.target === e.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); scroll.current!.scrollLeft += e.key === 'ArrowLeft' ? -180 : 180 } }}
      onPointerDown={e => { if (e.pointerType !== 'mouse' || (e.target as HTMLElement).closest('button')) return; pan.current = { x: e.clientX, left: scroll.current!.scrollLeft, moved: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (!pan.current) return; const delta = e.clientX - pan.current.x; if (Math.abs(delta) > 4) pan.current.moved = true; scroll.current!.scrollLeft = pan.current.left - delta }}
      onPointerUp={() => { pan.current = null }} onPointerCancel={() => { pan.current = null }}>
      <div className="timeline-canvas" style={{ width }}>
        <div className="axis-line" />
        <span className="axis-origin">过去</span><span className="axis-future">未来 <Icon name="arrow" size={16} /></span>
        {!compact && Array.from({ length: 4 }, (_, i) => <span className="year-mark" key={i} style={{ left: position(`${year + i}-01-01`) }}>{year + i}</span>)}
        {todayX >= 0 && todayX <= width && <div className="today-marker" style={{ left: todayX }}><span>今天 · 10.05</span><i /></div>}
        {groups.map((group, index) => {
          const { kind, item } = group[0]
          let x = compact ? 64 + index * 188 + (item.date > TODAY ? 92 : 0) : position(item.date)
          const lane = index % 2
          const c = categories[item.category]
          if (group.length > 1) return <button key={`cluster-${item.id}`} className={`timeline-node cluster lane-${lane}`} style={{ left: x, '--category': '#777e68', '--category-light': '#e9ebdf' } as CSSProperties} onClick={() => open({ type: 'cluster', items: group })}><span className="node-stem" /><span className="node-dot" /><span className="node-card"><span className="node-meta">{dateLabel(item.date)}<span>聚合节点</span></span><strong>这段日子的 {group.length} 个节点</strong><span className="node-category"><Icon name="book" size={13} />点击展开 · 保留各自日期</span></span></button>
          return <button key={item.id} className={`timeline-node lane-${lane} ${kind} importance-${kind === 'moment' ? (item as Moment).importance : 2}`} style={{ left: x, '--category': c.color, '--category-light': c.light } as CSSProperties} onClick={() => open(kind === 'moment' ? { type: 'moment', item: item as Moment } : { type: 'goal', item: item as Goal })}>
            <span className="node-stem" /><span className="node-dot">{kind === 'goal' ? <Icon name="flag" size={11} /> : (item as Moment).importance === 3 ? <Icon name="star" size={11} /> : null}</span>
            <span className="node-card"><span className="node-meta">{dateLabel(item.date)}<span>{kind === 'goal' ? '计划' : importanceLabels[(item as Moment).importance]}</span></span><strong>{item.title}</strong><span className="node-category"><Icon name={c.icon} size={13} />{c.label}{kind === 'goal' && (item as Goal).budgetCents > 0 && <span className="node-amount">¥{yuan((item as Goal).budgetCents)}</span>}</span></span>
          </button>
        })}
        {!visibleItems.length && <div className="timeline-empty"><Icon name="leaf" size={32} /><p>这段时间还没有节点</p><span>换个分类，或写下一个值得记住的日子。</span></div>}
      </div>
    </div>
    <div className="timeline-caption"><span><span className="legend-dot solid" />已发生 <span className="legend-dot dashed" />未来计划</span><span>{compact ? '节点概览 · 间距不代表时长' : '左右拖动浏览 · 点击查看详情'}</span></div>
    {curve && <FinanceCurve funds={journal.funds} />}
  </section>
}

function FinanceCurve({ funds }: { funds: Fund[] }) {
  const dates = Array.from({ length: 11 }, (_, i) => `${2026 + i}-10-05`)
  const balances = dates.map(d => funds.reduce((sum, f) => sum + futureValue(f, d), 0))
  const available = dates.map(d => funds.filter(f => f.liquid || (f.maturityDate && f.maturityDate <= d)).reduce((sum, f) => sum + futureValue(f, d), 0))
  const max = Math.max(1, ...balances) * 1.1
  const points = (values: number[]) => values.map((v, i) => `${50 + i * 66},${168 - v / max * 136}`).join(' ')
  return <div className="finance-curve"><div><h3>让积蓄陪你走得更远</h3><p>独立的十年余额预测 · 未纳入目标支出与新增储蓄</p></div><svg viewBox="0 0 760 206" role="img" aria-label="2026至2036年的预测总资产与可用余额曲线"><path d="M50 30V168H710" fill="none" stroke="var(--line)" />{[2026, 2031, 2036].map((y, i) => <text key={y} x={50 + i * 330} y={193}>{y}</text>)}<text x="50" y="18">余额 / 元</text><text x="600" y="18">¥{yuan(balances[10])}</text><polyline points={points(balances)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="7 5" /><polyline points={points(available)} fill="none" stroke="#b48352" strokeWidth="2.5" strokeDasharray="3 4" /></svg><div className="curve-legend"><span><i />预计总资产</span><span><i />预计可用余额</span><span>定期到期后计入可用余额</span></div><p className="fine-print">预测以十年为刻度，按各笔资金的实际到期日期释放可用余额；收益不代表真实到账。</p></div>
}

function GoalCard({ goal, open }: { goal: Goal; open: (panel: Panel) => void }) {
  const c = categories[goal.category]
  return <button className="goal-card" onClick={() => open({ type: 'goal', item: goal })} style={{ '--category': c.color, '--category-light': c.light } as CSSProperties}>
    <span className="goal-icon"><Icon name={c.icon} size={24} /></span><span className="goal-copy"><span className="goal-card-top"><strong>{goal.title}</strong><span>{goal.progress}%</span></span><span className="goal-date">{goal.date.slice(0, 4)} 年 {Number(goal.date.slice(5, 7))} 月 · {goal.budgetCents ? `预算 ¥${yuan(goal.budgetCents)}` : '让习惯慢慢发生'}</span><span className="progress-track"><i style={{ width: `${goal.progress}%` }} /></span></span><Icon name="chevron" size={16} />
  </button>
}

function MomentForm({ item, fresh, save }: { item: Moment; fresh?: boolean; save: (item: Moment) => Promise<boolean> }) {
  const [draft, setDraft] = useState(item)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const changedDate = !fresh && draft.date !== item.date
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.title.trim()) { setError('给这一天写个标题吧。'); return }
    if (draft.date > TODAY) { setError('大事记记录已发生的日子，未来的事情请添加为目标。'); return }
    if (changedDate && !preview) { setPreview(true); return }
    setPending(true)
    const ok = await save({ ...draft, title: draft.title.trim() })
    setPending(false)
    if (!ok) setError('保存未完成。文字还在这里，请重试或复制留存。')
  }
  return <form className="editor" onSubmit={submit}><div className="detail-tags"><CategoryTag category={draft.category} /><span className="importance-tag"><Icon name={draft.importance === 3 ? 'star' : 'sun'} size={14} />{importanceLabels[draft.importance]}</span></div>
    <label>这一天的标题<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="有什么值得记住？" /></label>
    <div className="form-grid"><label>发生日期<input required type="date" max={TODAY} value={draft.date} onChange={e => { setDraft({ ...draft, date: e.target.value }); setPreview(false) }} /></label><label>分类<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as Category })}>{Object.entries(categories).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label></div>
    <label>对我有多重要<select value={draft.importance} onChange={e => setDraft({ ...draft, importance: Number(e.target.value) as Importance })}>{Object.entries(importanceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label>发生了什么<textarea rows={3} value={draft.story} onChange={e => setDraft({ ...draft, story: e.target.value })} placeholder="记录事情本身，几句话就好。" /></label>
    <div className="reflection-field"><label><span><Icon name="edit" size={17} />留给自己的话 <small>感想 · 可稍后补写</small></span><textarea rows={5} value={draft.reflection} onChange={e => setDraft({ ...draft, reflection: e.target.value })} placeholder="当时的心情、后来想通的事，都可以留在这里。" /></label></div>
    {preview && <div className="notice">日期将从 {dateLabel(item.date)} 改为 {dateLabel(draft.date)}，节点位置随之更新。感想与资金安排不会改变；保存后可撤销。</div>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>仅保存到此浏览器</span><button className="primary-button" disabled={pending} type="submit"><Icon name="check" size={17} />{pending ? '正在保存…' : changedDate && !preview ? '预览日期调整' : preview ? '确认调整并保存' : '收进手账'}</button></div>
  </form>
}

function GoalForm({ item, fresh, journal, save }: { item: Goal; fresh?: boolean; journal: Journal; save: (item: Goal) => Promise<boolean> }) {
  const [draft, setDraft] = useState(item)
  const [expense, setExpense] = useState('8000')
  const [obligation, setObligation] = useState('2000')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState(false)
  const liquidFunds = journal.funds.filter(f => f.liquid)
  const liquidAmount = liquidFunds.reduce((sum, f) => sum + f.principalCents, 0)
  const available = liquidAmount - journal.goals.filter(g => g.id !== draft.id).reduce((sum, g) => sum + g.allocatedCents, 0)
  const weightedRate = liquidAmount ? liquidFunds.reduce((sum, f) => sum + f.principalCents * f.rate, 0) / liquidAmount : 0
  const months = monthsUntil(TODAY, draft.date)
  const forecast = monthlySaving(draft.budgetCents, draft.allocatedCents, weightedRate, months)
  const changedDate = !fresh && draft.date !== item.date
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.title.trim()) { setError('请填写目标名称。'); return }
    if (draft.date < TODAY) { setError('目标日期不能早于示例参考日。'); return }
    if (draft.allocatedCents > available) { setError(`扣除其他目标后，最多可分配 ¥${exactYuan(Math.max(0, available))}。`); return }
    if (draft.allocatedCents > draft.budgetCents) { setError('当前分配不能超过目标预算。'); return }
    if (changedDate && !preview) { setPreview(true); return }
    setPending(true); const ok = await save({ ...draft, title: draft.title.trim() }); setPending(false)
    if (!ok) setError('保存未完成，请重试。')
  }
  return <form className="editor" onSubmit={submit}><label>我想完成的事<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><div className="form-grid"><label>希望完成的日期<input required type="date" min={TODAY} max="2100-12-31" value={draft.date} onChange={e => { setDraft({ ...draft, date: e.target.value }); setPreview(false) }} /></label><label>分类<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as Category })}>{Object.entries(categories).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label></div>
    <label>为什么想做这件事<textarea rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
    <div className="form-grid"><label>预计需要 / 元<input type="number" min="0" max="100000000" step=".01" value={draft.budgetCents / 100} onChange={e => setDraft({ ...draft, budgetCents: cents(e.target.value) })} required /></label><label>已为它分配 / 元<input type="number" min="0" step=".01" value={draft.allocatedCents / 100} onChange={e => setDraft({ ...draft, allocatedCents: cents(e.target.value) })} required /></label></div>
    <p className="fine-print">预算为手动估计。原型将分配资金放在活期池中，不重复分配；十年定期无法用于到期前的目标。</p>
    {draft.budgetCents > 0 && <div className="forecast-box"><span className="eyebrow">为这个心愿，每月留一点</span><div className="forecast-number">{forecast.monthly === null ? '目标已临近' : <><small>¥</small>{exactYuan(forecast.monthly)}<span>/ 月</span></>}</div><p>{months} 次月末储蓄 · 活期池加权年化 {weightedRate.toFixed(2)}%<br />当前分配预计增长到 ¥{exactYuan(forecast.futureAllocated)}，剩余缺口 ¥{exactYuan(forecast.gap)}。</p><div className="form-grid"><label>每月生活开支 / 元<input aria-label="每月生活开支" type="number" min="0" step=".01" value={expense} onChange={e => setExpense(e.target.value)} /></label><label>每月固定义务 / 元<input aria-label="每月固定义务" type="number" min="0" step=".01" value={obligation} onChange={e => setObligation(e.target.value)} /></label></div><div className="income-line"><span>所需月可支配收入</span><strong>{forecast.monthly === null ? '先调整日期' : `¥${exactYuan(forecast.monthly + cents(expense) + cents(obligation))}`}</strong></div><p className="fine-print">本目标测算，不含其他目标的月储蓄。收入指税后可支配收入；开支和义务为临时试算，未记入账单。新增储蓄按同一活期收益持续计息。</p></div>}
    <label>自己记录的进度 · {draft.progress}%<input aria-label="目标进度" className="progress-input" type="range" min="0" max="100" value={draft.progress} onChange={e => setDraft({ ...draft, progress: Number(e.target.value) })} /></label>
    {preview && <div className="notice">目标日期从 {dateLabel(item.date)} 调整到 {dateLabel(draft.date)}。上述月储蓄已按新日期重算；保存后可撤销。</div>}{error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>试算参考日：2026.10.05</span><button className="primary-button" disabled={pending} type="submit">{pending ? '正在保存…' : changedDate && !preview ? '预览日期调整' : preview ? '确认调整并保存' : '保存这个心愿'}</button></div>
  </form>
}

function FundForm({ item, journal, save }: { item: Fund; journal: Journal; save: (item: Fund) => Promise<boolean> }) {
  const [draft, setDraft] = useState(item)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.liquid && (!draft.maturityDate || draft.maturityDate <= draft.startDate)) { setError('请设置晚于参考日的到期日期。'); return }
    const liquid = journal.funds.filter(f => f.id !== draft.id && f.liquid).reduce((sum, f) => sum + f.principalCents, draft.liquid ? draft.principalCents : 0)
    const assigned = journal.goals.reduce((sum, g) => sum + g.allocatedCents, 0)
    if (liquid < assigned) { setError(`已有目标分配 ¥${exactYuan(assigned)}，修改后活期余额不足。请先调整目标分配。`); return }
    setPending(true); const ok = await save({ ...draft, maturityDate: draft.liquid ? '' : draft.maturityDate }); setPending(false)
    if (!ok) setError('保存未完成，请重试。')
  }
  const previewDate = draft.liquid ? '2027-10-05' : draft.maturityDate
  return <form className="editor" onSubmit={submit}><label>这笔钱的名字<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><div className="form-grid"><label>参考日余额 / 元<input required type="number" min="0" max="100000000" step=".01" value={draft.principalCents / 100} onChange={e => setDraft({ ...draft, principalCents: cents(e.target.value) })} /></label><label>年化收益 / %<input required type="number" min="0" max="30" step=".01" value={draft.rate} onChange={e => setDraft({ ...draft, rate: Number(e.target.value) })} /></label></div>
    <p className="fine-print">示例参考日：2026.10.05。余额视为截至当日已结算的金额，之前的利息不会重复累加。原型支持固定非负年化，正式版再细化付息方式。</p>
    <label>资金可用性<select value={draft.liquid ? 'liquid' : 'locked'} onChange={e => setDraft({ ...draft, liquid: e.target.value === 'liquid' })}><option value="liquid">活期 · 随时可用</option><option value="locked">定期 · 到期可用</option></select></label>
    {!draft.liquid && <label>到期日期<input required min={TODAY} max="2100-12-31" type="date" value={draft.maturityDate} onChange={e => setDraft({ ...draft, maturityDate: e.target.value })} /></label>}
    <label>计息方式<select value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as Fund['mode'] })}><option value="compound">复利 · 利息继续投入</option><option value="simple">单利 · 按参考日余额计息</option></select></label>
    {previewDate && <div className="forecast-box"><span className="eyebrow">{draft.liquid ? '一年后预计余额' : '到期预计余额'}</span><div className="forecast-number"><small>¥</small>{exactYuan(futureValue(draft, previewDate))}</div><p>预计收益 ¥{exactYuan(futureValue(draft, previewDate) - draft.principalCents)}<br />{draft.liquid ? '按固定年化估算，实际收益可能变化。' : `${dateLabel(draft.maturityDate)} 到期；到期后默认零收益。`}</p></div>}
    <div className="notice">预计收益不代表实际入账。定期在到期前锁定本金与利息，不提前用于目标；暂不模拟提前支取。</div>{error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>调整后目标试算随之更新</span><button className="primary-button" disabled={pending} type="submit">{pending ? '正在保存…' : '保存资金安排'}</button></div>
  </form>
}

export default function App() {
  const [journal, setJournal] = useState<Journal>(seedJournal)
  const [page, setPage] = useState<Page>('home')
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
    readJournal().then(saved => { if (active) { if (saved?.schemaVersion === 1) setJournal(saved); setStatus('saved'); loaded.current = true } }).catch(() => { if (active) { setStatus('failed'); loadError.current = true; loaded.current = true } })
    const network = () => setOnline(navigator.onLine)
    const timeline = () => { setPage('timeline'); window.scrollTo(0, 0) }
    const cacheError = () => setCacheFailed(true)
    window.addEventListener('online', network); window.addEventListener('offline', network); window.addEventListener('open-timeline', timeline); window.addEventListener('offline-cache-failed', cacheError)
    return () => { active = false; window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('open-timeline', timeline); window.removeEventListener('offline-cache-failed', cacheError) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = journal.theme }, [journal.theme])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => { setToast(''); setUndo(null) }, 10000); return () => clearTimeout(timer) }, [toast])
  const change = async (next: Journal, message = '已收进这台设备的手账', close = true, allowUndo = true) => {
    if (saving.current || !loaded.current || loadError.current) return false
    saving.current = true; setStatus('saving')
    try {
      await writeJournal(next)
      if (allowUndo) setUndo(journal)
      setJournal(next); setStatus('saved'); setToast(message); if (close) setPanel(null); return true
    } catch { setStatus('failed'); return false }
    finally { saving.current = false }
  }
  const saveMoment = async (item: Moment) => change({ ...journal, moments: journal.moments.some(m => m.id === item.id) ? journal.moments.map(m => m.id === item.id ? item : m) : [...journal.moments, item] })
  const saveGoal = async (item: Goal) => change({ ...journal, goals: journal.goals.some(g => g.id === item.id) ? journal.goals.map(g => g.id === item.id ? item : g) : [...journal.goals, item] })
  const saveFund = async (item: Fund) => change({ ...journal, funds: journal.funds.some(f => f.id === item.id) ? journal.funds.map(f => f.id === item.id ? item : f) : [...journal.funds, item] })
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `拾光-原型手账-${TODAY}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const newMoment = () => setPanel({ type: 'moment', fresh: true, item: { id: crypto.randomUUID(), title: '', date: TODAY, category: 'life', importance: 1, story: '', reflection: '' } })
  const newGoal = () => setPanel({ type: 'goal', fresh: true, item: { id: crypto.randomUUID(), title: '', date: '2027-12-31', category: 'life', budgetCents: 0, allocatedCents: 0, progress: 0, description: '' } })
  const newFund = () => setPanel({ type: 'fund', fresh: true, item: { id: crypto.randomUUID(), name: '', principalCents: 0, rate: 0, startDate: TODAY, maturityDate: '', mode: 'compound', liquid: true } })
  const navigate = (id: Page) => { setPage(id); window.scrollTo(0, 0) }
  const total = journal.funds.reduce((sum, f) => sum + f.principalCents, 0)
  const liquid = journal.funds.filter(f => f.liquid).reduce((sum, f) => sum + f.principalCents, 0)
  const allocated = journal.goals.reduce((sum, g) => sum + g.allocatedCents, 0)
  const latest = [...journal.moments].sort((a, b) => b.date.localeCompare(a.date))[0]
  const disabled = status === 'loading' || status === 'saving' || loadError.current
  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => navigate('home')} aria-label="拾光，返回我的手账"><span className="brand-symbol"><Icon name="book" size={25} /></span><span>拾光<small>人生，是一本自己的书</small></span></button><span className="sidebar-label">属于你的日子</span><nav aria-label="主要导航">{navItems.map(n => <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}><Icon name={n.icon} />{n.label}{page === n.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-note"><Icon name="sprout" size={27} /><p>不必把每一天填满，<br />慢慢走，也是在向前。</p><span>给未来的自己</span></div><div className="sidebar-bottom"><button className="settings-link" onClick={() => setPanel({ type: 'settings' })}><Icon name="settings" size={18} />手账设置</button><div className="profile"><span className="avatar">我</span><div><strong>我的人生手账</strong><small>个人空间 · 示例数据</small></div></div></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb">我的空间<span>/</span>{navItems.find(n => n.id === page)?.label}</div><span className="mobile-brand"><Icon name="book" size={21} />拾光</span><div className="topbar-actions"><span className={`save-status ${status === 'failed' ? 'failed' : ''}`} role="status"><span className="status-dot" />{status === 'loading' ? '正在打开手账' : status === 'saving' ? '正在保存' : status === 'failed' ? '本地保存不可用' : !online ? '离线 · 本机保存' : '仅本机保存'}</span><button className="icon-button mobile-settings" aria-label="手账设置" onClick={() => setPanel({ type: 'settings' })}><Icon name="settings" size={18} /></button><button className="primary-button top-record" disabled={disabled} onClick={() => setPanel({ type: 'new' })}><Icon name="plus" size={17} />记下一刻</button></div></header>
      <div className="content"><div className="prototype-note"><span>第 0 期 · 可交互设计原型</span><span>示例数据 / 2026.10.05</span></div>
      {status === 'failed' && <div className="notice" role="alert">{loadError.current ? '本地手账读取失败，当前显示示例且暂停写入，防止覆盖已有数据。请刷新重试。' : '刚才的修改未保存，请在详情中重试。原有记录仍保留。'} <button className="text-button" onClick={exportData}>导出当前内容</button></div>}
      {cacheFailed && <div className="notice" role="alert">离线页面缓存未建立，请联网使用。已写入本地的记录不受影响。</div>}
      {page === 'home' && <>
        <section className="welcome"><div className="welcome-copy"><span className="eyebrow">MONDAY, OCTOBER 05, 2026</span><h1>把日子过成<br />喜欢的样子<span className="title-dot">。</span></h1><p>收藏走过的路，也给未来留一些期待。</p><button className="text-button" onClick={newGoal} disabled={disabled}>写下一个新心愿<Icon name="arrow" size={17} /></button></div><div className="welcome-art"><Landscape /><span>山有回响，日子有光。</span><Icon name="star" size={17} className="art-star" /></div></section>
        <section className="overview-stats" aria-label="手账概览"><div><span><Icon name="flag" size={16} />正在靠近的心愿</span><strong>{journal.goals.length}<small>个</small></strong><p>每一点进展，都算数</p></div><div><span><Icon name="wallet" size={16} />已为未来留存</span><strong><small>¥</small>{yuan(total)}</strong><p>参考日余额 · 含定期资金</p></div><div><span><Icon name="book" size={16} />值得记住的日子</span><strong>{journal.moments.length}<small>篇</small></strong><p>生活里的小小里程碑</p></div></section>
        <Timeline journal={journal} compact open={setPanel} />
        <div className="home-bottom"><section className="goals-preview"><div className="section-heading"><div><span className="eyebrow">A LITTLE CLOSER</span><h2>想做的事，慢慢实现</h2></div><button className="text-button" onClick={() => navigate('goals')}>全部心愿<Icon name="arrow" size={16} /></button></div>{journal.goals.slice(0, 3).map(g => <GoalCard key={g.id} goal={g} open={setPanel} />)}{!journal.goals.length && <div className="empty-state">未来还空着，给它留一个心愿吧。<button className="text-button" onClick={newGoal}>添加心愿</button></div>}</section><section className="journal-preview"><div className="section-heading"><div><span className="eyebrow">A NOTE TO MYSELF</span><h2>留给自己的话</h2></div><Icon name="edit" size={19} /></div>{latest ? <button className="reflection-card" onClick={() => setPanel({ type: 'moment', item: latest })}><div><CategoryTag category={latest.category} /><span>{dateLabel(latest.date)}</span></div><span className="quote-mark">“</span><p>{latest.reflection || '这一天的心情，可以慢慢写下来。'}</p><strong>{latest.title}<Icon name="arrow" size={15} /></strong></button> : <div className="empty-state">给今天的自己写几句话。<button className="text-button" onClick={newMoment}>记录一天</button></div>}</section></div>
      </>}
      {page === 'timeline' && <><div className="page-heading"><span className="eyebrow">PAST, PRESENT & POSSIBILITY</span><h1>日子连起来，就是人生。</h1><p>已发生的大事与未来的心愿，在这里相遇。</p></div><Timeline journal={journal} open={setPanel} /><div className="timeline-bottom-note"><Icon name="book" size={25} /><div><strong>事情有大小，感受没有。</strong><p>分类颜色帮你找到同类的日子；重要程度用星标、大小与文字一起区分。</p></div><button className="quiet-button" onClick={newMoment} disabled={disabled}><Icon name="plus" size={17} />记录一个日子</button></div></>}
      {page === 'goals' && <><div className="page-heading with-action"><div><span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>心愿有了位置，<br className="mobile-only" />未来就有了方向。</h1><p>给想做的事一点时间，也一点认真。</p></div><button className="primary-button" onClick={newGoal} disabled={disabled}><Icon name="plus" size={17} />添加心愿</button></div><div className="goal-grid">{journal.goals.map(g => <div key={g.id} className="goal-tile"><CategoryTag category={g.category} /><GoalCard goal={g} open={setPanel} /><p>{g.description}</p><button className="text-button" onClick={() => setPanel({ type: 'goal', item: g })}>看看如何靠近它<Icon name="arrow" size={16} /></button></div>)}</div><div className="gentle-banner"><Icon name="sprout" size={28} /><p>计划可以调整。<br /><span>改变日期前，先看一眼新的储蓄节奏，再决定怎么走。</span></p></div></>}
      {page === 'funds' && <><div className="page-heading with-action"><div><span className="eyebrow">A LITTLE PEACE OF MIND</span><h1>为想要的生活，<br className="mobile-only" />留一份底气。</h1><p>每一笔积蓄，都有自己的节奏。</p></div><button className="primary-button" onClick={newFund} disabled={disabled}><Icon name="plus" size={17} />添加资金</button></div><div className="fund-summary"><div><span>当前总余额</span><strong><small>¥</small>{yuan(total)}</strong><p>示例参考日 2026.10.05</p></div><div><span>随时可用</span><strong>¥{yuan(liquid)}</strong><p>定期本金和锁定利息暂不计入</p></div><div><span>已分配给心愿</span><strong>¥{yuan(allocated)}</strong><p>活期尚未分配 ¥{yuan(liquid - allocated)}</p></div></div><div className="section-heading"><div><span className="eyebrow">MONEY, WITH A PURPOSE</span><h2>我的资金安排</h2></div><span className="subtle">点击调整余额与收益</span></div><div className="fund-list">{journal.funds.map(f => <button key={f.id} className="fund-row" onClick={() => setPanel({ type: 'fund', item: f })}><span className={`fund-icon ${f.liquid ? 'liquid' : ''}`}><Icon name={f.liquid ? 'wallet' : 'lock'} size={24} /></span><span className="fund-name"><strong>{f.name}</strong><span>{f.liquid ? '活期 · 随时可用' : `定期 · ${dateLabel(f.maturityDate)} 到期`}<span className="small-separator">/</span>{f.mode === 'compound' ? '复利' : '单利'}</span></span><span className="fund-rate"><strong>{f.rate.toFixed(2)}<small>%</small></strong><span>年化假设</span></span><span className="fund-value"><strong>¥{yuan(f.principalCents)}</strong><span>参考日余额</span></span><Icon name="chevron" size={17} /></button>)}</div><FinanceCurve funds={journal.funds} /><div className="notice financial-note"><Icon name="leaf" size={20} /><span>收益只是规划假设，不是保证。资金配置变化后，心愿中的月储蓄会重新计算；预测与实际账单分开记录。</span></div></>}
      <footer className="page-footer"><span>拾光 · 好好生活，慢慢记录</span><button onClick={() => setPanel({ type: 'settings' })} className="text-button">本地原型 · 云同步未连接<Icon name="cloud" size={15} /></button></footer>
      </div></main>
    <nav className="mobile-nav" aria-label="手机主要导航">{navItems.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}><Icon name={n.icon} size={21} /><span>{n.short}</span></button>)}<button className="mobile-add" disabled={disabled} aria-label="记下一刻" onClick={() => setPanel({ type: 'new' })}><Icon name="plus" size={23} /><span>记录</span></button></nav>
    {panel && <Modal title={panel.type === 'moment' ? panel.fresh ? '记下一个日子' : '回到那一天' : panel.type === 'goal' ? panel.fresh ? '给未来一个心愿' : '慢慢靠近这个心愿' : panel.type === 'fund' ? panel.fresh ? '给积蓄一个位置' : '安排这笔积蓄' : panel.type === 'settings' ? '把手账调成喜欢的样子' : panel.type === 'cluster' ? '这一段，发生了这些事' : '这一刻，想记下什么？'} subtitle={panel.type === 'moment' ? '事情与感想，分别收藏。' : panel.type === 'new' ? '一个已经发生的日子，或一个正在期待的未来。' : undefined} close={closePanel}>
      {panel.type === 'cluster' && <div className="cluster-list">{panel.items.map(({ kind, item }) => <button key={item.id} onClick={() => setPanel(kind === 'moment' ? { type: 'moment', item: item as Moment } : { type: 'goal', item: item as Goal })}><CategoryTag category={item.category} /><span><strong>{item.title}</strong><small>{dateLabel(item.date)} · {kind === 'moment' ? importanceLabels[(item as Moment).importance] : '未来计划'}</small></span><Icon name="chevron" size={17} /></button>)}</div>}
      {panel.type === 'moment' && <MomentForm key={panel.item.id} item={panel.item} fresh={panel.fresh} save={saveMoment} />}
      {panel.type === 'goal' && <GoalForm key={panel.item.id} item={panel.item} fresh={panel.fresh} journal={journal} save={saveGoal} />}
      {panel.type === 'fund' && <FundForm key={panel.item.id} item={panel.item} journal={journal} save={saveFund} />}
      {panel.type === 'new' && <div className="new-options"><button onClick={newMoment}><span className="option-icon"><Icon name="book" size={26} /></span><span><strong>值得记住的日子</strong><small>记录事情，也记录当时的心情</small></span><Icon name="arrow" size={19} /></button><button onClick={newGoal}><span className="option-icon blue"><Icon name="flag" size={26} /></span><span><strong>对未来的一个期待</strong><small>放上时间轴，慢慢计划与实现</small></span><Icon name="arrow" size={19} /></button></div>}
      {panel.type === 'settings' && <div className="settings-panel"><p className="settings-intro">三种生活的底色，试试哪一种更像你。<br /><span>暂定产品名「拾光」，也可以在设计审阅时调整。</span></p><div className="theme-options">{([{ id: 'paper', title: '暖纸手账', note: '纸色与鼠尾草绿，安静而有温度', colors: ['#f5f2eb', '#566958', '#c79265'] }, { id: 'forest', title: '森林笔记', note: '浅雾绿与深林色，清新、自然', colors: ['#edf1e9', '#41654f', '#94a881'] }, { id: 'dusk', title: '暮色日记', note: '浅燕麦与梅子色，柔软而内敛', colors: ['#f4eef0', '#805d70', '#c1949d'] }] as const).map(t => <button key={t.id} disabled={disabled} className={`theme-option ${journal.theme === t.id ? 'chosen' : ''}`} aria-pressed={journal.theme === t.id} onClick={() => change({ ...journal, theme: t.id }, '手账配色已保存到本机', false)}><span className="swatches">{t.colors.map(c => <i key={c} style={{ background: c }} />)}</span><strong>{t.title}</strong><span>{t.note}</span>{journal.theme === t.id && <Icon name="check" size={17} />}</button>)}</div><div className="settings-storage"><Icon name="cloud" size={25} /><div><h3>这里是本地设计原型</h3><p>云同步尚未接入。编辑仅存于当前浏览器，不会同步到另一台设备。浏览器清理可能删除本地内容，可以先导出留存。</p></div></div><button className="quiet-button export-button" onClick={exportData}><Icon name="download" size={18} />导出原型手账 JSON</button><p className="fine-print">导入恢复、账户登录、真实账单与健康记录在后续分期实现。请先用虚构内容体验流程。</p></div>}
    </Modal>}
    {toast && <div className="toast" role="status"><Icon name="check" size={18} /><span>{toast}</span>{undo && <button onClick={async () => { const previous = undo; if (previous && await change(previous, '已撤销上一次修改', false, false)) setUndo(null) }}>撤销</button>}<button className="icon-button" aria-label="关闭保存提示" onClick={() => { setToast(''); setUndo(null) }}><Icon name="close" size={15} /></button></div>}
  </div>
}
