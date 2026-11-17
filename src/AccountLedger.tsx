import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AccountLedgerRow } from './AccountLedgerRow'
import { AssetAccounts } from './AssetAccounts'
import { CalendarField } from './CalendarField'
import { Icon } from './Icons'
import { balanceComparison, bookkeepingDays, bookkeepingDue, ledgerAccounts, recordedIntervalGains, settlementExpense } from './account-ledger'
import type { AccountUpdate } from './account-ledger'
import { exactYuan } from './finance'
import type { AccountSettlement, AssetAccount, Journal } from './model'
import { readMoney } from './ledger-money'

export const balanceLabel = (value: number) => `¥${exactYuan(value)}`

export function AccountLedger({ journal, today, busy, saveBalance, saveSettlement, saveAccounts, openMonthly }: {
  journal: Journal; today: string; busy: boolean; saveBalance: (update: AccountUpdate) => Promise<boolean>
  saveSettlement: (row: AccountSettlement) => Promise<boolean>; saveAccounts: (rows: AssetAccount[]) => Promise<boolean>; openMonthly: () => void
}) {
  const [date, setDate] = useState(today), [selected, select] = useState<string | null | undefined>(undefined)
  const [manage, setManage] = useState(false), [archived, setArchived] = useState(false)
  const snapshots = journal.accountSnapshots ?? []
  const accounts = ledgerAccounts(journal), current = accounts.filter(a => a.active), closed = accounts.filter(a => !a.active)
  const rows = snapshots.filter(s => s.date === date)
  const count = current.filter(a => rows.some(s => s.accountId === a.id)).length
  const days = bookkeepingDays(journal.lastBookkeepingDay, today)
  const editDate = (next: string) => { setDate(next); select(undefined) }
  const props = { date, journal, busy, saveBalance }
  return <section className="account-ledger" aria-label="账户记账">
    <div className={`month-reminder ${bookkeepingDue(journal.lastBookkeepingDay, today) ? '' : 'done'}`}><Icon name="wallet" size={25} /><div><strong>想什么时候记，都可以。</strong><p>{days === null ? '从第一次记录余额开始。之后，距离上次记账满 25 天，打开应用时会提醒。' : `上次记账 ${journal.lastBookkeepingDay} · 距今 ${days} 天。你可以只更新刚核对的账户。`}</p></div><button className="quiet-button" onClick={() => setManage(!manage)} aria-expanded={manage}><Icon name="settings" size={16} />管理账户</button></div>
    {(manage || !accounts.length) && <AssetAccounts journal={journal} busy={busy} save={saveAccounts} />}
    <section className="ledger-round" aria-label="选择核对日期"><div><span className="eyebrow">A CHECK-IN, AT YOUR PACE</span><h2>这一天，各账户还有多少？</h2><p>先选余额对应的日期，再逐个保存账户。可以随时回来补完。</p></div><div className="ledger-date"><CalendarField label="余额对应的日期" value={date} min="1900-01-01" max={today} change={editDate} /></div></section>
    <div className="ledger-progress"><span>{date} · 已核对 {count} / {current.length} 个在用账户</span><button className="text-button" disabled={busy} onClick={openMonthly}>补录整月总额<Icon name="arrow" size={15} /></button></div>
    <div className="ledger-account-list">{current.map(account => <AccountLedgerRow {...props} key={JSON.stringify([account.id, date])} account={account} open={selected === account.id} toggle={() => select(selected === account.id ? undefined : account.id)} done={() => select(undefined)} />)}</div>
    {!!closed.length && <><button className="text-button" onClick={() => setArchived(!archived)} aria-expanded={archived}>{archived ? '收起' : '查看'}已归档账户（{closed.length}）</button>{archived && <div className="ledger-account-list">{closed.map(account => <AccountLedgerRow {...props} key={JSON.stringify([account.id, date])} account={account} open={selected === account.id} toggle={() => select(selected === account.id ? undefined : account.id)} done={() => select(undefined)} />)}</div>}</>}
    {accounts.length > 0 && <IntervalEstimate key={date} journal={journal} to={date} busy={busy} save={saveSettlement} />}
    {!!journal.accountSettlements?.length && <section className="ledger-estimates" aria-label="已保存的区间收支"><h2>以前核对的区间</h2>{[...journal.accountSettlements].sort((a, b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from)).map(row => <article key={`${row.from}/${row.to}`}><div><strong>{row.from} → {row.to}</strong><small>按保存时确认的余额、收入和盈亏估算</small></div><span>收入 <b>{balanceLabel(row.incomeCents)}</b></span><span>估算支出 <b>{balanceLabel(settlementExpense(row))}</b></span></article>)}</section>}
    </section>
}

