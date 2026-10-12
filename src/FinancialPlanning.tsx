import { useEffect, useId, useRef, useState } from 'react'
import type { FinancialPlan, Journal } from './model'
import type { cashflowProjection, MonthFlow } from './cashflow'
import { CashFlowTooltip } from './CashFlowTooltip'
import type { Hover } from './CashFlowTooltip'
import { incomeForDisplay } from './income-tax'
import { exactYuan, yuan } from './finance'
import { monthAt, monthIndex, timelineBounds, timelineMarks } from './timeline-range'
import type { TimelineRange } from './timeline-range'

type Projection = ReturnType<typeof cashflowProjection>
export function CashFlowTracks({ journal, result, plan, range, width, position, today, view, select, selected }: { journal: Journal; result: Projection; plan: FinancialPlan; range: TimelineRange; width: number; position: (day: string) => number; today: string; view: 'flows' | 'balance'; select: (month: string) => void; selected: string }) {
  const [hover, setHover] = useState<Hover | null>(null), wrap = useRef<HTMLDivElement>(null), id = useId()
  const { start, end } = timelineBounds(range)
  const future = result.rows.filter(r => Date.parse(r.date) >= start && Date.parse(r.date) < end)
  const actual = (journal.monthlySummaries ?? []).filter(r => r.month < today.slice(0, 7) && monthIndex(r.month) >= monthIndex(range.startMonth) && monthIndex(r.month) < monthIndex(range.startMonth) + range.months)
  const dateForMonth = (month: string) => new Date(Date.parse(`${monthAt(monthIndex(month) + 1)}-01`) - 86400000).toISOString().slice(0, 10)
  const income = future.flatMap(r => { const displayed = r.month === today.slice(0, 7) ? 0 : incomeForDisplay(r.incomeCents, plan); return displayed === null ? [] : [{ date: r.date, value: displayed + r.interestCents }] })
  const expense = future.map(r => ({ date: r.date, value: r.expenseCents }))
  const balances = [{ date: today, value: result.required.openingCents }, ...future.map(r => ({ date: r.date, value: r.balanceCents }))].filter(r => Date.parse(r.date) >= start && Date.parse(r.date) < end)
  const pastIncome = actual.map(r => ({ date: dateForMonth(r.month), value: r.incomeCents })).sort((a, b) => a.date.localeCompare(b.date))
  const pastExpense = actual.map(r => ({ date: dateForMonth(r.month), value: r.expenseCents })).sort((a, b) => a.date.localeCompare(b.date))
  const values = (view === 'balance' ? balances : [...income, ...expense, ...pastIncome, ...pastExpense]).map(r => r.value)
  const min = Math.min(0, ...values), max = Math.max(100, ...values) * 1.08, y = (value: number) => 170 - (value - min) / (max - min) * 140
  const path = (rows: { date: string; value: number }[], sparse = false) => rows.map((r, i) => `${i === 0 || sparse && monthIndex(r.date) - monthIndex(rows[i - 1].date) > 1 ? 'M' : 'L'}${position(r.date)},${y(r.value)}`).join(' ')
  const marker = position(today), futureStart = Math.max(64, Math.min(width - 188, marker))
  useEffect(() => { setHover(null) }, [range.startMonth, range.months, view, result])
  useEffect(() => {
    const dismiss = (event: Event) => { if (!wrap.current?.contains(event.target as Node)) setHover(null) }
    const hide = () => setHover(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('focusin', dismiss); document.addEventListener('keydown', key); window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss); document.removeEventListener('keydown', key); window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide) }
  }, [])
  const inspect = (clientX: number, clientY: number, pinned = false) => {
    const box = wrap.current!.getBoundingClientRect(), x = clientX - box.left
    const stamp = start + (x - 64) / (width - 252) * (end - start)
    if (stamp < start || stamp >= end) { setHover(null); return }
    const month = new Date(stamp).toISOString().slice(0, 7), closing = dateForMonth(month)
    select(month); setHover({ month, x: clientX, y: clientY, pinned, opening: view === 'balance' && month === today.slice(0, 7) && stamp < (Date.parse(today) + Date.parse(closing)) / 2 })
  }
  const hoveredRow = hover && result.rows.find(r => r.month === hover.month), hoveredActual = hover && actual.find(r => r.month === hover.month)
  const hoverDate = hover?.opening ? today : hoveredRow?.date ?? (hover ? dateForMonth(hover.month) : today), hoverX = position(hoverDate)
  const hoverIncome = hoveredRow ? hoveredRow.month === today.slice(0, 7) ? 0 : incomeForDisplay(hoveredRow.incomeCents, plan) : null
  const hoverValues = hover?.opening ? [result.required.openingCents] : view === 'balance' ? hoveredRow ? [hoveredRow.balanceCents] : [] : hoveredRow ? [hoverIncome === null ? null : hoverIncome + hoveredRow.interestCents, hoveredRow.expenseCents] : hoveredActual ? [hoveredActual.incomeCents, hoveredActual.expenseCents] : []
  return <><div className="cashflow-scale" aria-hidden="true"><span className="cashflow-unit">{view === 'flows' ? '月收支 / 元' : '余额 / 元'}</span>{[min, (max + min) / 2, max].map(value => <span key={value} style={{ top: y(value) - 14 }}>{yuan(Math.round(value))}</span>)}</div><div ref={wrap} className="cashflow-plot" style={{ width }} role="group" aria-label="资金曲线，左右键查看月份，回车保留提示，Escape关闭提示" tabIndex={0} aria-describedby={hover ? id : undefined} onPointerDown={e => { if (e.pointerType === 'mouse') e.preventDefault(); inspect(e.clientX, e.clientY, true) }} onPointerMove={e => { if (e.buttons) { setHover(null); return } if (!hover?.pinned && e.pointerType !== 'touch') inspect(e.clientX, e.clientY) }} onPointerLeave={() => setHover(h => h?.pinned ? h : null)} onClick={e => inspect(e.clientX, e.clientY, true)} onKeyDown={e => {
    if (e.key === 'Escape') { setHover(null); return }
    if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) return
    e.preventDefault(); e.stopPropagation()
    const current = monthIndex(hover?.month ?? selected), first = monthIndex(range.startMonth), last = first + range.months - 1
    const month = monthAt(Math.max(first, Math.min(last, current + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0))))
    const box = wrap.current!.getBoundingClientRect(); select(month); setHover({ month, x: Math.max(30, Math.min(innerWidth - 30, box.left + position(dateForMonth(month)))), y: Math.max(30, box.top + 70), opening: false, pinned: true })
  }}><svg className="cashflow-tracks" style={{ width }} viewBox={`0 0 ${width} 220`} role="img" aria-label={view === 'flows' ? '与人生时间轴共用刻度的每月收入和支出实线，含心愿费用' : '与人生时间轴共用刻度的可用资金余额实线'}>
    {Date.parse(today) < end && <><rect x={futureStart} y="22" width={Math.max(0, width - 188 - futureStart)} height="156" fill="var(--hero)" opacity=".5" /><text x={futureStart + 8} y="38">预测</text></>}
    {[min, (max + min) / 2, max].map(value => <line key={value} x1="64" x2={width - 188} y1={y(value)} y2={y(value)} stroke="var(--line)" />)}
    {timelineMarks(range, width - 252).map(mark => <g key={mark.date} data-axis-date={mark.date}><line x1={position(mark.date)} x2={position(mark.date)} y1="24" y2="178" stroke="var(--line)" opacity=".45" /><text x={position(mark.date)} y="206">{mark.label}</text></g>)}
    {marker >= 64 && marker <= width - 188 && <line data-today={today} x1={marker} x2={marker} y1="22" y2="178" stroke="#b48352" />}
    {view === 'flows' ? <><path className="cash-income" data-series="actual-income" d={path(pastIncome, true)} opacity=".65" /><path className="cash-expense" data-series="actual-expense" d={path(pastExpense, true)} opacity=".65" />{pastIncome.map(r => <circle key={r.date} cx={position(r.date)} cy={y(r.value)} r="3" className="cash-income-point" opacity=".65" />)}{pastExpense.map(r => <circle key={r.date} cx={position(r.date)} cy={y(r.value)} r="3" className="cash-expense-point" opacity=".65" />)}<path className="cash-income" data-series="forecast-income" d={path(income)} /><path className="cash-expense" data-series="forecast-expense" d={path(expense)} />{income.length === 1 && <circle cx={position(income[0].date)} cy={y(income[0].value)} r="4" className="cash-income-point" />}{expense.length === 1 && <circle cx={position(expense[0].date)} cy={y(expense[0].value)} r="4" className="cash-expense-point" />}</> : <><path className="cash-balance" data-series="forecast-balance" d={path(balances)} />{balances.length === 1 && <circle cx={position(balances[0].date)} cy={y(balances[0].value)} r="4" className="cash-income-point" />}</>}
    {hover && hoverX >= 64 && hoverX <= width - 188 && <g className="cashflow-crosshair"><line x1={hoverX} x2={hoverX} y1="22" y2="178" stroke="var(--muted)" />{hoverValues.map((value, i) => value === null ? null : <circle key={i} cx={hoverX} cy={y(value)} r="4.5" fill={i === 1 ? '#b47b50' : 'var(--accent)'} stroke="var(--surface)" strokeWidth="2" />)}</g>}
  </svg></div>{hover && <CashFlowTooltip hover={hover} result={result} journal={journal} plan={plan} today={today} id={id} />}</>
}

