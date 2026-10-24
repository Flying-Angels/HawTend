import { useCallback, useEffect, useRef, useState } from 'react'
import type { Moment } from './model'
import { finishMomentDraft, sameMoment, writeMomentDraft } from './moment-drafts'
import type { MomentDraft } from './moment-drafts'

export function useMomentDraft(item: Moment, restored: MomentDraft | undefined, sample: boolean) {
  const [draft, setValue] = useState(restored?.item ?? item)
  const [state, setState] = useState<'empty' | 'saved' | 'failed'>(restored ? 'saved' : 'empty')
  const latest = useRef(draft), identity = useRef(crypto.randomUUID()), base = useRef(restored?.base ?? item)
  const changed = useRef(!!restored), failed = useRef(false), [savedAt, setSavedAt] = useState(restored?.updatedAt ?? '')
  const persist = useCallback(() => {
    if (sample || !changed.current) return true
    const updatedAt = new Date().toISOString()
    const ok = writeMomentDraft({ version: 1, id: identity.current, item: latest.current, base: base.current, updatedAt })
    // Fork a resumed draft before retiring its old copy. Two tabs resuming the
    // same draft then keep separate versions, including under quota failures.
    if (ok && restored) finishMomentDraft(restored.id, { ...restored.item, title: restored.item.title.trim() })
    failed.current = !ok; setState(ok ? 'saved' : 'failed'); if (ok) setSavedAt(updatedAt)
    return ok
  }, [sample, restored])
  const update = (value: Moment | ((current: Moment) => Moment)) => {
    const next = typeof value === 'function' ? value(latest.current) : value
    if (sameMoment(next, latest.current)) return
    latest.current = next; changed.current = true; setValue(next)
    // Write inside the input handler, with no debounce or unmount timing gap.
    persist()
  }
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') persist() }
    const unload = (event: BeforeUnloadEvent) => { if (failed.current) { event.preventDefault(); event.returnValue = '' } }
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', persist); window.addEventListener('beforeunload', unload)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', persist); window.removeEventListener('beforeunload', unload) }
  }, [persist])
  const finish = (published: Moment) => { if (!sample) { finishMomentDraft(identity.current, published); if (restored) finishMomentDraft(restored.id, published) } }
  return { draft, update, state, savedAt, persist, finish }
}
