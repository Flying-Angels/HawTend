import { useState } from 'react'
import type { FinancialPlan, Journal } from './model'
import type { cashflowProjection, MonthFlow } from './cashflow'
import { isFinancialPlan } from './cashflow'
import { cents, exactYuan, yuan } from './finance'
import { goalStatus } from './goals'
import { Icon } from './Icons'
import { monthAt, monthIndex, timelineBounds, timelineMarks } from './timeline-range'
import type { TimelineRange } from './timeline-range'

type Projection = ReturnType<typeof cashflowProjection>
export function FinancialPlanning({ journal, plan, update, save, result, view, setView, busy, sample, today }: {
  journal: Journal; plan: FinancialPlan; update: (plan: FinancialPlan) => void; save: (plan: FinancialPlan) => Promise<boolean>; result: Projection; view: 'flows' | 'balance'; setView: (view: 'flows' | 'balance') => void; busy: boolean; sample: boolean; today: string
}) {
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const active = journal.goals.filter(g => goalStatus(g) !== 'done')
  const recurring = active.filter(g => g.date >= today && (g.monthlyBudgetCents ?? 0) > 0)
  const futureBudget = active.some(g => g.date >= today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0))
  const overdue = active.filter(g => g.date < today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0))
  const unbudgeted = active.filter(g => g.date >= today && !g.budgetCents && !g.monthlyBudgetCents)
  const recent = [...(journal.monthlySummaries ?? [])].filter(r => r.month < today.slice(0, 7)).sort((a, b) => b.month.localeCompare(a.month))[0]
  const { required } = result
  const submit = async () => {
    if (!isFinancialPlan(plan)) { setError('请检查金额和年化假设。'); return }
    setError(''); setPending(true); const ok = await save(plan); setPending(false)
    if (!ok) setError('规划未保存，试算内容仍在这里，请重试。')
  }
  return <div className="financial-planning">
    <div className="income-summary" aria-label="期望月收入试算"><div><span>规划所需的期望月收入</span><strong>{required.incomeCents === null ? '本月需先补资金' : `¥${exactYuan(required.incomeCents)}`}<small>{required.incomeCents !== null && '/ 月 · 税后'}</small></strong><p>按当前假设覆盖已填预算的心愿，付款时余额不低于 0。</p></div><div><span>计入的现有可用资金</span><strong>¥{exactYuan(required.openingCents)}</strong><p>按记录余额起算，定期到期后再加入。{required.excludedCents > 0 && `手动市值 ¥${exactYuan(required.excludedCents)} 暂未计入。`}</p></div><div><span>测算截至</span><strong className="income-horizon">{required.horizon.replaceAll('-', '.')}</strong><p>{futureBudget ? '截至最后一个已填预算的未来心愿。' : '还没有未来预算，先试算未来 12 个月。'}浏览范围不改变测算期限。</p></div></div>
    {required.upfrontShortfallCents > 0 && <p className="notice" role="status">本月的一次性心愿还缺 ¥{exactYuan(required.upfrontShortfallCents)}。下个月的收入无法覆盖本月付款，请先调整时间或补充资金。</p>}
    {!journal.financialPlan && !recent && <p className="planning-hint">还没有日常开销参考值，目前只计算心愿费用。展开“规划假设”补充每月日常开销后，收入测算会更完整。</p>}
    {(overdue.length > 0 || unbudgeted.length > 0) && <p className="planning-hint">{overdue.length > 0 && `${overdue.length} 个已过日期的未完成心愿暂未计入，请调整日期或标为已完成。`}{unbudgeted.length > 0 && `${unbudgeted.length} 个未来心愿还没有预算，补充后才会计入费用。`}</p>}
    <details className="planning-assumptions"><summary><Icon name="settings" size={16} /><span>规划假设</span><small>活期年化 {plan.annualRate.toFixed(2)}% · 复利</small><Icon name="chevron" size={15} /></summary><div className="planning-fields">
      <div className="form-grid"><label>每月日常开销 / 元<input aria-label="规划每月日常开销" type="number" min="0" max="100000000" step=".01" value={plan.monthlyExpenseCents / 100} onChange={e => update({ ...plan, monthlyExpenseCents: cents(e.target.value) })} /></label><label>活期年化假设 / %<input aria-label="规划活期年化" type="number" min="0" max="30" step=".01" value={plan.annualRate} onChange={e => update({ ...plan, annualRate: Number(e.target.value) })} /></label></div>
      <p>日常开销{!journal.financialPlan && recent ? `默认参考 ${recent.month.replace('-', '.')} 的实际支出` : '包含生活费、还贷等必要花费'}。已包含在其中的心愿月费用，请在下方标记，避免重复计算。</p>
      {recurring.length > 0 && <div className="included-wishes" role="group" aria-label="已包含在日常开销中的心愿">{recurring.map(g => <label key={g.id}><input type="checkbox" checked={plan.includedMonthlyGoalIds?.includes(g.id) ?? false} onChange={e => update({ ...plan, includedMonthlyGoalIds: e.target.checked ? [...(plan.includedMonthlyGoalIds ?? []), g.id] : (plan.includedMonthlyGoalIds ?? []).filter(id => id !== g.id) })} /><span>“{g.title}”的每月 ¥{exactYuan(g.monthlyBudgetCents!)} 已包含在日常开销中</span></label>)}</div>}
      <label className="planning-check"><input type="checkbox" checked={plan.includeRedeemable ?? false} onChange={e => update({ ...plan, includeRedeemable: e.target.checked })} /><span>把可赎回基金按最新市值计入可用资金</span></label><p>默认不计入手动市值资产；选中后假设按记录市值变为现金，不预测基金涨跌。可用现金统一按上方年化复利试算，定期在到期前沿用原配置；这里不会自动投资。</p>
      <div className="planning-income-mode" role="group" aria-label="曲线收入来源"><button className={plan.monthlyIncomeCents === undefined ? 'selected' : ''} aria-pressed={plan.monthlyIncomeCents === undefined} onClick={() => update({ ...plan, monthlyIncomeCents: undefined })}>使用期望收入</button><button className={plan.monthlyIncomeCents !== undefined ? 'selected' : ''} aria-pressed={plan.monthlyIncomeCents !== undefined} onClick={() => update({ ...plan, monthlyIncomeCents: recent?.incomeCents ?? result.monthlyIncomeCents })}>自填收入试算</button></div>
      {plan.monthlyIncomeCents !== undefined && <label className="planning-custom-income">每月税后收入 / 元<input aria-label="规划每月税后收入" type="number" min="0" max="100000000" step=".01" value={plan.monthlyIncomeCents / 100} onChange={e => update({ ...plan, monthlyIncomeCents: cents(e.target.value) })} /></label>}
      <div className="planning-save"><span>{sample ? '样例中的假设仅用于本次体验' : '修改先试算，保存后才记住假设'}</span><button className="quiet-button" disabled={busy || pending} onClick={submit}>{pending ? '正在保存…' : '保存规划假设'}<Icon name="check" size={15} /></button></div>{error && <p role="alert" className="form-error">{error}</p>}
    </div></details>
    <div className="cashflow-heading"><div className="cashflow-switch" role="group" aria-label="资金曲线类型"><button aria-pressed={view === 'flows'} onClick={() => setView('flows')}>月收入与支出</button><button aria-pressed={view === 'balance'} onClick={() => setView('balance')}>可用资金余额</button></div><div className="cashflow-legend">{view === 'flows' ? <><span><i className="income" />收入含活期利息</span><span><i className="expense" />日常与心愿支出</span></> : <span><i className="balance" />可用余额</span>}</div></div>
    <p className="planning-hint">汇总全部账户与心愿，分类筛选只影响节点。本月只计尚未完成的一次性心愿；整月收入与日常费用从下个月起算，假设收入月初到账。阴影区为预测，历史收支来自月度记录。</p>
  </div>
}

