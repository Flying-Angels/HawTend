import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AssetAccount, Fund, Journal } from './model'
import { accountBalance, accountKinds, assetType, assetTypes, availableForPlanning, manualValue, periodGain } from './assets'
import { exactYuan } from './finance'
import { AssetAccounts } from './AssetAccounts'
import { useToday } from './useToday'
import { Icon } from './Icons'

function ValueHistory({ funds }: { funds: Fund[] }) {
  const [id, setId] = useState(''), [all, setAll] = useState(false)
  const fund = funds.find(f => f.id === id) ?? funds[0]
  if (!fund?.valuationBase) return null
  const base = fund.valuationBase, entries = fund.valuations ?? []
  const points = [base, ...entries], values = points.map(p => p.valueCents)
  const min = Math.min(...values) * .96, max = Math.max(Math.max(...values) * 1.04, min + 1)
  const first = Date.parse(base.date), last = Date.parse(points.at(-1)!.date)
  const x = (date: string) => last === first ? 390 : 60 + (Date.parse(date) - first) / (last - first) * 660
  const y = (value: number) => 158 - (value - min) / (max - min) * 120
  const pnl = entries.reduce((sum, e) => sum + periodGain(fund, e), 0)
  return <section className="value-history" aria-label="手动市值历史">
    <div className="section-heading"><div><span className="eyebrow">AS LIFE MOVES, SO DOES YOUR MONEY</span><h2>把真实的变化，慢慢记下来</h2></div>{funds.length > 1 && <label className="history-choose">查看资产<select aria-label="查看市值历史的资产" value={fund.id} onChange={e => { setId(e.target.value); setAll(false) }}>{funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}</div>
    <div className="history-summary"><span>{fund.name} · 市值实录</span><div><small>累计已记录盈亏</small><strong className={pnl < 0 ? 'negative' : ''}>{pnl > 0 ? '+' : ''}¥{exactYuan(pnl)}</strong></div></div>
    {entries.length ? <svg viewBox="0 0 780 199" role="img" aria-label={`${fund.name}的已记录市值历史，没有未来收益预测`}><path d="M60 24V158H720" fill="none" stroke="var(--line)"/><polyline points={points.map(p => `${x(p.date)},${y(p.valueCents)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5"/>{points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.valueCents)} r="3.5" fill="var(--accent)"><title>{p.date} · ¥{exactYuan(p.valueCents)}</title></circle>)}<text x="60" y="185">{base.date.replaceAll('-', '.')}</text><text x="720" y="185" textAnchor="end">{points.at(-1)!.date.replaceAll('-', '.')}</text><text x="60" y="18">市值 / 元</text><text x="720" y="18" textAnchor="end">¥{exactYuan(fund.principalCents)}</text></svg> : <p className="history-empty">已记下初始市值。下次更新后，这里会连起它的变化。</p>}
    <div className="valuation-table" role="table" aria-label={`${fund.name}市值记录`}><div role="row" className="valuation-table-header"><span role="columnheader">记录日期</span><span role="columnheader">市值</span><span role="columnheader">期间盈亏</span><span role="columnheader">净投入 / 现金分红</span></div>{[...entries].reverse().slice(0, all ? undefined : 6).map(e => <div key={e.date} role="row"><span role="cell">{e.date.replaceAll('-', '.')}</span><span role="cell">¥{exactYuan(e.valueCents)}</span><span role="cell" className={periodGain(fund, e) < 0 ? 'negative' : ''}>{periodGain(fund, e) > 0 ? '+' : ''}¥{exactYuan(periodGain(fund, e))}</span><span role="cell">¥{exactYuan(e.netFlowCents)} / ¥{exactYuan(e.cashIncomeCents)}{e.note && <small>{e.note}</small>}</span></div>)}<div role="row" className="valuation-base"><span role="cell">{base.date.replaceAll('-', '.')}<small>初始起点</small></span><span role="cell">¥{exactYuan(base.valueCents)}</span><span role="cell">—</span><span role="cell">不回推更早的盈亏</span></div></div>
    {entries.length > 6 && <button className="text-button" onClick={() => setAll(!all)}>{all ? '收起历史记录' : `查看全部 ${entries.length} 条记录`}</button>}
    <p className="fine-print">期间盈亏已扣除净投入并计入现金分红，包含未实现的市值变化；不自动记作月度收入。实线连接手动记录点，中间日期未记录。</p>
  </section>
}

export function FundsPage({ journal, edit, update, saveAccounts, busy, forecast }: {
  journal: Journal; edit: (fund: Fund) => void; update: (fund: Fund) => void; saveAccounts: (accounts: AssetAccount[]) => Promise<boolean>; busy: boolean; forecast: (funds: Fund[]) => ReactNode
}) {
  const today = useToday(), accounts = journal.accounts ?? []
  const [filter, setFilter] = useState<string | null>(null), [manage, setManage] = useState(false)
  useEffect(() => { if (filter && !accounts.some(a => a.id === filter)) setFilter(null) }, [accounts, filter])
  const funds = journal.funds, total = funds.reduce((sum, f) => sum + f.principalCents, 0)
  const available = funds.filter(f => availableForPlanning(f, today)).reduce((sum, f) => sum + f.principalCents, 0)
  const redeemable = funds.filter(f => assetType(f) === 'fund' && availableForPlanning(f, today)).reduce((sum, f) => sum + f.principalCents, 0)
  const assigned = journal.goals.reduce((sum, g) => sum + g.allocatedCents, 0)
  const visible = funds.filter(f => filter === null || (f.accountId ?? '') === filter)
  const manual = visible.filter(manualValue)
  return <section className="funds-page">
    <div className="fund-summary"><div><span>记录的总资产</span><strong>¥{exactYuan(total)}</strong><p>各资产最近一次记录，余额日期可能不同</p></div><div><span>可用于规划</span><strong>¥{exactYuan(available)}</strong><p>其中可赎回基金 ¥{exactYuan(redeemable)}<br/>不代表全部能即时到账</p></div><div><span>已分配给心愿</span><strong>¥{exactYuan(assigned)}</strong><p>{available >= assigned ? `尚未分配 ¥${exactYuan(available - assigned)}` : `分配缺口 ¥${exactYuan(assigned - available)}`}</p></div></div>
    {assigned > available && <p className="notice" role="status">已预留给心愿的金额超过当前可规划资产 ¥{exactYuan(assigned - available)}。真实余额仍已保留，请回看心愿分配。</p>}
    <div className="section-heading"><div><span className="eyebrow">A PLACE FOR EVERY PART</span><h2>我的资金账户</h2></div><button className="quiet-button" aria-expanded={manage} onClick={() => setManage(!manage)}><Icon name="settings" size={15}/>管理账户</button></div>
    {manage && <AssetAccounts journal={journal} busy={busy} save={saveAccounts} />}
    <div className="account-grid" role="group" aria-label="按资金账户筛选"><button className="account-card all-accounts" aria-pressed={filter === null} onClick={() => setFilter(null)}><Icon name="wallet" size={20}/><span>全部账户</span><strong>¥{exactYuan(total)}</strong><small>{funds.length} 项资产</small></button>{accounts.map(a => <button key={a.id} className="account-card" aria-pressed={filter === a.id} onClick={() => setFilter(filter === a.id ? null : a.id)}><Icon name={a.kind === 'bank' ? 'home' : 'wallet'} size={20}/><span>{a.name}</span><strong>¥{exactYuan(accountBalance(funds, a.id))}</strong><small>{accountKinds[a.kind]} · {funds.filter(f => f.accountId === a.id).length} 项资产</small></button>)}{funds.some(f => !f.accountId) && <button className="account-card unassigned-account" aria-pressed={filter === ''} onClick={() => setFilter(filter === '' ? null : '')}><Icon name="book" size={20}/><span>暂未归到账户</span><strong>¥{exactYuan(accountBalance(funds))}</strong><small>旧记录保留，可以逐项选择账户</small></button>}</div>
    {!accounts.length && <p className="account-empty-hint">先在“管理账户”添加支付宝、微信或银行，再把资产放进对应账户。账户不会再记一份额外余额。</p>}
    <div className="section-heading"><div><span className="eyebrow">MONEY, WITH A PURPOSE</span><h2>{filter === null ? '我的资产明细' : filter === '' ? '尚未归类的资产' : `${accounts.find(a => a.id === filter)?.name ?? '账户'}的资产`}</h2></div><span className="subtle">现金、存款与基金，分别照料</span></div>
    <div className="asset-list">{visible.map(f => {
      const account = accounts.find(a => a.id === f.accountId)
      const latest = f.valuations?.at(-1), gain = latest ? periodGain(f, latest) : null
      const ready = availableForPlanning(f, today)
      return <article key={f.id} className="asset-item"><button className="asset-main" disabled={busy} onClick={() => edit(f)}><span className={`fund-icon ${ready ? 'liquid' : ''}`}><Icon name={assetType(f) === 'fund' ? 'sprout' : ready ? 'wallet' : 'lock'} size={23}/></span><span className="asset-copy"><strong>{f.name}</strong><span>{assetTypes[assetType(f)]}<i>·</i>{account?.name ?? '暂未归到账户'}<i>·</i>{ready ? assetType(f) === 'fund' ? '可赎回' : '可使用' : `${f.maturityDate.replaceAll('-', '.')} 到期`}</span></span><span className="asset-return">{manualValue(f) ? <><strong className="manual-label">手动市值</strong><small>不按固定年化推算</small></> : <><strong>{f.rate.toFixed(2)}<small>%</small></strong><small>{f.mode === 'compound' ? '复利' : '单利'} · 年化假设</small></>}</span><span className="asset-value"><strong>¥{exactYuan(f.principalCents)}</strong><small>{f.startDate.replaceAll('-', '.')} {manualValue(f) ? '市值' : '余额'}</small></span><Icon name="chevron" size={16}/></button>{manualValue(f) && <div className="asset-update"><span>{gain === null ? '下一次更新，开始记录它的变化。' : <>最近期间盈亏 <strong className={gain < 0 ? 'negative' : ''}>{gain > 0 ? '+' : ''}¥{exactYuan(gain)}</strong></>}</span><button className="text-button" disabled={busy} onClick={() => update(f)}><Icon name="edit" size={14}/>更新市值 / 盈亏</button></div>}</article>
    })}</div>
    {!visible.length && <div className="blank-card"><Icon name="wallet" size={29}/><h2>{funds.length ? '这个账户还没有资产。' : '给手里的钱，一个清楚的位置。'}</h2><p>点击“添加资金”，选择账户、类别与更新方式。</p></div>}
    <ValueHistory funds={manual} />
    {visible.length > 0 && forecast(visible)}
    <div className="notice financial-note"><Icon name="leaf" size={20}/><span>手动市值记录与固定年化预测分别呈现。资产之间转账、基金市值浮动，不会自动写入每月收支；账户汇总按名下资产相加。</span></div>
  </section>
}
