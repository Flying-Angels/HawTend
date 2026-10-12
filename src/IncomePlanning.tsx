import { useRef, useState } from 'react'
import type { FinancialPlan, Journal } from './model'
import type { cashflowProjection } from './cashflow'
import { isFinancialPlan } from './cashflow'
import { cents, exactYuan } from './finance'
import { goalStatus } from './goals'
import { grossForNet, salaryDeductions, salaryFromGross, withIncomeBasis, withSalaryDeductions } from './income-tax'
import { Icon } from './Icons'

export type Projection = ReturnType<typeof cashflowProjection>
export interface PlanningProps {
  journal: Journal; plan: FinancialPlan; update: (plan: FinancialPlan) => void; save: (plan: FinancialPlan) => Promise<boolean>; result: Projection; busy: boolean; sample: boolean; today: string
}
export const moneyLabel = (value: number | null) => value === null ? '需另行估算' : `¥${exactYuan(value)}`
export function IncomeBasis({ plan, update }: Pick<PlanningProps, 'plan' | 'update'>) {
  return <div className="income-basis" role="group" aria-label="收入显示口径"><button aria-pressed={plan.incomeBasis !== 'gross'} onClick={() => update(withIncomeBasis(plan, 'net'))}>税后到账</button><button aria-pressed={plan.incomeBasis === 'gross'} onClick={() => update(withIncomeBasis(plan, 'gross'))}>税前估算</button></div>
}
export function IncomePlanning({ journal, plan, update, save, result, busy, sample, today, openTimeline }: PlanningProps & { openTimeline: () => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const settings = useRef<HTMLDetailsElement>(null), expenses = useRef<HTMLInputElement>(null)
  const active = journal.goals.filter(g => goalStatus(g) !== 'done')
  const recurring = active.filter(g => g.date >= today && (g.monthlyBudgetCents ?? 0) > 0)
  const futureBudget = active.some(g => g.date >= today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0))
  const overdue = active.filter(g => g.date < today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0))
  const unbudgeted = active.filter(g => g.date >= today && !g.budgetCents && !g.monthlyBudgetCents)
  const recent = [...(journal.monthlySummaries ?? [])].filter(r => r.month < today.slice(0, 7)).sort((a, b) => b.month.localeCompare(a.month))[0]
  const needsExpense = !journal.financialPlan && !recent && plan.monthlyExpenseCents === 0
  const { required } = result, deductions = salaryDeductions(plan), gross = plan.incomeBasis === 'gross'
  const requiredGross = required.incomeCents === null ? null : grossForNet(required.incomeCents, deductions)
  const displayed = gross ? requiredGross : required.incomeCents
  const editExpenses = () => { if (settings.current) settings.current.open = true; expenses.current?.focus() }
  const submit = async () => {
    if (!isFinancialPlan(plan)) { setError('请检查金额、年化与收入估算设置。'); return }
    setError(''); setPending(true)
    try { if (!await save(plan)) setError('规划未保存，试算内容仍在这里，请重试。') }
    finally { setPending(false) }
  }
  const useCustom = () => { const net = recent?.incomeCents ?? result.monthlyIncomeCents; update({ ...plan, monthlyIncomeCents: net, grossMonthlyIncomeCents: gross ? grossForNet(net, deductions) ?? undefined : undefined }) }
  const customValue = gross ? plan.grossMonthlyIncomeCents ?? grossForNet(plan.monthlyIncomeCents ?? 0, deductions) : plan.monthlyIncomeCents
  return <section className="financial-planning income-planning" aria-label="收入目标与规划假设">
    <div className="income-planning-heading"><div><span className="eyebrow">A CLEARER PICTURE OF TOMORROW</span><h2>为想做的事，算一份收入目标</h2></div><button className="quiet-button" onClick={openTimeline}>到时间轴查看曲线<Icon name="arrow" size={16} /></button></div>
    <div className="income-summary" aria-label="期望月收入试算"><div className="income-primary"><span>规划所需的期望月收入</span><IncomeBasis plan={plan} update={update} /><strong>{needsExpense ? '先补充日常开销' : required.incomeCents === null ? '本月需先补资金' : moneyLabel(displayed)}<small>{!needsExpense && required.incomeCents !== null && `/ 月 · ${gross ? '税前估算' : '税后到账'}`}</small></strong>{needsExpense ? <p>目前只算已填的心愿预算，暂不能作为完整收入目标。<button className="text-button" onClick={editExpenses}>补充每月开销<Icon name="arrow" size={13} /></button></p> : <p>{required.incomeCents === 0 ? '现有资金已能覆盖本次预算，期限内无需额外收入。' : '结合现有资金，覆盖日常与心愿费用。'}<br />{gross ? `对应税后到账 ${moneyLabel(required.incomeCents)}` : `对应税前估算 ${moneyLabel(requiredGross)}`}</p>}</div><div><span>计入的现有可用资金</span><strong>¥{exactYuan(required.openingCents)}</strong><p>按记录余额起算，定期到期后再加入。{required.excludedCents > 0 && `手动市值 ¥${exactYuan(required.excludedCents)} 暂未计入。`}</p></div><div><span>心愿预算算到</span><strong className="income-horizon">{required.horizon.replaceAll('-', '.')}</strong><p>{futureBudget ? '最后一个已填预算的未来心愿日期。' : '还没有未来预算，先试算未来 12 个月。'}这是预算范围，浏览更远的日期仍能看曲线。</p></div></div>
    {required.upfrontShortfallCents > 0 && <p className="notice" role="status">本月的一次性心愿还缺 ¥{exactYuan(required.upfrontShortfallCents)}。下个月的收入无法覆盖本月付款，请先调整时间或补充资金。</p>}
    {(overdue.length > 0 || unbudgeted.length > 0) && <p className="planning-hint">{overdue.length > 0 && `${overdue.length} 个已过日期的未完成心愿暂未计入，请调整日期或标为已完成。`}{unbudgeted.length > 0 && `${unbudgeted.length} 个未来心愿还没有预算，补充后才会计入费用。`}</p>}
    <details ref={settings} className="planning-assumptions"><summary><Icon name="settings" size={16} /><span>规划假设与收入换算</span><small>活期年化 {plan.annualRate.toFixed(2)}% · 复利</small><Icon name="chevron" size={15} /></summary><div className="planning-fields">
      <div className="form-grid"><label>每月日常开销 / 元<input ref={expenses} aria-label="规划每月日常开销" type="number" min="0" max="100000000" step=".01" value={plan.monthlyExpenseCents / 100} onChange={e => update({ ...plan, monthlyExpenseCents: cents(e.target.value) })} /></label><label>活期年化假设 / %<input aria-label="规划活期年化" type="number" min="0" max="30" step=".01" value={plan.annualRate} onChange={e => update({ ...plan, annualRate: Number(e.target.value) })} /></label></div>
      <p>日常开销{!journal.financialPlan && recent ? `默认参考 ${recent.month.replace('-', '.')} 的实际支出` : '包含生活费、还贷等必要花费'}。已包含在其中的心愿月费用，请在下方标记，避免重复计算。</p>
      {recurring.length > 0 && <div className="included-wishes" role="group" aria-label="已包含在日常开销中的心愿">{recurring.map(g => <label key={g.id}><input type="checkbox" checked={plan.includedMonthlyGoalIds?.includes(g.id) ?? false} onChange={e => update({ ...plan, includedMonthlyGoalIds: e.target.checked ? [...(plan.includedMonthlyGoalIds ?? []), g.id] : (plan.includedMonthlyGoalIds ?? []).filter(id => id !== g.id) })} /><span>“{g.title}”的每月 ¥{exactYuan(g.monthlyBudgetCents!)} 已包含在日常开销中</span></label>)}</div>}
      <label className="planning-check"><input type="checkbox" checked={plan.includeRedeemable ?? false} onChange={e => update({ ...plan, includeRedeemable: e.target.checked })} /><span>把可赎回基金按最新市值计入可用资金</span></label><p>默认不计入手动市值资产；选中后假设按记录市值变为现金，不预测基金涨跌。可用现金统一按上方年化复利试算，定期在到期前沿用原配置；这里不会自动投资。</p>
      <div className="salary-settings"><h3>税前与税后怎么换算</h3><div className="form-grid"><label>个人社保、公积金 / 元·月<input aria-label="每月个人社保与公积金" type="number" min="0" max="100000000" step=".01" value={deductions.monthlyEmployeeCents / 100} onChange={e => update(withSalaryDeductions(plan, { ...deductions, monthlyEmployeeCents: cents(e.target.value) }))} /></label><label>专项附加扣除 / 元·月<input aria-label="每月专项附加扣除" type="number" min="0" max="100000000" step=".01" value={deductions.monthlyAdditionalCents / 100} onChange={e => update(withSalaryDeductions(plan, { ...deductions, monthlyAdditionalCents: cents(e.target.value) }))} /></label></div><p>个人缴费会减少到账额；专项附加扣除只减少计税金额，不再当支出。默认均为 0，请按工资单填个人实际缴费与可扣除额度。</p><p>按中国大陆居民工资、全年均匀收入估算年税并均摊到月；未加入年终奖、其他所得或逐月累计预扣差异。规则参考 <a href="https://www.chinatax.gov.cn/n810219/n810744/n3752930/n3752974/c3970366/content.html" target="_blank" rel="noreferrer">税务总局</a>，现金余额始终按税后可用收入计算。</p></div>
      <div className="planning-income-mode" role="group" aria-label="曲线收入来源"><button className={plan.monthlyIncomeCents === undefined ? 'selected' : ''} aria-pressed={plan.monthlyIncomeCents === undefined} onClick={() => update({ ...plan, monthlyIncomeCents: undefined, grossMonthlyIncomeCents: undefined })}>使用期望收入</button><button className={plan.monthlyIncomeCents !== undefined ? 'selected' : ''} aria-pressed={plan.monthlyIncomeCents !== undefined} onClick={useCustom}>自填收入试算</button></div>
      {plan.monthlyIncomeCents !== undefined && <><label className="planning-custom-income">每月{gross ? '税前收入' : '税后到账'} / 元<input aria-label={gross ? '规划每月税前收入' : '规划每月税后收入'} type="number" min="0" max="100000000" step=".01" value={customValue === null || customValue === undefined ? '' : customValue / 100} onChange={e => { const amount = cents(e.target.value); update(gross ? { ...plan, grossMonthlyIncomeCents: amount, monthlyIncomeCents: salaryFromGross(amount, deductions).netCents } : { ...plan, monthlyIncomeCents: amount, grossMonthlyIncomeCents: undefined }) }} /></label><p className="custom-income-result">曲线按此收入试算：税后可用 ¥{exactYuan(result.monthlyIncomeCents)} / 月；上方仍展示预算所需的收入目标。</p></>}
      <div className="planning-save"><span>{sample ? '样例中的假设仅用于本次体验' : '修改先试算，保存后才记住假设'}</span><button className="quiet-button" disabled={busy || pending} onClick={submit}>{pending ? '正在保存…' : '保存规划假设'}<Icon name="check" size={15} /></button></div>{error && <p role="alert" className="form-error">{error}</p>}
    </div></details>
  </section>
}
export function TimelineIncome({ plan, result, journal, today, edit }: Pick<PlanningProps, 'plan' | 'result' | 'journal' | 'today'> & { edit: () => void }) {
  const net = result.required.incomeCents, gross = net === null ? null : grossForNet(net, salaryDeductions(plan))
  const missing = !journal.financialPlan && !journal.monthlySummaries?.some(r => r.month < today.slice(0, 7)) && plan.monthlyExpenseCents === 0
  return <div className="timeline-income-strip"><div><span>期望月收入</span><strong>{missing ? '先补充日常开销' : net === null ? '本月需先补资金' : `${moneyLabel(plan.incomeBasis === 'gross' ? gross : net)} / 月`}</strong><small>{missing ? '仅有心愿预算，收入目标尚不完整' : `${plan.incomeBasis === 'gross' ? '税前估算' : '税后到账'} · 心愿预算算到 ${result.required.horizon.replaceAll('-', '.')}`}</small></div><button className="quiet-button" onClick={edit}>调整收入测算<Icon name="arrow" size={15} /></button></div>
}
export function CashFlowControls({ plan, update, view, setView }: Pick<PlanningProps, 'plan' | 'update'> & { view: 'flows' | 'balance'; setView: (view: 'flows' | 'balance') => void }) {
  const gross = plan.incomeBasis === 'gross'
  return <div className="cashflow-controls"><div className="cashflow-heading"><div className="cashflow-switch" role="group" aria-label="资金曲线类型"><button aria-pressed={view === 'flows'} onClick={() => setView('flows')}>月收入与支出</button><button aria-pressed={view === 'balance'} onClick={() => setView('balance')}>可用资金余额</button></div>{view === 'flows' && <IncomeBasis plan={plan} update={update} />}<div className="cashflow-legend">{view === 'flows' ? <><span><i className="income" />{gross ? '税前估算' : '到账收入'} + 活期利息</span><span><i className="expense" />日常与心愿支出</span></> : <span><i className="balance" />税后可用余额</span>}</div></div><p className="planning-hint">悬停查看月份与金额，点选可保留提示；手机可轻点，键盘可用左右键查看。曲线按月汇总，心愿保留具体日期。{gross && '税前仅换算未来收入；历史仍为实际记录，余额始终按税后计算。'}</p></div>
}