export function CashFlowTracks({ journal, result, range, width, position, today, view, select }: { journal: Journal; result: Projection; range: TimelineRange; width: number; position: (day: string) => number; today: string; view: 'flows' | 'balance'; select: (month: string) => void }) {
  const { start, end } = timelineBounds(range)
  const future = result.rows.filter(r => Date.parse(r.date) >= start && Date.parse(r.date) < end)
  const actual = (journal.monthlySummaries ?? []).filter(r => r.month < today.slice(0, 7) && monthIndex(r.month) >= monthIndex(range.startMonth) && monthIndex(r.month) < monthIndex(range.startMonth) + range.months)
  const dateForMonth = (month: string) => new Date(Date.parse(`${monthAt(monthIndex(month) + 1)}-01`) - 86400000).toISOString().slice(0, 10)
  const income = future.map(r => ({ date: r.date, value: r.incomeCents + r.interestCents }))
  const expense = future.map(r => ({ date: r.date, value: r.expenseCents }))
  const balances = [{ date: today, value: result.required.openingCents }, ...future.map(r => ({ date: r.date, value: r.balanceCents }))].filter(r => Date.parse(r.date) >= start && Date.parse(r.date) < end)
  const pastIncome = actual.map(r => ({ date: dateForMonth(r.month), value: r.incomeCents })).sort((a, b) => a.date.localeCompare(b.date))
  const pastExpense = actual.map(r => ({ date: dateForMonth(r.month), value: r.expenseCents })).sort((a, b) => a.date.localeCompare(b.date))
  const values = (view === 'balance' ? balances : [...income, ...expense, ...pastIncome, ...pastExpense]).map(r => r.value)
  const min = Math.min(0, ...values), max = Math.max(100, ...values) * 1.08, y = (value: number) => 170 - (value - min) / (max - min) * 140
  const path = (rows: { date: string; value: number }[], sparse = false) => rows.map((r, i) => `${i === 0 || sparse && monthIndex(r.date) - monthIndex(rows[i - 1].date) > 1 ? 'M' : 'L'}${position(r.date)},${y(r.value)}`).join(' ')
  const marker = position(today), futureStart = Math.max(64, Math.min(width - 188, marker))
  return <><div className="cashflow-scale" aria-hidden="true"><span className="cashflow-unit">{view === 'flows' ? '月收支 / 元' : '余额 / 元'}</span>{[min, (max + min) / 2, max].map(value => <span key={value} style={{ top: y(value) - 14 }}>{yuan(Math.round(value))}</span>)}</div><svg className="cashflow-tracks" style={{ width }} viewBox={`0 0 ${width} 220`} role="img" aria-label={view === 'flows' ? '与人生时间轴共用刻度的每月收入和支出实线，含心愿费用' : '与人生时间轴共用刻度的可用资金余额实线'} onPointerMove={event => {
    const box = event.currentTarget.getBoundingClientRect(), x = event.clientX - box.left
    const stamp = start + (x - 64) / (width - 252) * (end - start)
    if (stamp >= start && stamp < end) select(new Date(stamp).toISOString().slice(0, 7))
  }}>
    {Date.parse(today) < end && <><rect x={futureStart} y="22" width={Math.max(0, width - 188 - futureStart)} height="156" fill="var(--hero)" opacity=".5" /><text x={futureStart + 8} y="38">预测</text></>}
    {[min, (max + min) / 2, max].map(value => <line key={value} x1="64" x2={width - 188} y1={y(value)} y2={y(value)} stroke="var(--line)" />)}
    {timelineMarks(range, width - 252).map(mark => <g key={mark.date} data-axis-date={mark.date}><line x1={position(mark.date)} x2={position(mark.date)} y1="24" y2="178" stroke="var(--line)" opacity=".45" /><text x={position(mark.date)} y="206">{mark.label}</text></g>)}
    {marker >= 64 && marker <= width - 188 && <line data-today={today} x1={marker} x2={marker} y1="22" y2="178" stroke="#b48352" />}
    {view === 'flows' ? <><path className="cash-income" data-series="actual-income" d={path(pastIncome, true)} opacity=".65" /><path className="cash-expense" data-series="actual-expense" d={path(pastExpense, true)} opacity=".65" />{pastIncome.map(r => <circle key={r.date} cx={position(r.date)} cy={y(r.value)} r="3" className="cash-income-point" opacity=".65" />)}{pastExpense.map(r => <circle key={r.date} cx={position(r.date)} cy={y(r.value)} r="3" className="cash-expense-point" opacity=".65" />)}<path className="cash-income" data-series="forecast-income" d={path(income)} /><path className="cash-expense" data-series="forecast-expense" d={path(expense)} />{future.length === 1 && <><circle cx={position(future[0].date)} cy={y(income[0].value)} r="4" className="cash-income-point" /><circle cx={position(future[0].date)} cy={y(expense[0].value)} r="4" className="cash-expense-point" /></>}</> : <><path className="cash-balance" data-series="forecast-balance" d={path(balances)} />{balances.length === 1 && <circle cx={position(balances[0].date)} cy={y(balances[0].value)} r="4" className="cash-income-point" />}</>}
  </svg></>
}

