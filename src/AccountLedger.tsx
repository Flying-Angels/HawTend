import { useId, useRef, useState } from 'react'
import { AccountLedgerRow } from './AccountLedgerRow'
import { AssetAccounts } from './AssetAccounts'
import { CalendarField } from './CalendarField'
import { Icon } from './Icons'
import { bookkeepingDays, bookkeepingDue, latestCheckInDate, ledgerAccounts, settlementExpense } from './account-ledger'
import type { AccountUpdate, OpeningUpdate } from './account-ledger'
import { exactYuan } from './finance'
import type { AccountSettlement, AssetAccount, Journal } from './model'
import { SpendingReview } from './SpendingReview'

export const balanceLabel = (value: number) => `¥${exactYuan(value)}`

export function AccountLedger({ journal, today, startDate, busy, saveBalance, saveOpening, importBalances, saveSettlement, saveAccounts, openMonthly }: {
  journal: Journal; today: string; busy: boolean; saveBalance: (update: AccountUpdate) => Promise<boolean>
  startDate?: string
  saveOpening: (update: OpeningUpdate) => Promise<boolean>
  importBalances: (date: string) => Promise<boolean>
  saveSettlement: (row: AccountSettlement) => Promise<boolean>; saveAccounts: (rows: AssetAccount[]) => Promise<boolean>; openMonthly: () => void
}) {
  const [date, setDate] = useState(() => startDate ?? latestCheckInDate(journal, today)), [selected, select] = useState<string | null | undefined>(undefined)
  const [manage, setManage] = useState(false), [archived, setArchived] = useState(false)
  const accountsHeading = useRef<HTMLElement>(null), reviewHeading = useRef<HTMLHeadingElement>(null), resultId = useId()
  const snapshots = journal.accountSnapshots ?? []
  const accounts = ledgerAccounts(journal), current = accounts.filter(a => a.active), closed = accounts.filter(a => !a.active)
  const rows = snapshots.filter(s => s.date === date)
  const count = current.filter(a => rows.some(s => s.accountId === a.id)).length
  const days = bookkeepingDays(journal.lastBookkeepingDay, today)
  const editDate = (next: string) => { setDate(next); select(undefined) }
  const props = { date, journal, busy, saveBalance }
  const finishAccount = () => {
    setArchived(true)
    accountsHeading.current?.focus()
  }
  const done = (id: string | null) => {
    select(undefined)
    if (current.every(a => a.id === id || rows.some(s => s.accountId === a.id))) reviewHeading.current?.focus()
  }
  return <section className="account-ledger" aria-label="账户记账">
    <SpendingReview key={date} journal={journal} to={date} busy={busy} save={saveSettlement} saveOpening={saveOpening} importBalances={importBalances} reviewHeading={reviewHeading} id={resultId} reviewAccounts={finishAccount} />
    <div className={`month-reminder ${bookkeepingDue(journal.lastBookkeepingDay, today) ? '' : 'done'}`}><Icon name="wallet" size={25} /><div><strong>想什么时候记，都可以。</strong><p>{days === null ? '从第一次记录余额开始。之后，距离上次记账满 25 天，打开应用时会提醒。' : `上次记账 ${journal.lastBookkeepingDay} · 距今 ${days} 天。你可以只更新刚核对的账户。`}</p></div><button className="quiet-button" onClick={() => setManage(!manage)} aria-expanded={manage}><Icon name="settings" size={16} />管理账户</button></div>
    {(manage || !accounts.length) && <AssetAccounts journal={journal} busy={busy} save={saveAccounts} />}
    <section ref={accountsHeading} tabIndex={-1} className="ledger-round" aria-label="选择核对日期"><div><span className="eyebrow">A CHECK-IN, AT YOUR PACE</span><h2>这一天，各账户还有多少？</h2><p>先选余额对应的日期，再逐个保存账户。可以随时回来补完。</p></div><div className="ledger-date"><CalendarField label="余额对应的日期" value={date} min="1900-01-01" max={today} change={editDate} />{date !== today && <button className="text-button" onClick={() => editDate(today)}>切到今天</button>}</div></section>
    <div className="ledger-progress"><span>{date} · 已核对 {count} / {current.length} 个在用账户</span><button className="text-button" disabled={busy} onClick={openMonthly}>补录整月总额<Icon name="arrow" size={15} /></button></div>
    <div className="ledger-account-list">{current.map(account => <AccountLedgerRow {...props} key={JSON.stringify([account.id, date])} account={account} open={selected === account.id} toggle={() => select(selected === account.id ? undefined : account.id)} done={() => done(account.id)} />)}</div>
    {!!closed.length && <><button className="text-button" onClick={() => setArchived(!archived)} aria-expanded={archived}>{archived ? '收起' : '查看'}已归档账户（{closed.length}）</button>{archived && <div className="ledger-account-list">{closed.map(account => <AccountLedgerRow {...props} key={JSON.stringify([account.id, date])} account={account} open={selected === account.id} toggle={() => select(selected === account.id ? undefined : account.id)} done={() => select(undefined)} />)}</div>}</>}
    {!!journal.accountSettlements?.length && <section className="ledger-estimates" aria-label="已保存的区间收支"><h2>以前核对的区间</h2>{[...journal.accountSettlements].sort((a, b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from)).map(row => <article key={`${row.from}/${row.to}`}><div><strong>{row.from} → {row.to}</strong><small>按保存时确认的余额、收入和盈亏估算</small></div><span>收入 <b>{balanceLabel(row.incomeCents)}</b></span><span>估算支出 <b>{balanceLabel(settlementExpense(row))}</b></span></article>)}</section>}
    </section>
}
