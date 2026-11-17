import { useMemo, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { AccountSettlement, Journal } from './model'
import { balanceComparison, intervalAccounts, previousCheckIns, recordedBalanceOn, recordedIntervalGains, settlementExpense, unrecordedAccountBalances } from './account-ledger'
import type { OpeningUpdate } from './account-ledger'
import { calendarTime, shiftCalendarMonth } from './calendar-picker'
import { exactYuan } from './finance'
import { readMoney } from './ledger-money'
import { CalendarField } from './CalendarField'
import { Icon } from './Icons'

const amount = (cents: number) => `¥${exactYuan(cents)}`

export function SpendingReview({ journal, to, busy, save, saveOpening, importBalances, reviewHeading, id, reviewAccounts }: {
  journal: Journal; to: string; busy: boolean; save: (row: AccountSettlement) => Promise<boolean>; saveOpening: (data: OpeningUpdate) => Promise<boolean>
  reviewHeading: RefObject<HTMLHeadingElement | null>; id: string; reviewAccounts: () => void
  importBalances: (date: string) => Promise<boolean>
}) {
  const checkIns = useMemo(() => previousCheckIns(journal, to), [journal, to])
  const defaultStart = useMemo(() => {
    const saved = journal.accountSettlements?.filter(row => row.to === to).sort((a, b) => b.from.localeCompare(a.from))
    const minAccounts = intervalAccounts(journal, to, to).filter(a => a.active).length
    const complete = ({ date, count }: { date: string; count: number }) => count >= minAccounts && !balanceComparison(journal, date, to).missingOpening.length
    const savedStart = saved?.find(row => checkIns.some(option => option.date === row.from && complete(option)))?.from
    return savedStart ?? checkIns.find(complete)?.date ?? checkIns[0]?.date ?? ''
  }, [journal, to, checkIns])
  const [chosen, setChosen] = useState(''), [openingEditor, setOpeningEditor] = useState(false)
  const [importError, setImportError] = useState(false)
  const from = checkIns.some(option => option.date === chosen) ? chosen : defaultStart
  const comparison = balanceComparison(journal, from, to)
  const existing = journal.accountSettlements?.find(s => s.from === from && s.to === to)
  const endRecorded = comparison.coverage.some(a => !!a.closing)
  const count = comparison.coverage.length
  const noAccounts = count === 0
  const missingEnd = comparison.missingClosing.length > 0
  const eligible = missingEnd ? unrecordedAccountBalances(journal, to) : []
  const missingStart = !from || comparison.missingOpening.length > 0
  const openBaseline = () => setOpeningEditor(!openingEditor)
  const lastSaved = [...(journal.accountSettlements ?? [])].sort((a,b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from))[0]
  return <section className="spending-review" aria-labelledby={id}>
    <header><div><span className="eyebrow">BETWEEN TWO CHECK-INS</span><h2 id={id} ref={reviewHeading} tabIndex={-1}>这段时间花了多少？</h2></div><span>期末 · {to}</span></header>
    {!noAccounts && checkIns.length > 0 && <div className="spending-period"><label>采用哪天的期初余额<select value={from} onChange={e => { setChosen(e.target.value); setOpeningEditor(false) }}>{checkIns.map(({ date, count }) => <option value={date} key={date}>{date} · 已记录 {count} 个账户</option>)}</select></label></div>}
    {noAccounts ? <p className="ledger-explain">先添加一个资金账户，再记录第一次余额。</p> : !comparison.ready ? <div className="spending-next" role="status">
      <strong>{missingEnd ? '还差本次余额' : from ? `已找到期初余额 · ${count - comparison.missingOpening.length} / ${count} 个账户` : '本次余额已齐，尚未找到更早的核对日'}</strong>
      {missingEnd ? <><p>{to} 缺少：{comparison.missingClosing.join('、')}。各账户需要核对同一天的余额。</p><div className="spending-actions"><button className="quiet-button" onClick={reviewAccounts}>去核对余额<Icon name="arrow" size={15} /></button>{eligible.length > 0 && <button className="quiet-button" disabled={busy} onClick={async () => { setImportError(false); if (!await importBalances(to)) setImportError(true) }}>带入 {eligible.length} 个账户当天的余额</button>}</div>{eligible.length > 0 && <p>可用资金安排里日期一致的余额：{eligible.map(a => `${a.name} ${amount(a.balanceCents)}`).join('、')}。</p>}{importError && <p className="form-error">余额未能带入，请重试。</p>}</> : <p>{from ? `${from} 只需补齐：${comparison.missingOpening.join('、')}。其他余额会直接沿用。` : `本手账没有保存早于 ${to} 的账户核对。若前后都选了同一个余额日期，后一次会更正当天金额；请先核对保存日期。`}</p>}
    </div> : <SpendingForm key={`${from}/${to}`} from={from} to={to} opening={comparison.openingCents} closing={comparison.closingCents} gains={recordedIntervalGains(journal.funds, from, to)} existing={existing} busy={busy} save={save} />}
    {!noAccounts && (endRecorded || checkIns.length > 0) && <button className={missingStart && !missingEnd ? 'quiet-button' : 'text-button'} aria-expanded={openingEditor} onClick={openBaseline}>{openingEditor ? '收起期初补录' : missingStart && from ? '补齐缺少的期初账户' : missingStart ? '补录期初余额' : '补录或更正期初余额'}<Icon name={openingEditor ? 'close' : 'edit'} size={15} /></button>}
    {checkIns.length > 0 && <details className="spending-formula balance-coverage"><summary>查看已保存的期初余额</summary><ul>{comparison.coverage.map(a => <li key={JSON.stringify(a.id)}><strong>{a.name}</strong><span>{a.opening ? `${a.opening.date} · ${amount(a.opening.balanceCents)} · 已采用` : a.previous ? `所选日缺记录 · 最近记过 ${a.previous.date}` : '所选日缺记录 · 未找到更早余额'}</span></li>)}</ul><p>可切换到上面其他核对日。不同日期的余额不会混作同一天。</p></details>}
    {openingEditor && <OpeningBalances journal={journal} from={from || shiftCalendarMonth(to, -1)} to={to} busy={busy} save={saveOpening} done={date => { setChosen(date); setOpeningEditor(false); reviewHeading.current?.focus() }} />}
    {!comparison.ready && lastSaved && <p className="fine-print">最近保存：{lastSaved.from} 至 {lastSaved.to} · 支出估算 {amount(settlementExpense(lastSaved))}。可在下方「以前核对的区间」查看。</p>}
  </section>
}

function OpeningBalances({ journal, from, to, busy, save, done }: { journal: Journal; from: string; to: string; busy: boolean; save: (update: OpeningUpdate) => Promise<boolean>; done: (date: string) => void }) {
  const [date, setDate] = useState(from)
  const lastDay = new Date(calendarTime(to) - 86_400_000).toISOString().slice(0,10)
  return <div className="opening-editor"><h3>补上上次的余额</h3><p>选择余额对应的日期。已有余额会直接带入，只需填写缺少的账户。</p>
    <CalendarField label="补录的期初日期" value={date} min="1900-01-01" max={lastDay} change={setDate} />
    <OpeningForm key={date} journal={journal} date={date} to={to} busy={busy} save={save} done={done} />
  </div>
}

function OpeningForm({ journal, date, to, busy, save, done }: { journal: Journal; date: string; to: string; busy: boolean; save: (update: OpeningUpdate) => Promise<boolean>; done: (date: string) => void }) {
  const { coverage: accounts } = balanceComparison(journal, date, to)
  const [values, setValues] = useState(() => new Map(accounts.map(a => {
    return [a.id, a.opening ? String(a.opening.balanceCents / 100) : '']
  })))
  const [editing, setEditing] = useState(new Set<string | null>())
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const update = (id: string | null, value: string) => setValues(current => new Map(current).set(id, value))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    const balances = accounts.map(a => ({ accountId: a.id, balanceCents: readMoney(values.get(a.id) ?? '') }))
    if (balances.some(row => row.balanceCents === null)) { setError('请填齐各账户当天的实际余额。确实没有余额的账户填 0。'); return }
    setPending(true)
    try { if (await save({ from: date, to, balances: balances.map(row => ({ ...row, balanceCents: row.balanceCents! })) })) done(date); else setError('期初余额没有保存，请重试。') }
    catch (e) { setError(e instanceof Error ? e.message : '期初余额没有保存，请重试。') }
    finally { setPending(false) }
  }
  return <form onSubmit={submit} noValidate>
    <div className="ledger-assets">{accounts.map(a => {
      if (a.opening && !editing.has(a.id)) return <div className="opening-reused" key={JSON.stringify(a.id)}><span>{a.name} · 已有记录</span><strong>{amount(a.opening.balanceCents)}</strong><button type="button" className="text-button" onClick={() => setEditing(current => new Set(current).add(a.id))}>更正 {a.name} 的期初余额</button></div>
      const reference = recordedBalanceOn(journal, a.id, date)
      return <div key={JSON.stringify(a.id)}><label>{a.name}期初余额 / 元<input inputMode="decimal" value={values.get(a.id) ?? ''} onChange={e => update(a.id, e.target.value)} placeholder="实际余额" /></label>
        {!a.opening && a.previous && <p className="fine-print">最近有 {a.previous.date} 的记录；此处请填 {date} 的实际余额。</p>}
        {reference !== null && <button type="button" className="text-button" onClick={() => update(a.id, String(reference / 100))}>带入当天资产记录 {amount(reference)}</button>}</div>
    })}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="editor-footer"><span>以银行或平台的历史余额为准</span><button className="primary-button" type="submit" disabled={busy || pending}>{pending ? '正在保存…' : '保存期初余额，继续估算'}<Icon name="arrow" size={15} /></button></div>
  </form>
}