export function CashFlowDetail({ result, journal, range, selected, change }: { result: Projection; journal: Journal; range: TimelineRange; selected: string; change: (month: string) => void }) {
  const months = Array.from({ length: range.months }, (_, i) => monthAt(monthIndex(range.startMonth) + i))
  const month = months.includes(selected) ? selected : months[0]
  const row: MonthFlow | undefined = result.rows.find(r => r.month === month)
  const actual = journal.monthlySummaries?.find(r => r.month === month)
  return <div className="cashflow-detail"><label>查看月份<select aria-label="查看资金月份" value={month} onChange={e => change(e.target.value)}>{months.map(m => <option key={m} value={m}>{m.replace('-', ' 年 ')} 月</option>)}</select></label><div>{row ? <><span>{month.replace('-', '.')} · 预测</span><p>税后收入 <strong>¥{exactYuan(row.incomeCents)}</strong> · 活期利息 ¥{exactYuan(row.interestCents)}<br />日常开销 ¥{exactYuan(row.dailyExpenseCents)} · 心愿费用 <strong>¥{exactYuan(row.wishExpenseCents)}</strong><br />可用余额 <strong className={row.balanceCents < 0 ? 'negative' : ''}>¥{exactYuan(row.balanceCents)}</strong>{row.maturityCents > 0 && ` · 定期到期释放 ¥${exactYuan(row.maturityCents)}（不计作收入）`}</p>{row.minimumCents < 0 && <p className="negative">本月付款时的资金缺口最多 ¥{exactYuan(-row.minimumCents)}，请调整收入或心愿时间。</p>}{row.date > result.required.horizon && <p>已超出上述收入测算期限；这里延续相同收入与开销假设，之后仍可能出现缺口。</p>}{row.wishes.length > 0 && <ul>{row.wishes.map((w, i) => <li key={`${w.id}-${i}`}>{w.title} · {w.kind === 'once' ? '一次性' : '本月费用'} ¥{exactYuan(w.amountCents)}</li>)}</ul>}</> : actual ? <><span>{month.replace('-', '.')} · 已记录收支</span><p>收入 ¥{exactYuan(actual.incomeCents)} · 支出 ¥{exactYuan(actual.expenseCents)}<br />历史余额未记录，不反推。</p></> : <><span>{month.replace('-', '.')}</span><p>这段过去的收支还未记录。</p></>}</div></div>
}
