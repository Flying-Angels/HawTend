import { useMemo, useRef, useState } from 'react'
import type { FinancialPlan, Journal } from './model'
import type { cashflowProjection } from './cashflow'
import { isFinancialPlan, salaryTargetSummary } from './cashflow'
import { cents, exactYuan } from './finance'
import { goalStatus } from './goals'
import { grossForNet, salaryDeductions, withIncomeBasis, withSalaryDeductions } from './income-tax'
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
  const target = useMemo(() => salaryTargetSummary(journal, plan, today), [journal, plan, today])
  const { required } = result, deductions = salaryDeductions(plan)
  const requiredGross = required.incomeCents === null ? null : grossForNet(required.incomeCents, deductions)
  const editExpenses = () => { if (settings.current) settings.current.open = true; expenses.current?.focus() }
  const submit = async () => {
    if (!isFinancialPlan(plan)) { setError('请检查金额、年化与收入估算设置。'); return }
    setError(''); setPending(true)
    try { if (!await save(plan)) setError('规划未保存，试算内容仍在这里，请重试。') }
    finally { setPending(false) }
  }
  return <section className="financial-planning income-planning" aria-label="收入目标与规划假设">
    <div className="income-planning-heading"><div><span className="eyebrow">YOUR WISHES, YOUR SALARY GOAL</span><h2>实现这些愿望，月薪要多少？</h2><p>填好愿望费用、日期和日常开销，HawTend 自动反推所需月薪。</p></div><button className="quiet-button" onClick={openTimeline}>到时间轴查看曲线<Icon name="arrow" size={16} /></button></div>
    <div className="income-summary salary-target-summary" aria-label="期望月收入试算"><div className="income-primary"><span>{target.rows.length ? `按时实现这 ${target.rows.length} 个愿望，税前月薪至少` : '先给一个愿望填写费用与日期'}</span><strong>{!target.rows.length ? '等待愿望预算' : required.incomeCents === null ? '下次工资前需先筹款' : moneyLabel(requiredGross)}<small>{target.rows.length > 0 && required.incomeCents !== null && '/ 月 · 税前预估'}</small></strong><p>对应税后至少到账 <b>{moneyLabel(required.incomeCents)}</b> / 月。</p>{needsExpense && target.rows.length > 0 && <p className="salary-incomplete">目前是只含愿望费用的月薪下限，尚未包含生活开支。<button className="text-button" onClick={editExpenses}>补充每月日常开销<Icon name="arrow" size={13} /></button></p>}</div><div><span>愿望还需支付的费用</span><strong>¥{exactYuan(target.onceCents + target.recurringCents)}</strong><p>一次性 ¥{exactYuan(target.onceCents)}<br />持续月费合计 ¥{exactYuan(target.recurringCents)}<br />已含日常开销的月费不重复相加。</p></div><div><span>心愿预算算到</span><strong className="income-horizon">{required.horizon.replaceAll('-', '.')}</strong><p>{futureBudget ? `期间按 ${target.salaryMonths} 次未来工资准备。` : '先设置一个有预算的未来愿望。'}每个愿望都按自己的付款日期检查资金。</p></div></div>
    <p className="salary-source"><Icon name="wallet" size={16} />全部靠未来工资实现。现有存款本金、收益、基金及到期资金均不参与本次反推。</p>
    {target.rows.length > 0 && <div className="salary-reasoning" aria-label="月薪反推依据"><h3>这份月薪怎么算出来？</h3><div className="salary-monthly-breakdown"><div><span>为愿望，每月需留</span><strong>{moneyLabel(target.wishMonthlyCents)}</strong></div><span className="salary-equals">+</span><div><span>每月日常开销</span><strong>¥{exactYuan(plan.monthlyExpenseCents)}</strong></div><span className="salary-equals">=</span><div><span>税后工资下限</span><strong>{moneyLabel(required.incomeCents)}</strong></div></div><p>愿望按付款日期安排支出，未来工资结余按 {plan.annualRate.toFixed(2)}% 年化复利试算，再反推能覆盖每一次付款的最低固定月薪。</p>{required.incomeCents !== null && target.wishMonthlyCents !== null && target.wishMonthlyCents > 0 && <p>最约束月薪的付款日期：{required.limitingDate.replaceAll('-', '.')} {target.bindingWishes.length ? `· ${[...new Set(target.bindingWishes)].join('、')}` : ''}。</p>}<details className="salary-wishes" open={target.rows.length <= 4}><summary>本次计入的 {target.rows.length} 个愿望<Icon name="chevron" size={13} /></summary><ul>{target.rows.map(g => <li key={g.id}><div><strong>{g.title}</strong><span>{g.date.replaceAll('-', '.')} 完成</span></div><p>一次性 ¥{exactYuan(g.onceCents)}{g.monthlyCents > 0 && (g.alreadyInLiving ? ` · 每月 ¥${exactYuan(g.monthlyCents)} 已在日常开销中计入` : ` · 未来 ${g.months} 个月 × ¥${exactYuan(g.monthlyCents)}`)}</p></li>)}</ul></details></div>}
    {required.upfrontShortfallCents > 0 && <p className="notice" role="status">本月的一次性心愿还缺 ¥{exactYuan(required.upfrontShortfallCents)}。下个月的收入无法覆盖本月付款，请先调整付款时间。</p>}
    {(overdue.length > 0 || unbudgeted.length > 0) && <p className="planning-hint">{overdue.length > 0 && `${overdue.length} 个已过日期的未完成心愿暂未计入，请调整日期或标为已完成。`}{unbudgeted.length > 0 && `${unbudgeted.length} 个未来心愿还没有预算，补充后才会计入费用。`}</p>}
    <details ref={settings} className="planning-assumptions"><summary><Icon name="settings" size={16} /><span>规划假设与收入换算</span><small>活期年化 {plan.annualRate.toFixed(2)}% · 复利</small><Icon name="chevron" size={15} /></summary><div className="planning-fields">
      <div className="form-grid"><label>每月日常开销 / 元<input ref={expenses} aria-label="规划每月日常开销" type="number" min="0" max="100000000" step=".01" value={plan.monthlyExpenseCents / 100} onChange={e => update({ ...plan, monthlyExpenseCents: cents(e.target.value) })} /></label><label>活期年化假设 / %<input aria-label="规划活期年化" type="number" min="0" max="30" step=".01" value={plan.annualRate} onChange={e => update({ ...plan, annualRate: Number(e.target.value) })} /></label></div>
      <p>从下个月开始，每月月初发薪并扣除日常与持续月费，本月只检查未付的一次性愿望。</p><p>日常开销{!journal.financialPlan && recent ? `默认参考 ${recent.month.replace('-', '.')} 的实际支出` : '包含生活费、还贷等必要花费'}。已包含在其中的心愿月费用，请在下方标记，避免重复计算。</p>
      {recurring.length > 0 && <div className="included-wishes" role="group" aria-label="已包含在日常开销中的心愿">{recurring.map(g => <label key={g.id}><input type="checkbox" checked={plan.includedMonthlyGoalIds?.includes(g.id) ?? false} onChange={e => update({ ...plan, includedMonthlyGoalIds: e.target.checked ? [...(plan.includedMonthlyGoalIds ?? []), g.id] : (plan.includedMonthlyGoalIds ?? []).filter(id => id !== g.id) })} /><span>“{g.title}”的每月 ¥{exactYuan(g.monthlyBudgetCents!)} 已包含在日常开销中</span></label>)}</div>}
      <div className="salary-settings"><h3>把所需到账金额换算成税前月薪</h3><div className="form-grid"><label>个人社保、公积金 / 元·月<input aria-label="每月个人社保与公积金" type="number" min="0" max="100000000" step=".01" value={deductions.monthlyEmployeeCents / 100} onChange={e => update(withSalaryDeductions(plan, { ...deductions, monthlyEmployeeCents: cents(e.target.value) }))} /></label><label>专项附加扣除 / 元·月<input aria-label="每月专项附加扣除" type="number" min="0" max="100000000" step=".01" value={deductions.monthlyAdditionalCents / 100} onChange={e => update(withSalaryDeductions(plan, { ...deductions, monthlyAdditionalCents: cents(e.target.value) }))} /></label></div><p>个人缴费会减少到账额；专项附加扣除只减少计税金额，不再当支出。默认均为 0，请按工资单填个人实际缴费与可扣除额度。</p><p>按中国大陆居民工资、全年均匀收入估算年税并均摊到月；未加入年终奖、其他所得或逐月累计预扣差异。规则参考 <a href="https://www.chinatax.gov.cn/n810219/n810744/n3752930/n3752974/c3970366/content.html" target="_blank" rel="noreferrer">税务总局</a>。</p><span className="salary-display-note">时间轴收入线的显示口径</span><IncomeBasis plan={plan} update={update} /></div>
      <div className="planning-save"><span>{sample ? '样例中的假设仅用于本次体验' : '修改先试算，保存后才记住假设'}</span><button className="quiet-button" disabled={busy || pending} onClick={submit}>{pending ? '正在保存…' : '保存规划假设'}<Icon name="check" size={15} /></button></div>{error && <p role="alert" className="form-error">{error}</p>}
    </div></details>
  </section>
}
export function TimelineIncome({ plan, result, journal, today, edit }: Pick<PlanningProps, 'plan' | 'result' | 'journal' | 'today'> & { edit: () => void }) {
  const net = result.required.incomeCents, gross = net === null ? null : grossForNet(net, salaryDeductions(plan))
  const budgeted = journal.goals.some(g => goalStatus(g) !== 'done' && g.date >= today && (g.budgetCents > 0 || (g.monthlyBudgetCents ?? 0) > 0))
  const missing = !journal.financialPlan && !journal.monthlySummaries?.some(r => r.month < today.slice(0, 7)) && plan.monthlyExpenseCents === 0
  return <div className="timeline-income-strip"><div><span>实现愿望所需月薪</span><strong>{!budgeted ? '等待愿望预算' : net === null ? '本月需先筹款' : `${moneyLabel(gross)} / 月`}</strong><small>{!budgeted ? '先给一个未来愿望填写费用与日期' : `${missing ? '税前下限 · 尚未含日常开销' : '税前月薪预估'} · 心愿预算算到 ${result.required.horizon.replaceAll('-', '.')}`}</small></div><button className="quiet-button" onClick={edit}>调整月薪反推<Icon name="arrow" size={15} /></button></div>
}
export function CashFlowControls({ plan, update, view, setView }: Pick<PlanningProps, 'plan' | 'update'> & { view: 'flows' | 'balance'; setView: (view: 'flows' | 'balance') => void }) {
  const gross = plan.incomeBasis === 'gross'
  return <div className="cashflow-controls"><div className="cashflow-heading"><div className="cashflow-switch" role="group" aria-label="资金曲线类型"><button aria-pressed={view === 'flows'} onClick={() => setView('flows')}>月收入与支出</button><button aria-pressed={view === 'balance'} onClick={() => setView('balance')}>工资结余</button></div>{view === 'flows' && <IncomeBasis plan={plan} update={update} />}<div className="cashflow-legend">{view === 'flows' ? <><span><i className="income" />{gross ? '税前估算' : '到账收入'} + 活期利息</span><span><i className="expense" />日常与心愿支出</span></> : <span><i className="balance" />税后工资结余</span>}</div></div><p className="planning-hint">悬停查看月份与金额，点选可保留提示；手机可轻点，键盘可用左右键查看。曲线按月汇总，心愿保留具体日期。{gross && '税前仅换算未来收入；历史仍为实际记录，余额始终按税后计算。'}</p></div>
}
