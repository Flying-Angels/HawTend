import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Journal } from './model'
import { balanceHistory } from './balance-history'
import type { BalanceHistoryPoint } from './balance-history'
import { calendarTime, shiftCalendarMonth } from './calendar-picker'
import { exactYuan } from './finance'
import { useToday } from './useToday'
import './balance-history.css'

const colors = ['#6b83a5', '#b77b57', '#609c94', '#9c80a5', '#bc9b46', '#7095ad', '#b57c91', '#8e9d61', '#a2866b', '#718bb1']
const money = (value: number) => `¥${exactYuan(value)}`
const dateLabel = (date: string) => date.replaceAll('-', '.')
const axisMoney = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })
const ranges = [{ months: 3, label: '近 3 个月' }, { months: 12, label: '近 1 年' }, { months: 0, label: '全部' }]

export function BalanceHistory({ journal }: { journal: Journal }) {
  const today = useToday(), detailId = useId()
  const history = useMemo(() => balanceHistory(journal), [journal])
  const [range, setRange] = useState(3), [selected, setSelected] = useState('')
  const [hidden, setHidden] = useState(new Set<string | null>())
  const since = shiftCalendarMonth(today, -range)
  const points = history.points.filter(p => p.date <= today && (range === 0 || p.date >= since))
  const accounts = history.accounts.map((a, i) => ({ ...a, color: colors[i % colors.length] }))
  const visible = accounts.filter(a => !hidden.has(a.id))
  const current = points.find(p => p.date === selected) ?? points.at(-1)
  const complete = points.filter(p => p.totalCents !== null)
  const first = complete[0], last = complete.at(-1)
  const change = last && first && last !== first ? last.totalCents! - first.totalCents! : null
  const toggle = (id: string | null) => setHidden(value => {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return <section className="balance-history" aria-label="总余额与账户变化">
    <header className="balance-history-heading"><div><h2>总余额与账户变化</h2><p>每次核对，看看余额的变化。</p></div><div className="balance-history-range" role="group" aria-label="余额图时间范围">{ranges.map(({ months, label }) => <button key={months} aria-pressed={range === months} onClick={() => { setRange(months); setSelected('') }}>{label}</button>)}</div></header>
    {points.length > 0 && current ? <>
      <div className="balance-history-summary"><div><span>{last ? `${dateLabel(last.date)} · 最近完整核对` : '尚未核对齐同一天的账户'}</span><strong>{last ? money(last.totalCents!) : '待核对'}</strong></div>{change !== null && <div><span>较 {dateLabel(first.date)}</span><b className={change < 0 ? 'balance-decrease' : ''}>{change > 0 ? '+' : ''}{money(change)}</b></div>}</div>
      <div className="balance-history-body">
        <BalancePlot points={points} accounts={visible} current={current} select={setSelected} detailId={detailId} />
        <div className="balance-history-detail" id={detailId}>
          <label>查看核对日期<select value={current.date} onChange={e => setSelected(e.target.value)}>{points.map(p => <option value={p.date} key={p.date}>{dateLabel(p.date)}</option>)}</select></label>
          <dl><div className="balance-detail-total"><dt><i />总余额</dt><dd>{current.totalCents === null ? '待补齐' : money(current.totalCents)}</dd></div>{accounts.map(a => <div key={JSON.stringify(a.id)} style={{ '--balance-color': a.color } as CSSProperties}><dt><i />{a.name}{!a.active && <small>（已归档）</small>}</dt><dd>{current.balances.has(a.id) ? money(current.balances.get(a.id)!) : '当天未记录'}</dd></div>)}</dl>
          {current.missing.length > 0 && <p>该日还缺 {current.missing.length} 个账户，总余额待补齐。</p>}
        </div>
      </div>
      <div className="balance-history-legend" role="group" aria-label="显示的账户曲线"><span><i className="balance-total-swatch" />总余额</span>{accounts.map(a => <button key={JSON.stringify(a.id)} aria-pressed={!hidden.has(a.id)} onClick={() => toggle(a.id)} style={{ '--balance-color': a.color } as CSSProperties}><i />{a.name}</button>)}</div>
      <p className="balance-history-note">含账户内现金、存款与基金。实线连接已记录余额，悬停或轻点查看金额，点账户名称可隐藏曲线。键盘左右键切换日期。余额变化包含收入、消费与投资盈亏。</p>
    </> : <div className="balance-history-empty"><p>{history.points.length ? '这段时间还没有余额记录，选择「全部」查看以前的核对。' : '记下各账户的余额后，这里会连起总余额和每个账户的变化。'}</p></div>}
  </section>
}

function BalancePlot({ points, accounts, current, select, detailId }: {
  points: BalanceHistoryPoint[]; accounts: { id: string | null; name: string; color: string }[]
  current: BalanceHistoryPoint; select: (date: string) => void; detailId: string
}) {
  const plot = useRef<HTMLDivElement>(null), [width, setWidth] = useState(700)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width)))
    if (plot.current) observer.observe(plot.current)
    return () => observer.disconnect()
  }, [])
  const left = 52, right = width - 18, top = 22, bottom = 252
  const start = calendarTime(points[0].date), end = calendarTime(points.at(-1)!.date)
  const x = (date: string) => end === start ? (left + right) / 2 : left + (calendarTime(date) - start) / (end - start) * (right - left)
  let ceiling = 100
  for (const point of points) {
    ceiling = Math.max(ceiling, point.totalCents ?? 0)
    for (const account of accounts) ceiling = Math.max(ceiling, point.balances.get(account.id) ?? 0)
  }
  const max = ceiling * 1.08
  const y = (value: number) => bottom - value / max * (bottom - top)
  const totals = points.filter(p => p.totalCents !== null)
  const marks = [...new Set([points[0].date, ...(width > 500 ? [points[Math.floor((points.length - 1) / 2)].date] : []), points.at(-1)!.date])]
  const inspect = (clientX: number) => {
    const bounds = plot.current!.getBoundingClientRect()
    const target = clientX - bounds.left
    const nearest = points.reduce((best, p) => Math.abs(x(p.date) - target) < Math.abs(x(best.date) - target) ? p : best)
    select(nearest.date)
  }
  return <div className="balance-history-plot" ref={plot} tabIndex={0} role="group" aria-label="余额折线图，左右键选择核对日期" aria-describedby={detailId}
    onPointerMove={e => { if (e.pointerType === 'mouse' && !e.buttons) inspect(e.clientX) }} onPointerDown={e => inspect(e.clientX)} onKeyDown={e => {
      const index = points.findIndex(p => p.date === current.date)
      const targets: Record<string, number> = { ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(points.length - 1, index + 1), Home: 0, End: points.length - 1 }
      if (e.key in targets) { e.preventDefault(); select(points[targets[e.key]].date) }
    }}>
    <svg viewBox={`0 0 ${width} 294`} role="img" aria-label="粗实线为总余额，彩色细实线为各账户余额，圆点为实际核对记录">
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={right} y1={y(max * fraction)} y2={y(max * fraction)} stroke="var(--line)" /><text x={left - 9} y={y(max * fraction) + 4} textAnchor="end">{axisMoney.format(max * fraction / 100)}</text></g>)}
      {marks.map((date, i) => <text key={date} x={x(date)} y={bottom + 28} textAnchor={marks.length === 1 ? 'middle' : i === 0 ? 'start' : i === marks.length - 1 ? 'end' : 'middle'}>{dateLabel(date)}</text>)}
      {accounts.map(a => {
        const recorded = points.filter(p => p.balances.has(a.id))
        return <g key={JSON.stringify(a.id)} className="balance-account-line" data-account={a.id ?? 'unassigned'} stroke={a.color} fill={a.color}>
          <polyline points={recorded.map(p => `${x(p.date)},${y(p.balances.get(a.id)!)}`).join(' ')} fill="none" strokeWidth="1.5" />
          {recorded.map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.balances.get(a.id)!)} r={p.date === current.date ? 3.5 : 2.2}><title>{dateLabel(p.date)} · {a.name} · {money(p.balances.get(a.id)!)}</title></circle>)}
        </g>
      })}
      <g className="balance-total-line" stroke="var(--accent)" fill="var(--accent)">
        <polyline points={totals.map(p => `${x(p.date)},${y(p.totalCents!)}`).join(' ')} fill="none" strokeWidth="3.5" />
        {totals.map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.totalCents!)} r={p.date === current.date ? 5 : 3.5} stroke="var(--surface)" strokeWidth="2"><title>{dateLabel(p.date)} · 总余额 · {money(p.totalCents!)}</title></circle>)}
      </g>
      <line className="balance-crosshair" x1={x(current.date)} x2={x(current.date)} y1={top} y2={bottom} stroke="var(--muted)" />
    </svg>
  </div>
}