function SpendingForm({ from, to, opening, closing, gains, existing, busy, save }: { from: string; to: string; opening: number; closing: number; gains: { gainCents: number; count: number }; existing?: AccountSettlement; busy: boolean; save: (row: AccountSettlement) => Promise<boolean> }) {
  const [income, setIncome] = useState(existing ? String(existing.incomeCents / 100) : '')
  const [gainOverride, setGainOverride] = useState(existing ? String(existing.gainCents / 100) : null)
  const [openingDebt, setOpeningDebt] = useState(String((existing?.openingDebtCents ?? 0) / 100)), [closingDebt, setClosingDebt] = useState(String((existing?.closingDebtCents ?? 0) / 100))
  const [adjustments, setAdjustments] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('')
  const gain = gainOverride ?? String(gains.gainCents / 100)
  const [incomeCents, gainCents, openingDebtCents, closingDebtCents] = [readMoney(income), readMoney(gain, true), readMoney(openingDebt), readMoney(closingDebt)]
  const row = incomeCents === null || gainCents === null || openingDebtCents === null || closingDebtCents === null ? null : { from, to, openingCents: opening, closingCents: closing, incomeCents, gainCents, openingDebtCents, closingDebtCents }
  const expense = row ? settlementExpense(row) : null
  const saved = !!row && !!existing && (Object.keys(row) as (keyof AccountSettlement)[]).every(key => row[key] === existing[key])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!row || expense === null || expense < 0) return
    setPending(true)
    try { if (!await save(row)) setError('这次收支未保存，请重试。') } finally { setPending(false) }
  }
  return <form onSubmit={submit} noValidate>
    <div className="spending-result" role="status"><div><span>{saved ? '已保存的支出估算' : '本期支出估算'}</span><strong>{expense === null ? incomeCents === null ? '待填实际收入' : '请核对调整项' : expense < 0 ? '请核对收支' : amount(expense)}</strong></div><p>{from} → {to}</p></div>
    <label className="spending-income">这段时间实际到账收入 / 元<input inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} placeholder="例如工资、奖金；没有填 0" /></label>
    <p className="fine-print">不含自己账户间的转账、借款到账及投资赎回本金。计入下面的利息、盈亏也不要重复填作收入。</p>
    <button type="button" className="text-button" aria-expanded={adjustments} onClick={() => setAdjustments(!adjustments)}>{adjustments ? '收起盈亏与欠款' : '核对投资盈亏与欠款'}<Icon name="chevron" size={14} /></button>
    <p className="fine-print">{gainOverride !== null ? `投资净收益 ${gainCents === null ? '待核对' : amount(gainCents)}。` : gains.count ? `已带入 ${gains.count} 项日期匹配的基金盈亏 ${amount(gains.gainCents)}，其余投资盈亏和利息暂按 0。` : '没有可带入的同期盈亏，投资净收益与实际利息暂按 0。'}{openingDebtCents === null || closingDebtCents === null ? ' 欠款待核对。' : !openingDebtCents && !closingDebtCents ? ' 两端欠款按 0。' : ` 欠款：${amount(openingDebtCents)} → ${amount(closingDebtCents)}。`}</p>
    {adjustments && <div className="spending-adjustments"><div className="form-grid"><label>实际投资净收益与利息 / 元<input inputMode="decimal" value={gain} onChange={e => setGainOverride(e.target.value)} /></label></div>
      <p className="fine-print">亏损填负数，只计实际收益。{gains.count ? `已记录基金中两端日期匹配的合计是 ${amount(gains.gainCents)}。` : ''}如果使用带入金额，把其余盈亏和利息加到总数。</p>
      <div className="form-grid"><label>期初欠款 / 元<input inputMode="decimal" value={openingDebt} onChange={e => setOpeningDebt(e.target.value)} /></label><label>期末欠款 / 元<input inputMode="decimal" value={closingDebt} onChange={e => setClosingDebt(e.target.value)} /></label></div></div>}
    {expense !== null && expense < 0 && <p className="notice">两次账面余额对出的差额为 {amount(expense)}。请检查是否漏填收入、实际投资收益，或把转进、转出的钱漏记在某个账户。</p>}
    <details className="spending-formula"><summary>怎么算出来的？</summary><p>支出＝期初净资产 ＋ 到账收入 ＋ 投资净收益 − 期末净资产。净资产＝各账户余额合计 − 欠款。</p>{row && expense !== null && <p className="spending-equation">{amount(opening - row.openingDebtCents)} ＋ {amount(row.incomeCents)} {row.gainCents < 0 ? '−' : '＋'} {amount(Math.abs(row.gainCents))} − ({amount(closing - row.closingDebtCents)}) ＝ {amount(expense)}</p>}<p>期初账户合计 {amount(opening)}，期末账户合计 {amount(closing)}。自己的账户互转、买入基金只是在账户或资产间挪钱，两边余额都记齐就不会另外算作消费。</p></details>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-footer"><span>{saved ? '已记下 · 不覆盖旧月结' : '核对输入后保存估算'}</span><button className="primary-button" type="submit" disabled={busy || pending || saved || expense === null || expense < 0}>{pending ? '正在保存…' : '保存支出估算'}<Icon name="check" size={15} /></button></div>
  </form>
}