export function CashFlowDetail({ result, journal, range, selected, change }: { result: Projection; journal: Journal; range: TimelineRange; selected: string; change: (month: string) => void }) {
  const months = Array.from({ length: range.months }, (_, i) => monthAt(monthIndex(range.startMonth) + i))
  const month = months.includes(selected) ? selected : months[0]
  const row: MonthFlow | undefined = result.rows.find(r => r.month === month)
  const actual = journal.monthlySummaries?.find(r => r.month === month)
  return <div className="cashflow-detail"><label>查看月份<select aria-label="查看资金月份" value={month} onChange={e => change(e.target.value)}>{months.map(m => <option key={m} value={m}>{m.replace('-', ' 年 ')} 月</option>)}</select></label><div>{row ? <><span>{month.replace('-', '.')} · 预测</span><p>税后收入 <strong>¥{exactYuan(row.incomeCents)}</strong> · 活期利息 ¥{exactYuan(row.interestCents)}<br />日常开销 ¥{exactYuan(row.dailyExpenseCents)} · 心愿费用 <strong>¥{exactYuan(row.wishExpenseCents)}</strong><br />可用余额 <strong className={row.balanceCents < 0 ? 'negative' : ''}>¥{exactYuan(row.balanceCents)}</strong>{row.maturityCents > 0 && ` · 定期到期释放 ¥${exactYuan(row.maturityCents)}（不计作收入）`}</p>{row.minimumCents < 0 && <p className="negative">本月付款时的资金缺口最多 ¥{exactYuan(-row.minimumCents)}，请调整收入或心愿时间。</p>}{month > result.required.horizon.slice(0, 7) && <p className="planning-extension">这个月在最后一个心愿预算日期之后，继续按相同收入与日常开销试算。</p>}{row.wishes.length > 0 && <ul>{row.wishes.map((w, i) => <li key={`${w.id}-${i}`}>{w.date.replaceAll('-', '.')} · {w.title} · {w.kind === 'once' ? '一次性' : '本月费用'} ¥{exactYuan(w.amountCents)}</li>)}</ul>}</> : actual ? <><span>{month.replace('-', '.')} · 已记录收支</span><p>收入 ¥{exactYuan(actual.incomeCents)} · 支出 ¥{exactYuan(actual.expenseCents)}<br />历史余额未记录，不反推。</p></> : <><span>{month.replace('-', '.')}</span><p>这段过去的收支还未记录。</p></>}</div></div>
}
