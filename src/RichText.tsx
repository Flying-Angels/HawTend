import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import type { PluggableList } from 'unified'
import type { TextFormat } from './model'
import 'katex/dist/katex.min.css'

// Sanitize user HTML first, then render trusted KaTeX output. Never allow remote images.
const plugins: PluggableList = [rehypeRaw, [rehypeSanitize, {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []).filter(tag => tag !== 'img'), 'u'],
  attributes: { ...defaultSchema.attributes, code: [['className', /^language-./, 'math-inline', 'math-display']] },
}], [rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 500, maxSize: 10, errorColor: '#a15c47' }]]

export const RichText = memo(function RichText({ value, format, summary = false }: { value: string; format?: TextFormat; summary?: boolean }) {
  return <div className={`journal-prose${format !== 'markdown' ? ' plain-prose' : ''}`}>
    {format === 'markdown' ? <Markdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={plugins}
      components={{ a: ({ children, href }) => summary ? <span>{children}</span> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{value}</Markdown> : value}
  </div>
})
