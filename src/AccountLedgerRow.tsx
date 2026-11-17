import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AccountUpdate } from './account-ledger'
import { assetTypes, assetType, manualValue } from './assets'
import { exactYuan } from './finance'
import { Icon } from './Icons'
import { readMoney } from './ledger-money'
import type { Journal } from './model'

export function AccountLedgerRow({ account, date, journal, open, toggle, done, busy, saveBalance }: {
  account: { id: string | null; name: string; active: boolean }; date: string; journal: Journal; open: boolean; toggle: () => void; done: () => void
  busy: boolean; saveBalance: (update: AccountUpdate) => Promise<boolean>
}) {
  const snapshots = (journal.accountSnapshots ?? []).filter(s => s.accountId === account.id).sort((a,b) => b.date.localeCompare(a.date))
  const recorded = snapshots.find(s => s.date === date), latest = snapshots[0]
  const funds = journal.funds.filter(f => (f.accountId ?? null) === account.id)
  const total = funds.reduce((sum, f) => sum + f.principalCents, 0)
  const historical = !account.active || funds.some(f => f.startDate > date) || Boolean(latest && date < latest.date)
  return <article className="ledger-account"><div className="ledger-account-row"><Icon name="wallet" size={21} /><div><strong>{account.name}</strong><small>{recorded ? `已核对 ${date}` : account.active ? latest ? `最近核对 ${latest.date}` : '尚未建立余额记录' : '已归档 · 可补录历史'}</small></div><span className="ledger-balance"><b>¥{exactYuan(recorded?.balanceCents ?? (account.active ? total : latest?.balanceCents ?? 0))}</b><small>{recorded ? '当天余额' : account.active ? '资金安排中的记录' : '最近核对'}</small></span><button className="quiet-button" disabled={busy} aria-expanded={open} onClick={toggle}>{open ? '收起' : recorded ? '更正余额' : '更新余额'}</button></div>
    {open && <BalanceForm key={date} accountId={account.id} date={date} funds={funds} historical={historical} recorded={recorded?.balanceCents} save={saveBalance} done={done} busy={busy} />}
    {open && snapshots.length > 0 && <details className="ledger-account-history"><summary>余额历史（{snapshots.length}）</summary><ul>{snapshots.slice(0, 12).map(s => <li key={s.date}><span>{s.date}</span><b>¥{exactYuan(s.balanceCents)}</b></li>)}</ul>{snapshots.length > 12 && <p className="fine-print">此处显示最近 12 次。可通过顶部日期查看更早记录。</p>}</details>}
  </article>
}

function BalanceForm({ accountId, date, funds, historical, recorded, save, done, busy }: {
  accountId: string | null; date: string; funds: Journal['funds']; historical: boolean; recorded?: number
  save: (update: AccountUpdate) => Promise<boolean>; done: () => void; busy: boolean
}) {
  const [historyOnly, setHistoryOnly] = useState(historical)
  const [newCashId] = useState(() => crypto.randomUUID())
  const [historyAmount, setHistoryAmount] = useState(recorded === undefined ? '' : String(recorded / 100))
  const [fields, setFields] = useState(() => funds.length ? funds.map(f => {
    const v = f.valuations?.find(row => row.date === date)
    return { id: f.id, name: f.name, amount: String(f.principalCents / 100), manual: manualValue(f), type: assetTypes[assetType(f)], netFlow: String((v?.netFlowCents ?? 0) / 100), distribution: String((v?.cashIncomeCents ?? 0) / 100) }
  }) : [{ id: newCashId, name: '账户余额', amount: recorded === undefined ? '' : String(recorded / 100), manual: false, type: '现金余额', netFlow: '0', distribution: '0' }])
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  const derived = fields.map(f => ({ id: f.id, balanceCents: readMoney(f.amount), netFlowCents: readMoney(f.netFlow, true), distributionCents: readMoney(f.distribution) }))
  const total = historyOnly ? readMoney(historyAmount) : derived.every(a => a.balanceCents !== null) ? derived.reduce((sum, a) => sum + a.balanceCents!, 0) : null
  const update = (id: string, key: 'amount' | 'netFlow' | 'distribution', value: string) => setFields(current => current.map(f => f.id === id ? { ...f, [key]: value } : f))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (total === null || !historyOnly && derived.some(a => a.netFlowCents === null || a.distributionCents === null)) { setError('请填写有效金额，最多两位小数；没有余额时填 0。'); return }
    const input: AccountUpdate = historyOnly ? { accountId, date, balanceCents: total } : { accountId, date, newCashId, assets: derived.map(a => ({ id: a.id, balanceCents: a.balanceCents!, netFlowCents: a.netFlowCents!, distributionCents: a.distributionCents! })) }
    setPending(true)
    try { if (await save(input)) done(); else setError('余额未保存，填写内容仍在这里。') }
    catch (e) { setError(e instanceof Error ? e.message : '余额未保存，请重试。') }
    finally { setPending(false) }
  }
  return <form className="editor ledger-balance-form" onSubmit={submit} noValidate>
    <p className="fine-print">记录的是 {date} 的实际余额。{historyOnly ? '只补录当天总额，不改资金安排里的余额或市值。' : funds.length > 1 ? '分别核对账户内各项资产，总额自动相加，不重复记一份。' : '保存后同步更新资金安排中的余额。'}</p>
    {!historical && <label className="ledger-debt"><input type="checkbox" checked={historyOnly} onChange={e => { if (e.target.checked && !historyAmount && total !== null) setHistoryAmount(String(total / 100)); setHistoryOnly(e.target.checked) }} />只记录当天总额，暂不更新资产明细</label>}
    {historyOnly ? <label>当天账户总额 / 元<input inputMode="decimal" value={historyAmount} onChange={e => setHistoryAmount(e.target.value)} required /></label> : <div className="ledger-assets">{fields.map(f => <div key={f.id}><label>{f.name} / 元<input inputMode="decimal" value={f.amount} onChange={e => update(f.id, 'amount', e.target.value)} required /></label>{f.manual && <details><summary>这项资产有买入、赎回或现金分红？</summary><div className="form-grid"><label>净投入 / 元<input inputMode="decimal" value={f.netFlow} onChange={e => update(f.id, 'netFlow', e.target.value)} /></label><label>现金分红 / 元<input inputMode="decimal" value={f.distribution} onChange={e => update(f.id, 'distribution', e.target.value)} /></label></div><p className="fine-print">从上次市值记录起计算。净投入 = 买入 − 赎回；已在市值中的红利再投不重复填写。</p></details>}</div>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-footer"><span>合计 {total === null ? '待填写' : `¥${exactYuan(total)}`}{recorded !== undefined && ' · 更正同日记录'}</span><button className="primary-button" type="submit" disabled={pending || busy}>{pending ? '正在保存…' : '保存这个账户'}<Icon name="check" size={15} /></button></div>
  </form>
}
