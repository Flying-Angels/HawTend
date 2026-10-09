import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AssetAccount, AssetType, Fund, Journal, Valuation } from './model'
import { assetType, assetTypes, manualValue, periodGain, recordValuation, validAssetDate } from './assets'
import { cents, exactYuan, futureValue } from './finance'
import { localDay, yearsAfter } from './calendar'
import { useToday } from './useToday'
import { AssetAccounts } from './AssetAccounts'
import { Icon } from './Icons'
import { CalendarField } from './CalendarField'

const validAmount = (v: string, signed = false) => (signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(v) && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 100_000_000

export function FundEditor({ item, fresh, journal, save, saveAccounts, update, busy }: {
  item: Fund; fresh?: boolean; journal: Journal; save: (fund: Fund) => Promise<boolean>; saveAccounts: (accounts: AssetAccount[]) => Promise<boolean>; update: () => void; busy: boolean
}) {
  const today = useToday()
  const [draft, setDraft] = useState<Fund>({ ...item, assetType: assetType(item), returnMode: item.returnMode ?? 'fixed' })
  const [amount, setAmount] = useState(String(item.principalCents / 100))
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [accountsOpen, setAccountsOpen] = useState(false)
  const recorded = !fresh && manualValue(item)
  const lockedHistory = Boolean(item.valuations?.length)
  const isManual = manualValue(draft)
  const metadataChanged = draft.name !== item.name || draft.accountId !== item.accountId || draft.assetType !== assetType(item) || draft.liquid !== item.liquid || draft.maturityDate !== item.maturityDate
  const changeType = (type: AssetType) => setDraft({ ...draft, assetType: type, returnMode: type === 'fund' || lockedHistory ? 'manual' : draft.returnMode })
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!draft.name.trim() || !validAmount(amount) || !validAssetDate(draft.startDate) || draft.startDate > localDay()) { setError('请填写资产名称、非负金额与不晚于今天的有效余额日期，金额最多两位小数。'); return }
    if (draft.accountId && !journal.accounts?.some(a => a.id === draft.accountId)) { setError('所选账户已不存在，请重新选择所在账户。'); return }
    if (!isManual && (!Number.isFinite(draft.rate) || draft.rate < 0 || draft.rate > 30)) { setError('请填写 0–30% 之间的年化假设。'); return }
    const earliest = isManual && recorded ? item.valuationBase!.date : draft.startDate
    if (!draft.liquid && (!validAssetDate(draft.maturityDate) || draft.maturityDate <= earliest)) { setError('请设置晚于初始余额日期的到期日期。'); return }
    let next = { ...draft, name: draft.name.trim(), principalCents: cents(amount), maturityDate: draft.liquid ? '' : draft.maturityDate }
    if (isManual && !recorded) next = { ...next, valuationBase: { date: next.startDate, valueCents: next.principalCents }, valuations: [] }
    if (recorded && isManual) next = { ...next, principalCents: item.principalCents, startDate: item.startDate }
    setPending(true)
    try { if (!await save(next)) setError('保存未完成，填写内容仍在这里，请重试。') }
    catch { setError('保存未完成，填写内容仍在这里，请重试。') }
    finally { setPending(false) }
  }
  const previewDate = draft.liquid && validAssetDate(draft.startDate) ? yearsAfter(draft.startDate, 1) : draft.maturityDate
  return <form className="editor fund-editor" onSubmit={submit} noValidate>
    <label>这项资产的名字<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="例如，日常余额或一只基金" /></label>
    <div className="form-grid"><label>资产类别<select value={draft.assetType} onChange={e => changeType(e.target.value as AssetType)}>{Object.entries(assetTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="account-field"><div className="account-field-label"><label htmlFor="fund-account">所在账户</label><button type="button" className="text-button" aria-expanded={accountsOpen} onClick={() => setAccountsOpen(!accountsOpen)}><Icon name="settings" size={12} />管理账户</button></div><select id="fund-account" value={draft.accountId ?? ''} onChange={e => setDraft({ ...draft, accountId: e.target.value || undefined })}><option value="">暂未归到账户</option>{(journal.accounts ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div>
    {accountsOpen && <AssetAccounts journal={journal} busy={busy || pending} save={saveAccounts} created={id => setDraft(current => ({ ...current, accountId: id }))} />}
    <label>收益记录方式<select value={draft.returnMode} onChange={e => setDraft({ ...draft, returnMode: e.target.value as Fund['returnMode'] })}><option value="fixed" disabled={lockedHistory}>固定年化假设 · 用于规划</option><option value="manual">手动更新市值 · 记录真实变化</option></select></label>
    {recorded && isManual ? <div className="current-valuation"><div><span>当前记录的市值</span><strong>¥{exactYuan(item.principalCents)}</strong><small>截至 {item.startDate.replaceAll('-', '.')}</small></div><button type="button" className="quiet-button" disabled={metadataChanged || busy || pending} title={metadataChanged ? '请先保存修改的资产资料。' : undefined} onClick={update}><Icon name="edit" size={15} />更新市值 / 盈亏</button>{metadataChanged && <p className="fine-print">先保存资产资料，再更新市值。</p>}</div> : <div className="form-grid"><label>{isManual ? '初始市值 / 元' : '记录余额 / 元'}<input type="number" inputMode="decimal" min="0" step=".01" value={amount} onChange={e => setAmount(e.target.value)} /></label><CalendarField label="余额日期" max={today} value={draft.startDate} change={date => setDraft({ ...draft, startDate: date })} /></div>}
    {isManual ? <p className="fine-print">首次填写作为市值起点，之后点“更新市值 / 盈亏”记录变化，不自动套用年化收益。有市值历史后保留手动记录方式；账户、名称与资产类别仍可修改。</p> : <><div className="form-grid"><label>年化收益假设 / %<input type="number" min="0" max="30" step=".01" value={draft.rate} onChange={e => setDraft({ ...draft, rate: Number(e.target.value) })} /></label><label>计息方式<select value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as Fund['mode'] })}><option value="compound">复利 · 利息继续投入</option><option value="simple">单利 · 按记录余额计息</option></select></label></div><p className="fine-print">余额视为截至记录日已结算的金额，之前的利息不重复累加。未投入的钱可用 0% 年化。</p></>}
    <label>资金可用性<select value={draft.liquid ? 'liquid' : 'locked'} onChange={e => setDraft({ ...draft, liquid: e.target.value === 'liquid' })}><option value="liquid">{draft.assetType === 'fund' ? '可赎回 · 不锁定到期日' : '可使用 · 不锁定到期日'}</option><option value="locked">锁定 · 到期可用</option></select></label>
    {!draft.liquid && <CalendarField label="到期日期" min={draft.valuationBase?.date ?? draft.startDate} value={draft.maturityDate} change={date => setDraft({ ...draft, maturityDate: date })} />}
    {!isManual && validAssetDate(draft.startDate) && validAssetDate(previewDate) && <div className="forecast-box"><span className="eyebrow">{draft.liquid ? '一年后预计余额' : '到期预计余额'}</span><div className="forecast-number"><small>¥</small>{exactYuan(futureValue({ ...draft, principalCents: cents(amount || 0) }, previewDate))}</div><p>按固定年化假设计算，不代表实际到账；到期后默认零收益。</p></div>}
    <p className="fine-print">账户现金只记录闲置部分，基金等资产另列，账户会自动合计。可赎回资产计入规划池，到账时间按实际产品处理。</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="editor-footer"><span>本机保存 · 可撤销</span><button className="primary-button" disabled={busy || pending} type="submit">{pending ? '正在保存…' : '保存资金安排'}<Icon name="check" size={15} /></button></div>
  </form>
}

