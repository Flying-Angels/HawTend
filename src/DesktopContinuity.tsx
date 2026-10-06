import { useEffect, useRef, useState } from 'react'
import type { Journal } from './model'
import { assertJournal } from './cloud/journal-validation'
import { Icon } from './Icons'

type DesktopBridge = { postMessage: (message: { type: string; theme?: string }) => void }
declare global {
  interface Window { __HAWTEND_DESKTOP__?: boolean; chrome?: { webview?: DesktopBridge } }
}
export const isDesktop = () => window.__HAWTEND_DESKTOP__ === true && !!window.chrome?.webview
export function desktopTheme(theme: Journal['theme']) { if (isDesktop()) window.chrome!.webview!.postMessage({ type: 'theme', theme }) }
export function blankJournal(journal: Journal) {
  return !journal.moments.length && !journal.goals.length && !journal.funds.length && !journal.monthlySummaries?.length && !journal.accounts?.length
}

// Import is deliberately initiated and confirmed by the user. Nothing reads the
// old browser profile from disk, and populated journals cannot be overwritten.
export function DesktopContinuity({ journal, busy, sample, save, exportData }: {
  journal: Journal; busy: boolean; sample: boolean; save: (journal: Journal) => Promise<boolean>; exportData: () => void
}) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('hawtend-desktop-intro') === 'dismissed' } catch { return false } })
  const [expanded, setExpanded] = useState(false)
  const [candidate, setCandidate] = useState<{ journal: Journal; baseline: string } | null>(null)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const current = useRef({ journal, busy, sample }); current.current = { journal, busy, sample }
  const input = useRef<HTMLInputElement>(null)
  const native = isDesktop(), legacy = !native && new URLSearchParams(location.search).get('legacy-transfer') === '1'
  useEffect(() => {
    const reopen = () => { setDismissed(false); setExpanded(true); setError('') }
    window.addEventListener('hawtend-continue', reopen)
    return () => window.removeEventListener('hawtend-continue', reopen)
  }, [])
  if (legacy) return <section className="desktop-continuity" aria-label="旧手账导出"><Icon name="book" size={25} /><div><h2>这是以前的手账。</h2><p>导出这份记录，再回到新窗口选择文件接续。导出不会移除这里的内容。</p></div><button className="primary-button" disabled={busy || sample} onClick={exportData}><Icon name="download" size={16} />导出旧手账 JSON</button></section>
  if (!native || sample || !blankJournal(journal) || (dismissed && !expanded)) return null
  const dismiss = () => { if (reading || saving) return; setDismissed(true); setExpanded(false); setCandidate(null); setError(''); try { localStorage.setItem('hawtend-desktop-intro', 'dismissed') } catch {} }
  const choose = async (file?: File) => {
    if (!file || current.current.busy || current.current.sample || !blankJournal(current.current.journal)) return
    const baseline = JSON.stringify(current.current.journal)
    setCandidate(null); setError(''); setReading(true)
    try {
      if (file.size > 900_000) throw new Error('文件超过当前手账大小上限，请保留原文件。')
      const parsed: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
      assertJournal(parsed)
      if (current.current.sample || current.current.busy || JSON.stringify(current.current.journal) !== baseline) throw new Error('当前手账已经有变化，请重新选择文件。原有内容已保留。')
      setCandidate({ journal: parsed, baseline })
    } catch (e) { setError(e instanceof SyntaxError ? '这不是有效的 JSON 手账文件，请选择 HawTend 导出的文件。' : e instanceof Error ? e.message : '文件暂时无法读取，原有内容已保留。') }
    finally { setReading(false); if (input.current) input.current.value = '' }
  }
  const confirm = async () => {
    if (!candidate || saving || current.current.busy || current.current.sample) return
    if (JSON.stringify(current.current.journal) !== candidate.baseline || !blankJournal(current.current.journal)) { setCandidate(null); setError('当前手账已经有变化，接续已暂停。'); return }
    setSaving(true)
    try { assertJournal(candidate.journal); if (!await save(candidate.journal)) { setError('接续未保存，请重试。导出的文件和旧手账仍保留。'); return } dismissAfterSave() }
    catch { setError('接续暂时未完成，请保留导出文件并重试。') }
    finally { setSaving(false) }
  }
  const dismissAfterSave = () => { setCandidate(null); setExpanded(false); setDismissed(true); try { localStorage.setItem('hawtend-desktop-intro', 'dismissed') } catch {} }
  return <section className={`desktop-continuity ${expanded ? 'expanded' : ''}`} aria-label="接续旧手账">
    <Icon name="book" size={25} /><div className="continuity-copy"><h2>换了新窗口，日子可以接着记。</h2><p>如果以前已有记录，可以把它们接到这里。旧手账仍留在原来的浏览器中。</p>
      {expanded && <div className="continuity-steps">
        <p>1. 打开旧手账，点击“导出旧手账 JSON”。</p><button className="quiet-button" disabled={busy || reading || saving} onClick={() => window.chrome!.webview!.postMessage({ type: 'legacy-open' })}>打开旧手账<Icon name="arrow" size={15} /></button>
        <p>2. 回到这个窗口，选择刚才导出的文件。</p><button className="quiet-button" disabled={busy || reading || saving} onClick={() => input.current?.click()}><Icon name="download" size={15} />{reading ? '正在读取…' : '选择手账 JSON'}</button>
        <input ref={input} type="file" accept=".json,application/json" hidden aria-label="选择旧手账文件" onChange={e => void choose(e.target.files?.[0])} />
        {candidate && <div className="continuity-confirm"><p>这份手账有 {candidate.journal.moments.length} 个日子、{candidate.journal.goals.length} 个心愿、{candidate.journal.funds.length} 笔资金、{candidate.journal.monthlySummaries?.length ?? 0} 个月的收支。确认后会保存到此窗口。</p><button className="primary-button" disabled={busy || saving} onClick={() => void confirm()}>{saving ? '正在收好…' : '确认接续这份手账'}</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>}
    </div><div className="continuity-actions">{!expanded && <button className="primary-button" disabled={busy} onClick={() => setExpanded(true)}>接续旧手账<Icon name="arrow" size={15} /></button>}<button className="text-button" disabled={reading || saving} onClick={dismiss}>{expanded ? '稍后接续' : '从空白开始'}</button></div>
  </section>
}
