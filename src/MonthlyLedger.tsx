import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { cents, exactYuan } from './finance'
import { Icon } from './Icons'
import type { MonthlySummary } from './model'
import { previousMonth, validMonth } from './monthly'
import { useToday } from './useToday'
import { CalendarField } from './CalendarField'

export function MonthlyLedger({ summaries, save, remove, busy, sample, uninvested, back }: {
  summaries: MonthlySummary[]; save: (summary: MonthlySummary) => Promise<boolean>; remove: (month: string) => Promise<boolean>; busy: boolean; sample: boolean; uninvested: () => void; back: () => void
}) {
  const today = useToday(), due = previousMonth(today)
  const [editing, setEditing] = useState<string | null>(null)
  const [month, setMonth] = useState(due)
  const [income, setIncome] = useState(''), [expense, setExpense] = useState(''), [note, setNote] = useState('')
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const editor = useRef<HTMLFormElement>(null)
  useEffect(() => { if (editing !== null) editor.current?.querySelector<HTMLButtonElement>('.date-field-value')?.focus() }, [editing])
  const open = (period: string) => {
    const row = summaries.find(s => s.month === period)
    setMonth(period); setIncome(row ? String(row.incomeCents / 100) : ''); setExpense(row ? String(row.expenseCents / 100) : ''); setNote(row?.note ?? '')
    setEditing(period); setError(''); setDeleting(null)
  }
  const changeMonth = (period: string) => {
    // Do not discard amounts already typed when choosing a different month.
    setMonth(period); setError('')
  }
  const sorted = [...summaries].sort((a, b) => b.month.localeCompare(a.month))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validMonth(month) || month > today.slice(0, 7)) { setError('请选择当前月或以前的有效月份。'); return }
    if (![income, expense].every(v => v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100_000_000 && /^\d+(\.\d{1,2})?$/.test(v))) { setError('收入和支出请填写非负金额，最多保留两位小数；没有收支可填 0。'); return }
    setPending(true)
    const ok = await save({ month, incomeCents: cents(income), expenseCents: cents(expense), note: note.trim() })
    setPending(false)
    if (ok) setEditing(null)
    else setError('保存未完成，填写的金额仍在这里，请重试。')
  }
  return <section className="monthly-ledger">
    <button className="text-button" onClick={back}><Icon name="chevron" className="reverse" size={15} />返回账户记账</button>
    <div className="section-heading"><div><span className="eyebrow">THE MONEY IN YOUR DAYS</span><h2>整月收支补录</h2></div><button className="primary-button" disabled={busy} onClick={() => open(due)}>记录一个月<Icon name="plus" size={16} /></button></div>
    {editing !== null && <form ref={editor} className="editor month-editor" onSubmit={submit} aria-label="月度收支结算" noValidate>
      <div className="month-editor-heading"><h3>把这一个月收好</h3><button className="icon-button" type="button" aria-label="收起月度编辑" disabled={pending} onClick={() => setEditing(null)}><Icon name="close" size={18} /></button></div>
      <CalendarField label="记录月份" monthly min="1900-01" max={today.slice(0, 7)} value={month} change={changeMonth} />
      <div className="form-grid"><label>这个月收入 / 元<input type="number" inputMode="decimal" step=".01" min="0" max="100000000" required value={income} onChange={e => setIncome(e.target.value)} placeholder="实际到账的收入" /></label><label>这个月支出 / 元<input type="number" inputMode="decimal" step=".01" min="0" max="100000000" required value={expense} onChange={e => setExpense(e.target.value)} placeholder="消费合计，扣除退款" /></label></div>
      <div className="month-editor-net"><span>这个月留下</span><strong>¥{exactYuan(cents(income || 0) - cents(expense || 0))}</strong></div>
      <label>想补充几句话<textarea rows={2} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder="可留空。例如，这个月有一笔旅行开销。" /></label>
      <p className="fine-print">填写整月总额，已有该月记录时会更新为这次的金额，不会重复累加。当前月可以先记截至今日的实际金额，月末再更新。</p>
      {summaries.some(s => s.month === month) && month !== editing && <p className="notice">{month} 已有结算，保存后将替换该月总额。保存提示中可以撤销。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="editor-footer"><span>{sample ? '样例体验 · 不写入个人手账' : '仅本机保存 · 可撤销'}</span><button className="primary-button" type="submit" disabled={pending || busy}>{pending ? '正在保存…' : '收好这个月'}<Icon name="check" size={16} /></button></div>
    </form>}
    {sorted.length ? <div className="month-history">{sorted.map(s => <article key={s.month}><button className="month-history-row" onClick={() => open(s.month)} disabled={busy}><span className="month-history-date">{s.month.replace('-', '.')}<small>{s.month === today.slice(0, 7) ? '本月 · 可继续补充' : '月度结算'}</small></span><span><small>收入</small><strong>¥{exactYuan(s.incomeCents)}</strong></span><span><small>支出</small><strong>¥{exactYuan(s.expenseCents)}</strong></span><span><small>结余</small><strong className={s.incomeCents < s.expenseCents ? 'negative' : ''}>¥{exactYuan(s.incomeCents - s.expenseCents)}</strong></span><Icon name="chevron" size={16} /></button>{s.note && <p className="month-note">{s.note}</p>}<div className="month-row-actions">{deleting === s.month ? <><span>移除这份月结算？</span><button className="text-button" disabled={busy} onClick={async () => { if (await remove(s.month)) setDeleting(null) }}>确认移除</button><button className="text-button" onClick={() => setDeleting(null)}>保留</button></> : <button className="text-button" disabled={busy} onClick={() => setDeleting(s.month)}>移除记录</button>}</div></article>)}</div> : <div className="blank-card month-blank"><Icon name="book" size={30} /><h2>不必每天记账，也能看见生活的花费。</h2><p>从上个月开始，写下两个数字就好。</p></div>}
    <div className="monthly-guidance"><Icon name="leaf" size={23} /><div><strong>结余先留下，不急着计息。</strong><p>这里回看真实收支，不会自动增加资金余额。未投入的钱可以记录为 0% 收益的日常余额；投入后相应减少日常余额，再记录计息资金。自己账户间转账不算消费。</p><button className="text-button" disabled={busy} onClick={uninvested}>记录未计息余额<Icon name="arrow" size={15} /></button></div></div>
  </section>
}
