import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Goal } from './model'
import { CalendarField } from './CalendarField'
import { isCalendarDay } from './calendar-picker'
import { CategoryField, CategoryManager, useCategories } from './CategoryManager'
import { cents, exactYuan } from './finance'
import { goalCosts, goalStatus, goalStatuses, validGoalDetails, wishSaving } from './goals'
import { localDay } from './calendar'
import { useToday } from './useToday'
import { Icon } from './Icons'

export function GoalForm({ item, fresh, save, sample = false }: { item: Goal; fresh?: boolean; save: (item: Goal) => Promise<boolean>; sample?: boolean }) {
  const today = useToday()
  const [draft, setDraft] = useState(() => ({ ...item, status: goalStatus(item), monthlyStartMonth: item.monthlyStartMonth ?? today.slice(0, 7) }))
  const [onceEnabled, setOnceEnabled] = useState(item.budgetCents > 0)
  const [monthlyEnabled, setMonthlyEnabled] = useState((item.monthlyBudgetCents ?? 0) > 0)
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [preview, setPreview] = useState(false)
  const [manageCategories, setManageCategories] = useState(false)
  const managerId = useId(), { busy } = useCategories()
  const wish: Goal = { ...draft, budgetCents: onceEnabled ? draft.budgetCents : 0, monthlyBudgetCents: monthlyEnabled ? draft.monthlyBudgetCents ?? 0 : 0, monthlyStartMonth: monthlyEnabled ? draft.monthlyStartMonth : undefined }
  const cost = goalCosts(wish), saving = wishSaving(wish, today)
  const validPeriod = !monthlyEnabled || wish.monthlyStartMonth! <= wish.date.slice(0, 7)
  const changedDate = !fresh && draft.date !== item.date
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!draft.title.trim()) { setError('给这个心愿写个名字吧。'); return }
    if (!isCalendarDay(draft.date) || draft.date > '2100-12-31') { setError('请选择不晚于 2100 年的有效日期。'); return }
    if ((fresh || changedDate) && draft.date < localDay()) { setError('希望完成的日期不能早于今天。'); return }
    if (!validPeriod) { setError('开始月份不能晚于希望完成的日期。'); return }
    if (!validGoalDetails(wish as unknown as Record<string, unknown>)) { setError('请检查预算金额与开始月份。'); return }
    if (changedDate && !preview) { setPreview(true); return }
    setPending(true); const ok = await save({ ...wish, title: draft.title.trim() }); setPending(false)
    if (!ok) setError('保存未完成，内容还在这里，请重试。')
  }
  return <form className="editor wish-editor" onSubmit={submit}>
    <label>我想完成的事<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="一件想做的事，一种想过的生活" /></label>
    <div className="form-grid"><CalendarField label="希望完成的日期" min={fresh || changedDate ? today : undefined} max="2100-12-31" value={draft.date} change={date => { setDraft({ ...draft, date }); setPreview(false) }} /><CategoryField value={draft.category} change={category => setDraft(current => ({ ...current, category }))} manage={() => setManageCategories(!manageCategories)} expanded={manageCategories} managerId={managerId} /></div>
    {manageCategories && <CategoryManager id={managerId} onCreated={category => setDraft(current => ({ ...current, category }))} />}
    <label>为什么想做这件事<textarea rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="期待、计划，或想留给自己的提醒。" /></label>
    <fieldset className="wish-status"><legend>现在的状态</legend><div>{Object.entries(goalStatuses).map(([status, label]) => <label key={status}><input type="radio" name="wish-status" value={status} checked={draft.status === status} onChange={() => setDraft({ ...draft, status: status as NonNullable<Goal['status']> })} /><span>{label}</span></label>)}</div></fieldset>
    <fieldset className="wish-budget"><legend>这份心愿的预算 <small>可选</small></legend><p className="wish-budget-intro">只写这件事需要的费用。两种可以同时选，也可以先不填。</p>
      <div className="wish-cost-options">
        <label><input type="checkbox" checked={onceEnabled} onChange={e => { setOnceEnabled(e.target.checked); setPreview(false) }} /><span><strong>一次性费用</strong><small>旅行、设备、课程等</small></span></label>
        <label><input type="checkbox" checked={monthlyEnabled} onChange={e => { setMonthlyEnabled(e.target.checked); setPreview(false) }} /><span><strong>每月持续费用</strong><small>运动、学习、长期爱好等</small></span></label>
      </div>
      {(onceEnabled || monthlyEnabled) && <div className="form-grid wish-amounts">
        {onceEnabled && <label>一次性费用 / 元<input type="number" min="0" max="100000000" step=".01" required value={draft.budgetCents / 100} onChange={e => setDraft({ ...draft, budgetCents: cents(e.target.value) })} /></label>}
        {monthlyEnabled && <label>每月费用 / 元<input type="number" min="0" max="100000000" step=".01" required value={(draft.monthlyBudgetCents ?? 0) / 100} onChange={e => setDraft({ ...draft, monthlyBudgetCents: cents(e.target.value) })} /></label>}
      </div>}
      {monthlyEnabled && <div className="wish-period"><CalendarField monthly label="从哪个月开始" min="1900-01" max="2100-12" value={draft.monthlyStartMonth} change={monthlyStartMonth => { setDraft({ ...draft, monthlyStartMonth }); setPreview(false) }} /><p>持续到希望完成的日期，起止月份都计入预算，不按天折算。</p></div>}
      {!validPeriod && <p role="alert" className="form-error">开始月份晚于完成日期，请调整其中一项。</p>}
      {cost.total > 0 && validPeriod ? <div className="wish-cost-summary" aria-label="心愿预算汇总"><span>预计总费用</span><strong>¥{exactYuan(cost.total)}</strong><p>{cost.once > 0 && <>一次性 ¥{exactYuan(cost.once)}</>}{cost.once > 0 && cost.monthly > 0 && ' ＋ '}{cost.monthly > 0 && <>每月 ¥{exactYuan(cost.monthly)} × {cost.months} 个月</>}</p><small>这是预算；实际花费仍在每月收支中记录。</small></div> : validPeriod && <p className="wish-no-budget">先写下期待，预算可以以后再补。</p>}
    </fieldset>
    {cost.once > 0 && <details className="wish-saving"><summary><Icon name="sprout" size={17} /><span>提前攒钱的试算</span><small>可选</small><Icon name="chevron" size={15} /></summary><div className="wish-saving-content">
      <p>如果打算从现在开始，为这笔一次性费用重新攒钱：</p><div className="forecast-number">{saving.monthly === null ? '日期太近，无法按月拆分' : <><small>¥</small>{exactYuan(saving.monthly)}<span>/ 月</span></>}</div>
      <p>{saving.months} 次月末存入 · 只计算一次性费用{cost.monthly > 0 && `；每月 ¥${exactYuan(cost.monthly)} 的持续费用另计`}。</p>
      <label>这笔新增储蓄的年化假设 / %<input type="number" min="0" max="30" step=".01" required value={draft.newSavingRate ?? 0} onChange={e => setDraft({ ...draft, newSavingRate: Number(e.target.value) })} /></label><p className="fine-print">默认 0%。试算不扣除已有存款，不要求预留资金，也不会改动账户或账单。</p>
    </div></details>}
    {preview && <div className="notice">希望完成的日期从 {item.date.replaceAll('-', '.')} 调整到 {draft.date.replaceAll('-', '.')}。预算与可选储蓄试算已按新日期更新；保存后可撤销。</div>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="editor-footer"><span>{sample ? '样例体验 · 不写入个人手账' : '预算与账单分开 · 仅保存到本机'}</span><button className="primary-button" disabled={pending || busy} type="submit">{pending ? '正在保存…' : changedDate && !preview ? '预览日期调整' : preview ? '确认调整并保存' : '保存这个心愿'}</button></div>
  </form>
}
