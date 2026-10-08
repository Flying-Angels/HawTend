import { useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Icon } from './Icons'
import { useToday } from './useToday'
import { MAX_TIMELINE_MONTHS, TIMELINE_PRESETS, lastTimelineMonth, monthIndex, timelineRange, timelineSpanLabel } from './timeline-range'
import type { TimelineRange } from './timeline-range'

const firstYear = 1900, lastYear = 2200
const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`

export function MonthRangeEditor({ range, apply, close }: { range: TimelineRange; apply: (range: TimelineRange) => void; close: () => void }) {
  const today = useToday().slice(0, 7)
  const [start, setStart] = useState(range.startMonth)
  const [end, setEnd] = useState(lastTimelineMonth(range))
  const [active, setActive] = useState<'start' | 'end'>('start')
  const [year, setYear] = useState(Number(range.startMonth.slice(0, 4)))
  const [yearsOpen, setYearsOpen] = useState(false)
  const [jumpYear, setJumpYear] = useState(String(year))
  const [jumpError, setJumpError] = useState('')
  const [error, setError] = useState('')
  const [focusedMonth, setFocusedMonth] = useState(Number(start.slice(5)) - 1)
  const monthButtons = useRef<(HTMLButtonElement | null)[]>([])
  const yearButton = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<'month' | 'year' | null>(null)
  const selected = active === 'start' ? start : end
  const months = monthIndex(end) - monthIndex(start) + 1
  const valid = months > 0 && months <= MAX_TIMELINE_MONTHS
  const yearPage = firstYear + Math.floor((year - firstYear) / 12) * 12

  useLayoutEffect(() => {
    if (pendingFocus.current === 'month') monthButtons.current[focusedMonth]?.focus()
    if (pendingFocus.current === 'year') yearButton.current?.focus()
    pendingFocus.current = null
  }, [year, focusedMonth, yearsOpen])

  const choose = (month: string) => { if (active === 'start') setStart(month); else setEnd(month); setError('') }
  const activate = (field: 'start' | 'end') => {
    const month = field === 'start' ? start : end
    setActive(field); setYear(Number(month.slice(0, 4))); setFocusedMonth(Number(month.slice(5)) - 1); setYearsOpen(false); setJumpError('')
  }
  const showYear = (next: number) => { setYear(Math.max(firstYear, Math.min(lastYear, next))); setJumpError('') }
  const closeYears = () => { pendingFocus.current = 'year'; setYearsOpen(false) }
  const pickYear = (next: number) => { showYear(next); closeYears() }
  const jump = () => {
    const next = Number(jumpYear)
    if (!jumpYear.trim() || !Number.isInteger(next) || next < firstYear || next > lastYear) { setJumpError('请填写 1900–2200 之间的年份。'); return }
    pickYear(next)
  }
  const navigateMonths = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12 }
    let next: number
    if (event.key === 'Home') next = year * 12
    else if (event.key === 'End') next = year * 12 + 11
    else if (event.key in offsets) next = year * 12 + index + offsets[event.key]
    else return
    event.preventDefault()
    next = Math.max(firstYear * 12, Math.min(lastYear * 12 + 11, next))
    if (next === year * 12 + index) return
    pendingFocus.current = 'month'; setYear(Math.floor(next / 12)); setFocusedMonth(next % 12)
  }
  const preset = (count: number) => {
    const next = timelineRange(start, count)
    setStart(next.startMonth); setEnd(lastTimelineMonth(next)); setError(''); setYearsOpen(false)
    const month = active === 'start' ? next.startMonth : lastTimelineMonth(next)
    setYear(Number(month.slice(0, 4))); setFocusedMonth(Number(month.slice(5)) - 1)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (months < 1) { setError('结束月份不能早于起始月份。'); return }
    if (months > MAX_TIMELINE_MONTHS) { setError('一次最多浏览 100 年，请缩短时间范围。'); return }
    apply(timelineRange(start, months))
  }
  return <form className="editor range-editor" onSubmit={submit} noValidate>
    <div className="month-range-fields" role="group" aria-label="起止月份">
      {(['start', 'end'] as const).map((field, index) => <div className="month-range-field" key={field}>
        {index === 1 && <Icon name="arrow" size={18} className="month-range-connector" />}
        <button type="button" className={`month-range-value ${active === field ? 'active' : ''}`} aria-pressed={active === field} aria-label={`选择${field === 'start' ? '起始' : '结束'}月份，${monthLabel(field === 'start' ? start : end)}`} onClick={() => activate(field)}>
          <span>{field === 'start' ? '起始月份' : '结束月份'}<Icon name="calendar" size={14} /></span>
          <strong>{(field === 'start' ? start : end).slice(0, 4)}<small>年</small>{(field === 'start' ? start : end).slice(5)}<small>月</small></strong>
        </button>
      </div>)}
    </div>
    <div className="month-picker" onKeyDown={event => { if (yearsOpen && event.key === 'Escape') { event.stopPropagation(); closeYears() } }}>
      <div className="month-picker-heading">
        <button type="button" className="icon-button" aria-label={yearsOpen ? '上一组年份' : '上一年'} disabled={yearsOpen ? yearPage === firstYear : year === firstYear} onClick={() => showYear(year - (yearsOpen ? 12 : 1))}><Icon name="chevron" className="reverse" size={17} /></button>
        <button ref={yearButton} type="button" className="month-picker-year" aria-label={yearsOpen ? '返回月份选择' : `选择年份，${year} 年`} aria-expanded={yearsOpen} onClick={() => { if (yearsOpen) closeYears(); else { setJumpYear(String(year)); setJumpError(''); setYearsOpen(true) } }}>
          {yearsOpen ? `${yearPage} — ${Math.min(lastYear, yearPage + 11)}` : <>{year}<small>年</small></>}<Icon name="chevron" size={12} className={yearsOpen ? 'reverse' : 'range-chevron'} />
        </button>
        <button type="button" className="icon-button" aria-label={yearsOpen ? '下一组年份' : '下一年'} disabled={yearsOpen ? yearPage + 12 > lastYear : year === lastYear} onClick={() => showYear(year + (yearsOpen ? 12 : 1))}><Icon name="chevron" size={17} /></button>
      </div>
      {yearsOpen ? <div className="month-picker-years">
        <div className="month-picker-grid" role="group" aria-label="选择年份">{Array.from({ length: 12 }, (_, index) => yearPage + index).map(value => <button type="button" key={value} disabled={value > lastYear} className={`month-picker-cell year-cell ${value === year ? 'selected' : ''}`} aria-pressed={value === year} onClick={() => pickYear(value)}>{value}</button>)}</div>
        <div className="month-picker-jump"><label>跳到年份<input type="number" min={firstYear} max={lastYear} step="1" inputMode="numeric" value={jumpYear} onChange={event => { setJumpYear(event.target.value); setJumpError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); jump() } }} /></label><button type="button" className="quiet-button" onClick={jump}>前往<Icon name="arrow" size={14} /></button></div>
        {jumpError && <p className="form-error" role="alert">{jumpError}</p>}
      </div> : <div className="month-picker-grid" role="group" aria-label={`${year} 年月份`}>
        {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`).map((month, index) => <button type="button" key={index} ref={element => { monthButtons.current[index] = element }} tabIndex={index === focusedMonth ? 0 : -1} onFocus={() => setFocusedMonth(index)} className={`month-picker-cell ${valid && month >= start && month <= end ? 'in-range' : ''} ${month === selected ? 'selected' : ''} ${month === today ? 'current' : ''}`} aria-label={monthLabel(month)} aria-pressed={month === selected} aria-current={month === today ? 'date' : undefined} onClick={() => choose(month)} onKeyDown={event => navigateMonths(event, index)}>
          {String(index + 1).padStart(2, '0')}<small>月</small>
        </button>)}
      </div>}
      <div className="month-picker-caption"><span>正在选择{active === 'start' ? '起始' : '结束'}月份</span><button type="button" className="text-button" onClick={() => { const month = timelineRange(today, 1).startMonth; choose(month); setYear(Number(month.slice(0, 4))); setFocusedMonth(Number(month.slice(5)) - 1); setYearsOpen(false) }}>选本月</button></div>
    </div>
    <div className="range-preset-group" aria-label="快捷时间跨度"><span>快速选择</span><div>{TIMELINE_PRESETS.map(count => <button type="button" key={count} className={`filter-chip ${months === count ? 'selected' : ''}`} aria-pressed={months === count} onClick={() => preset(count)}>{timelineSpanLabel(count)}</button>)}</div></div>
    <p className="month-range-summary" role="status">{valid ? <><Icon name="timeline" size={15} />这一段，共 <strong>{timelineSpanLabel(months)}</strong><span>包含起止月份</span></> : months < 1 ? '请将结束月份设在起始月份或之后。' : '一次最多浏览 100 年，请调整范围。'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-footer"><button type="button" className="quiet-button" onClick={close}>取消</button><button type="submit" className="primary-button">应用时间范围<Icon name="arrow" size={16} /></button></div>
  </form>
}