export function ValuationEditor({ item, save, busy }: { item: Fund; save: (fund: Fund) => Promise<boolean>; busy: boolean }) {
  const today = useToday()
  const sameDate = item.valuations?.find(v => v.date === localDay())
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<'value' | 'gain'>('value')
  const [value, setValue] = useState(String(item.principalCents / 100)), [gain, setGain] = useState(sameDate ? String(periodGain(item, sameDate) / 100) : '0')
  const [flow, setFlow] = useState(String((sameDate?.netFlowCents ?? 0) / 100)), [cash, setCash] = useState(String((sameDate?.cashIncomeCents ?? 0) / 100)), [note, setNote] = useState(sameDate?.note ?? '')
  const [details, setDetails] = useState(Boolean(sameDate && (sameDate.netFlowCents || sameDate.cashIncomeCents))), [error, setError] = useState(''), [pending, setPending] = useState(false)
  const base = item.valuationBase!
  const last = item.valuations?.at(-1) ?? base
  const prior = item.valuations?.filter(v => v.date < date).at(-1) ?? base
  const existing = item.valuations?.find(v => v.date === date)
  const netFlow = cents(flow || 0), cashIncome = cents(cash || 0)
  const amount = method === 'gain' ? prior.valueCents + netFlow + cents(gain || 0) - cashIncome : cents(value || 0)
  const record: Valuation = { date, valueCents: amount, netFlowCents: netFlow, cashIncomeCents: cashIncome, note: note.trim() }
  const pnl = Number.isFinite(amount) ? periodGain(item, record) : 0
  const chooseDate = (next: string) => {
    setDate(next); setError('')
    const snapshot = item.valuations?.find(v => v.date === next)
    if (snapshot) {
      setValue(String(snapshot.valueCents / 100)); setFlow(String(snapshot.netFlowCents / 100)); setCash(String(snapshot.cashIncomeCents / 100)); setNote(snapshot.note)
      setGain(String(periodGain(item, snapshot) / 100)); setDetails(snapshot.netFlowCents !== 0 || snapshot.cashIncomeCents !== 0)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!validAssetDate(date) || date > localDay() || date < last.date) { setError('日期不能早于最近一次市值，也不能晚于今天；同日记录可修改。'); return }
    if (!validAmount(method === 'value' ? value : gain, method === 'gain') || !validAmount(flow, true) || !validAmount(cash) || amount < 0 || amount > 10_000_000_000) { setError('请填写有效金额，最多两位小数；盈亏和净投入可为负，市值和现金分红不能为负。'); return }
    try {
      const next = recordValuation(item, record)
      setPending(true); const ok = await save(next); setPending(false)
      if (!ok) setError('市值未保存，填写内容仍在这里，请重试。')
    } catch (failure) { setError(failure instanceof Error ? failure.message : '请检查记录金额。') }
    finally { setPending(false) }
  }
  return <form className="editor valuation-editor" onSubmit={submit} noValidate>
    <div className="valuation-reference"><Icon name="wallet" size={22} /><div><strong>{item.name}</strong><span>最近记录 ¥{exactYuan(item.principalCents)} · {item.startDate.replaceAll('-', '.')}</span></div></div>
    <CalendarField label="记录日期" min={last.date} max={today} value={date} change={chooseDate} />
    <div className="valuation-method" role="group" aria-label="市值填写方式"><button type="button" aria-pressed={method === 'value'} onClick={() => { if (method !== 'value') setValue(String(amount / 100)); setMethod('value') }}>填写最新市值</button><button type="button" aria-pressed={method === 'gain'} onClick={() => { if (method !== 'gain') setGain(String(pnl / 100)); setMethod('gain') }}>填写期间盈亏</button></div>
    {method === 'value' ? <label>最新市值 / 元<input type="number" min="0" step=".01" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /></label> : <label>本次期间盈亏 / 元<input type="number" step=".01" inputMode="decimal" value={gain} onChange={e => setGain(e.target.value)} /><span className="fine-print">盈利填正数，亏损填负数；按上次记录到本次记录的期间填写。</span></label>}
    <button type="button" className="text-button valuation-flow-toggle" aria-expanded={details} onClick={() => setDetails(!details)}>{details ? '收起资金进出' : '期间有买入、赎回或现金分红？'}<Icon name="chevron" size={13} /></button>
    {details && <div className="valuation-flows"><div className="form-grid"><label>期间净投入 / 元<input type="number" step=".01" value={flow} onChange={e => setFlow(e.target.value)} /></label><label>现金分红或派息 / 元<input type="number" min="0" step=".01" value={cash} onChange={e => setCash(e.target.value)} /></label></div><p className="fine-print">净投入 = 追加买入 − 赎回转出，转出较多可填负数。现金分红填实际转出的分红；红利再投已在市值中，不再填一次。</p></div>}
    <div className="valuation-preview"><div><span>记录后市值</span><strong>¥{exactYuan(Number.isFinite(amount) ? amount : 0)}</strong></div><div><span>期间盈亏 · 含现金分红</span><strong className={pnl < 0 ? 'negative' : ''}>{pnl > 0 ? '+' : ''}¥{exactYuan(pnl)}</strong></div></div>
    <p className="fine-print">盈亏 = 本次市值 − 上次市值 − 净投入 + 现金分红。初始起点 {base.date.replaceAll('-', '.')} · ¥{exactYuan(base.valueCents)}。这里包含市值浮动，不会自动记入月度收入或其他账户余额。</p>
    {existing && <p className="notice">这一天已有市值记录，保存将替换该日记录，可以撤销。</p>}
    <label>补充说明<textarea rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="可留空，记录这次变化的原因。" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="editor-footer"><span>仅本机保存 · 可撤销</span><button className="primary-button" disabled={busy || pending} type="submit">{pending ? '正在保存…' : '保存市值记录'}<Icon name="check" size={15} /></button></div>
  </form>
}