function IntervalEstimate({ journal, to, busy, save }: { journal: Journal; to: string; busy: boolean; save: (row: AccountSettlement) => Promise<boolean> }) {
  const dates = useMemo(() => [...new Set(journal.accountSnapshots?.filter(s => s.date < to).map(s => s.date) ?? [])].sort().reverse(), [journal.accountSnapshots, to])
  const [from, setFrom] = useState('')
  const start = from || dates.find(date => balanceComparison(journal, date, to).missingOpening.length === 0) || dates[0] || ''
  const comparison = balanceComparison(journal, start, to)
  const existing = journal.accountSettlements?.find(s => s.from === start && s.to === to)
  return <section className="month-editor editor ledger-estimate" aria-label="估算这段时间的支出">
    <span className="eyebrow">BETWEEN TWO CHECK-INS</span><h3>这段时间花了多少？</h3>
    <p>用两次余额核对，加上实际到账收入和投资盈亏，估算总开销。自己的账户互转、买入理财不会单独算成消费。</p>
    {!dates.length ? <p className="ledger-explain">先保存各账户的第一组余额作为起点；等下一次核对后，再算两次之间的收支。手头有历史余额也可以先补录。</p> : <>
      <div className="form-grid"><label>从哪次核对开始<select value={start} onChange={e => setFrom(e.target.value)}>{dates.map(date => <option key={date}>{date}</option>)}</select></label><div className="ledger-period-end"><span>算到哪一天</span><strong>{to}</strong></div></div>
      {comparison.missingOpening.length > 0 && <p className="ledger-explain">{start} 缺少：{comparison.missingOpening.join('、')}。</p>}
      {comparison.missingClosing.length > 0 && <p className="ledger-explain">{to} 缺少：{comparison.missingClosing.join('、')}。</p>}
      {comparison.ready ? <SettlementForm key={start} from={start} to={to} opening={comparison.openingCents} closing={comparison.closingCents} incomeHint={recordedIntervalGains(journal.funds, start, to)} existing={existing} busy={busy} save={save} /> : <p className="fine-print">两天都核对齐全后才能估算。那时确实没有余额的账户，可以明确记录为 0。若有已关闭的账户，可在归档区补录。</p>}
    </>}
  </section>
}

function SettlementForm({ from, to, opening, closing, incomeHint, existing, busy, save }: { from: string; to: string; opening: number; closing: number; incomeHint: { gainCents: number; count: number }; existing?: AccountSettlement; busy: boolean; save: (row: AccountSettlement) => Promise<boolean> }) {
  const [income, setIncome] = useState(existing ? String(existing.incomeCents / 100) : '')
  const [gain, setGain] = useState(existing ? String(existing.gainCents / 100) : '')
  const [initialDebt, setInitialDebt] = useState(String((existing?.openingDebtCents ?? 0) / 100)), [endDebt, setEndDebt] = useState(String((existing?.closingDebtCents ?? 0) / 100))
  const [debt, setDebt] = useState(Boolean(existing?.openingDebtCents || existing?.closingDebtCents))
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const fields = [readMoney(income), readMoney(gain, true), debt ? readMoney(initialDebt) : 0, debt ? readMoney(endDebt) : 0]
  const [incomeCents, gainCents, openingDebtCents, closingDebtCents] = fields
  const row = incomeCents === null || gainCents === null || openingDebtCents === null || closingDebtCents === null ? null : { from, to, openingCents: opening, closingCents: closing, incomeCents, gainCents, openingDebtCents, closingDebtCents }
  const expense = row ? settlementExpense(row) : null
  const saved = !!row && !!existing && Object.keys(row).every(key => row[key as keyof AccountSettlement] === existing[key as keyof AccountSettlement])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); if (!row || expense === null || expense < 0) return
    setPending(true)
    try { if (!await save(row)) setError('这次收支未保存，请重试。') } finally { setPending(false) }
  }
  return <form onSubmit={submit} noValidate>
    <div className="ledger-totals"><div><span>期初账户合计</span><strong>{balanceLabel(opening)}</strong></div><div><span>期末账户合计</span><strong>{balanceLabel(closing)}</strong></div></div>
    <div className="form-grid"><label>期间实际收入 / 元<input inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} placeholder="工资等实际到账，没有填 0" /></label><label>期间实际投资净收益 / 元<input inputMode="decimal" value={gain} onChange={e => setGain(e.target.value)} placeholder="含实际利息，亏损填负数，没有填 0" /></label></div>
    {incomeHint.count > 0 && <button type="button" className="text-button" onClick={() => setGain(String(incomeHint.gainCents / 100))}>带入 {incomeHint.count} 项同期基金盈亏 {balanceLabel(incomeHint.gainCents)}</button>}
    <p className="fine-print">基金盈亏及实际入账利息只填到净收益里。带入的基金数据只包含两端都有市值记录的项目，请补齐其余项。收入、盈亏和余额须覆盖同一期间与同一批钱。</p>
    <label className="ledger-debt"><input type="checkbox" checked={debt} onChange={e => setDebt(e.target.checked)} />这段时间有信用卡欠款或其他负债</label>
    {debt && <div className="form-grid"><label>期初欠款 / 元<input inputMode="decimal" value={initialDebt} onChange={e => setInitialDebt(e.target.value)} /></label><label>期末欠款 / 元<input inputMode="decimal" value={endDebt} onChange={e => setEndDebt(e.target.value)} /></label></div>}
    <div className="month-editor-net"><span>估算总支出</span><strong>{expense === null ? '待填收入及收益' : expense < 0 ? '请核对输入' : balanceLabel(expense)}</strong></div>
    {expense !== null && expense < 0 && <p className="notice">差额为 {balanceLabel(expense)}，可能漏填收入、利息或账户变动。核对前不会保存为支出。</p>}
    <p className="fine-print">期初净资产 ＋ 收入 ＋ 投资净收益 − 期末净资产。净资产等于账户总额减欠款。这是区间估算，无法按餐饮、交通等分类。</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-footer"><span>{saved ? '已保存这次区间估算' : existing ? '确认后替换这次区间估算' : '核对无误后保存 · 不覆盖旧月结'}</span><button className="primary-button" type="submit" disabled={busy || pending || saved || expense === null || expense < 0}>{pending ? '正在保存…' : '保存区间收支'}<Icon name="check" size={15} /></button></div>
  </form>
}
