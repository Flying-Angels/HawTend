import { useId, useState } from 'react'
import type { AssetAccount, Journal } from './model'
import { accountKinds, isAssetAccounts } from './assets'
import { Icon } from './Icons'

export function AssetAccounts({ journal, busy, save, created }: {
  journal: Journal; busy: boolean; save: (accounts: AssetAccount[]) => Promise<boolean>; created?: (id: string) => void
}) {
  const accounts = journal.accounts ?? []
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState(''), [kind, setKind] = useState<AssetAccount['kind']>('payment')
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  const nameId = useId(), kindId = useId()
  const start = (account?: AssetAccount, suggestion?: string) => { setEditing(account?.id ?? 'new'); setName(account?.name ?? suggestion ?? ''); setKind(account?.kind ?? (suggestion?.includes('银行') ? 'bank' : 'payment')); setError('') }
  const submit = async () => {
    const account: AssetAccount = { id: editing === 'new' ? crypto.randomUUID() : editing!, name: name.trim(), kind }
    const next = editing === 'new' ? [...accounts, account] : accounts.map(a => a.id === editing ? account : a)
    if (!isAssetAccounts(next)) { setError('名称需填写 1–40 个字，不能和已有账户重名；最多支持 100 个账户。'); return }
    setPending(true)
    const ok = await save(next)
    setPending(false)
    if (ok) { setEditing(null); setError(''); if (editing === 'new') created?.(account.id) }
    else setError('账户未保存，填写内容仍在这里，请重试。')
  }
  return <section className="asset-account-manager" aria-label="管理资金账户">
    <div className="section-heading"><div><h3>钱放在哪里，由你设置。</h3><p>账户名称可以是平台、银行或一张具体的卡。</p></div><button type="button" className="quiet-button" disabled={busy || pending} onClick={() => start()}><Icon name="plus" size={15} />添加账户</button></div>
    {!accounts.length && editing === null && <div className="account-suggestions"><span>从常用的一个开始</span>{['支付宝', '微信', '招商银行'].map(s => <button type="button" className="filter-chip" key={s} onClick={() => start(undefined, s)}>{s}<Icon name="plus" size={12} /></button>)}</div>}
    <div className="asset-account-list">{accounts.map(account => {
      const count = journal.funds.filter(f => f.accountId === account.id).length
      return <div key={account.id}><Icon name={account.kind === 'bank' ? 'home' : 'wallet'} size={17} /><span><strong>{account.name}</strong><small>{accountKinds[account.kind]} · {count} 项资产</small></span><button type="button" className="text-button" disabled={busy || pending} onClick={() => start(account)}>编辑</button><button type="button" className="text-button" disabled={busy || pending || count > 0} title={count ? '请先将资产移到其他账户，再删除账户。' : '删除这个空账户，可撤销。'} onClick={async () => { setPending(true); const ok = await save(accounts.filter(a => a.id !== account.id)); setPending(false); if (!ok) setError('删除未完成，请重试。') }}>删除</button></div>
    })}</div>
    {editing !== null && <div className="account-inline-editor" role="group" aria-label="账户资料" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!pending && !busy) void submit() } }}>
      <div className="form-grid"><label htmlFor={nameId}>账户名称<input id={nameId} value={name} maxLength={40} placeholder="例如，招商银行储蓄卡" onChange={e => setName(e.target.value)} /></label><label htmlFor={kindId}>账户类型<select id={kindId} value={kind} onChange={e => setKind(e.target.value as AssetAccount['kind'])}>{Object.entries(accountKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="account-inline-actions"><button type="button" className="text-button" disabled={pending} onClick={() => { setEditing(null); setError('') }}>取消</button><button type="button" className="quiet-button" disabled={busy || pending} onClick={submit}>{pending ? '正在保存…' : '保存账户'}<Icon name="check" size={15} /></button></div>
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <p className="fine-print">账户总额由名下资产合计，不需要再填一次总金额。有资产的账户需先移动资产，才能删除。</p>
  </section>
}
