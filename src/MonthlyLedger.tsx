import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { cents, exactYuan } from './finance'
import { Icon } from './Icons'
import type { MonthlySummary } from './model'
import { monthlyReminderCalendar, previousMonth, validMonth } from './monthly'
import { useToday } from './useToday'

export function MonthlyLedger({ summaries, save, remove, busy, sample, uninvested }: {
  summaries: MonthlySummary[]; save: (summary: MonthlySummary) => Promise<boolean>; remove: (month: string) => Promise<boolean>; busy: boolean; sample: boolean; uninvested: () => void
}) {
  const today = useToday(), due = previousMonth(today)
  const [editing, setEditing] = useState<string | null>(null)
  const [month, setMonth] = useState(due)
  const [income, setIncome] = useState(''), [expense, setExpense] = useState(''), [note, setNote] = useState('')
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [calendarNotice, setCalendarNotice] = useState(false)
  const editor = useRef<HTMLFormElement>(null)
  useEffect(() => { if (editing !== null) editor.current?.querySelector<HTMLInputElement>('input')?.focus() }, [editing])
  const open = (period: string) => {
    const row = summaries.find(s => s.month === period)
    setMonth(period); setIncome(row ? String(row.incomeCents / 100) : ''); setExpense(row ? String(row.expenseCents / 100) : ''); setNote(row?.note ?? '')
    setEditing(period); setError(''); setDeleting(null)
  }
  const changeMonth = (period: string) => {
    // Do not discard amounts already typed when choosing a different month.
    setMonth(period); setError('')
  }
  const row = summaries.find(s => s.month === due)
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
  const calendar = () => {
    const url = URL.createObjectURL(new Blob([monthlyReminderCalendar(today)], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'HawTend-每月补账提醒.ics'; a.click(); URL.revokeObjectURL(url); setCalendarNotice(true)
  }
  return <section className="monthly-ledger">
    <div className={`month-reminder ${row ? 'done' : ''}`} role="status"><Icon name={row ? 'check' : 'book'} size={25} /><div><strong>{row ? `${due.replace('-', ' 年 ')} 月，已经收好。` : `给 ${due.replace('-', ' 年 ')} 月，留一份收支记录。`}</strong><p>{row ? '月初回看一次，就能知道钱去了哪里。' : '不必记住每一笔，每月填一次收入与支出总额就好。'}</p></div><button className="quiet-button" disabled={busy} onClick={() => open(due)}>{row ? '回看上个月' : '补记上个月'}<Icon name="arrow" size={16} /></button></div>
    <div className="month-overview"><div><span>上个月收入</span><strong>{row ? `¥${exactYuan(row.incomeCents)}` : '还没填写'}</strong></div><div><span>上个月支出</span><strong>{row ? `¥${exactYuan(row.expenseCents)}` : '还没填写'}</strong></div><div><span>上个月结余</span><strong className={row && row.incomeCents < row.expenseCents ? 'negative' : ''}>{row ? `¥${exactYuan(row.incomeCents - row.expenseCents)}` : '慢慢补齐'}</strong><small>收入 − 支出</small></div></div>
    <div className="section-heading"><div><span className="eyebrow">THE MONEY IN YOUR DAYS</span><h2>每个月，都有自己的节奏</h2></div><button className="primary-button" disabled={busy} onClick={() => open(due)}>记录一个月<Icon name="plus" size={16} /></button></div>
    {editing !== null && <form ref={editor} className="editor month-editor" onSubmit={submit} aria-label="月度收支结算" noValidate>
      <div className="month-editor-heading"><h3>把这一个月收好</h3><button className="icon-button" type="button" aria-label="收起月度编辑" disabled={pending} onClick={() => setEditing(null)}><Icon name="close" size={18} /></button></div>
      <label>记录月份<input type="month" required min="1900-01" max={today.slice(0, 7)} value={month} onChange={e => changeMonth(e.target.value)} /></label>
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
    <div className="month-calendar"><div><strong>月初，给自己一个小提醒。</strong><p>页面会提示尚未补记的上个月。需要 App 关闭时也提醒，可下载日历事件并导入手机或电脑日历。</p></div><button className="quiet-button" onClick={calendar}><Icon name="download" size={16} />加入月初提醒</button></div>
    {calendarNotice && <p role="status" className="calendar-notice">已生成日历文件。请打开并确认导入日历：每月 1 日当地时间 10:00 提醒一次，通知由日历 App 提供。尚未自动添加到你的日历。</p>}
  </section>
}
