import { useState } from 'react'
import { Icon } from './Icons'
import { downloadMomentDraft, removeMomentDraft } from './moment-drafts'
import type { MomentDraft } from './moment-drafts'

export function MomentDraftList({ drafts, resume, refresh }: { drafts: MomentDraft[]; resume: (draft: MomentDraft) => void; refresh: () => void }) {
  const [deleting, setDeleting] = useState(''), [error, setError] = useState('')
  return <div className="moment-draft-list"><p>文字会自动留在这台设备。确认写好后，再收进正式手账。</p>{!drafts.length && <p>没有待续写的草稿。</p>}{drafts.map(draft => <article key={draft.id}>
    <span className="eyebrow">{draft.item.date.replaceAll('-', '.')} · 草稿</span><h3>{draft.item.title || '还没写标题的日子'}</h3>
    <p className="draft-excerpt">{(draft.item.story || draft.item.reflection || '这一页还可以慢慢补充。').slice(0, 110)}</p>
    <small>自动保存于 {new Date(draft.updatedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</small>
    <div className="draft-actions"><button className="quiet-button" onClick={() => resume(draft)}>继续写<Icon name="arrow" size={15} /></button><button className="text-button" onClick={() => downloadMomentDraft(draft.item)}>下载草稿</button><button className="text-button draft-delete" onClick={() => setDeleting(draft.id)}>删除草稿</button></div>
    {deleting === draft.id && <div className="draft-delete-confirm"><p>确定删除这份草稿？正式手账中的记录不受影响。</p><div className="draft-actions"><button className="quiet-button" onClick={() => setDeleting('')}>保留草稿</button><button className="quiet-button" onClick={() => { if (removeMomentDraft(draft.id)) { setDeleting(''); setError(''); refresh() } else setError('草稿未能删除，请重试。') }}>确认删除</button></div></div>}
  </article>)}{error && <p className="form-error" role="alert">{error}</p>}</div>
}
