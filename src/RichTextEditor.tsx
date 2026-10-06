import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { TextFormat } from './model'
import { RichText } from './RichText'

type Snapshot = { value: string; format?: TextFormat; start: number; end: number }
const tools = [
  { key: 'b', label: '加粗', glyph: 'B', before: '**', after: '**', placeholder: '加粗文字' },
  { key: 'i', label: '斜体', glyph: 'I', before: '*', after: '*', placeholder: '斜体文字' },
  { key: 'u', label: '下划线', glyph: 'U', before: '<u>', after: '</u>', placeholder: '下划线文字' },
  { key: 'math', label: '行内公式', glyph: '𝑓𝑥', before: '$', after: '$', placeholder: 'x^2' },
  { key: 'block', label: '独立公式', glyph: '∑', before: '$$\n', after: '\n$$', placeholder: '\\frac{a}{b}' },
] as const

export function RichTextEditor({ label, value, format, change, placeholder, note }: {
  label: string; value: string; format?: TextFormat; change: (value: string, format?: TextFormat) => void; placeholder: string; note?: string
}) {
  const id = useId()
  const input = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({ start: 0, end: 0 })
  const undo = useRef<Snapshot[]>([]), redo = useRef<Snapshot[]>([])
  const [preview, setPreview] = useState(false)
  const [help, setHelp] = useState(false)
  const remember = () => { const el = input.current; if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd } }
  const snapshot = (): Snapshot => ({ value, format, ...selection.current })
  const commit = (text: string, nextFormat: TextFormat | undefined, start?: number, end = start) => {
    undo.current = [...undo.current.slice(-99), snapshot()]; redo.current = []
    change(text, nextFormat)
    if (start !== undefined) requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start, end!); remember() })
  }
  const history = (back: boolean) => {
    const from = back ? undo : redo, to = back ? redo : undo
    const previous = from.current.pop()
    if (!previous) return
    to.current.push(snapshot()); change(previous.value, previous.format)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(previous.start, previous.end); remember() })
  }
  const apply = (key: typeof tools[number]['key']) => {
    const tool = tools.find(t => t.key === key)!
    const { start, end } = selection.current
    const selected = value.slice(start, end) || tool.placeholder
    // Block formulas must occupy their own lines even when inserted mid-paragraph.
    const leading = key === 'block' && start > 0 && value[start - 1] !== '\n' ? '\n\n' : ''
    const trailing = key === 'block' && end < value.length && value[end] !== '\n' ? '\n\n' : ''
    const prefix = leading + tool.before
    commit(value.slice(0, start) + prefix + selected + tool.after + trailing + value.slice(end), 'markdown', start + prefix.length, start + prefix.length + selected.length)
  }
  const shortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.nativeEvent.isComposing) return
    const key = event.key.toLowerCase()
    if (['b', 'i', 'u'].includes(key)) { event.preventDefault(); remember(); apply(key as 'b' | 'i' | 'u') }
    if (key === 'z' || key === 'y') { event.preventDefault(); history(key === 'z' && !event.shiftKey) }
  }
  return <section className="journal-writing" aria-label={label}>
    <div className="writing-heading"><label htmlFor={preview ? `${id}-preview` : id}>{label}</label>{note && <small>{note}</small>}</div>
    <div className="writing-sheet">
      <div className="writing-toolbar" role="group" aria-label={`${label}编辑工具`}>
        <div className="format-tools">{tools.map(tool => <button key={tool.key} type="button" className={`format-tool format-${tool.key}`} disabled={preview}
          aria-label={tool.label} title={`${tool.label}${['b', 'i', 'u'].includes(tool.key) ? ` (Ctrl/⌘+${tool.key.toUpperCase()})` : ''}`}
          onMouseDown={e => e.preventDefault()} onClick={() => apply(tool.key)}>{tool.glyph}</button>)}
          <button type="button" className="format-tool" aria-label="格式说明" aria-expanded={help} aria-controls={`${id}-help`} onClick={() => setHelp(!help)}>?</button>
        </div>
        <div className="writing-modes">{format !== 'markdown' && <button type="button" className="enable-format" onClick={() => commit(value, 'markdown')}>启用格式</button>}
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>编辑</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>预览</button></div>
      </div>
      {help && <div className="writing-help" id={`${id}-help`}><p>选中文字后点击工具，可加粗、斜体或加下划线。Ctrl/⌘ + B、I、U 也可以；Ctrl/⌘ + Z 撤销。</p><p>行内公式：<code>$x^2$</code>；独立公式：用 <code>$$</code> 单独占行包住公式。点击“预览”查看排版。</p><p>也支持 Markdown 列表、引用和链接。旧记录按普通文字显示，点击工具或“启用格式”后才解析语法。公式有误时会保留源文，请返回编辑修改。</p></div>}
      {preview ? <div id={`${id}-preview`} className="writing-preview" role="region" aria-label={`${label}预览`} tabIndex={0}>
        {value ? <RichText value={value} format={format} /> : <p className="preview-placeholder">{placeholder}</p>}
      </div> : <textarea ref={input} id={id} rows={5} value={value} placeholder={placeholder} onSelect={remember} onClick={remember} onKeyDown={shortcut}
        onChange={e => { commit(e.target.value, format); selection.current = { start: e.target.selectionStart, end: e.target.selectionEnd } }} />}
    </div>
    <p className="writing-hint">{format === 'markdown' ? '支持文字格式与 LaTeX 公式 · 预览查看效果' : '原记录保留为普通文字 · 可启用格式'}</p>
  </section>
}
