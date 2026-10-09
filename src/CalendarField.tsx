import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icons'
import { useToday } from './useToday'
import { calendarCells, calendarLabel, calendarMonth, calendarTime, isCalendarDay, monthLength, shiftCalendarMonth } from './calendar-picker'

type View = 'days' | 'months' | 'years'
export function CalendarField({ label, value, change, min, max, monthly = false }: { label: string; value: string; change: (value: string) => void; min?: string; max?: string; monthly?: boolean }) {
  const id = useId(), today = useToday()
  const lower = min ? monthly ? `${min}-01` : min : '0001-01-01'
  const upper = max ? monthly ? `${max}-${String(monthLength(max)).padStart(2, '0')}` : max : '9999-12-31'
  const firstYear = Number(lower.slice(0, 4)), lastYear = Number(upper.slice(0, 4))
  const clampDay = (day: string) => day < lower ? lower : day > upper ? upper : day
  const initial = clampDay(value && isCalendarDay(monthly ? `${value}-01` : value) ? monthly ? `${value}-01` : value : today)
  const [open, setOpen] = useState(false), [view, setView] = useState<View>(monthly ? 'months' : 'days')
  const [month, setMonth] = useState(initial.slice(0, 7)), [focused, setFocused] = useState(initial)
  const [jumpYear, setJumpYear] = useState(''), [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null)
  const pendingFocus = useRef(false)
  const year = Number(month.slice(0, 4)), monthNumber = Number(month.slice(5)) - 1
  const yearPage = Math.floor(year / 12) * 12
  const enabledMonth = (candidate: string) => candidate >= lower.slice(0, 7) && candidate <= upper.slice(0, 7)
  const position = useCallback(() => {
    if (!dialog.current?.open || !trigger.current || matchMedia('(max-width: 760px)').matches) return
    const box = trigger.current.getBoundingClientRect(), popup = dialog.current.getBoundingClientRect()
    dialog.current.style.left = `${Math.max(8, Math.min(box.left, innerWidth - popup.width - 8))}px`
    const below = innerHeight - box.bottom - 8, above = box.top - 8
    const top = below >= popup.height || below >= above ? box.bottom + 8 : box.top - popup.height - 8
    dialog.current.style.top = `${Math.max(8, Math.min(top, innerHeight - popup.height - 8))}px`
  }, [])
  useLayoutEffect(() => {
    if (!open || !dialog.current) return
    const panel = dialog.current
    panel.showModal(); position()
    panel.querySelector<HTMLElement>('.calendar-grid [tabindex="0"], .month-picker-grid [tabindex="0"]')?.focus()
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); if (panel.open) panel.close() }
  }, [open, position])
  useLayoutEffect(() => {
    position()
    if (pendingFocus.current) {
      const panel = dialog.current
      const target = panel?.querySelector<HTMLElement>('.calendar-grid [tabindex="0"], .month-picker-grid [tabindex="0"]') ?? panel?.querySelector<HTMLElement>('.calendar-period')
      target?.focus()
      pendingFocus.current = false
    }
  }, [view, month, focused, position])
  const show = () => { setFocused(initial); setMonth(initial.slice(0, 7)); setView(monthly ? 'months' : 'days'); setError(''); setOpen(true) }
  const choose = (day: string) => { if (day >= lower && day <= upper) { change(monthly ? day.slice(0, 7) : day); setOpen(false) } }
  const visitMonth = (candidate: string) => {
    const next = candidate < lower.slice(0, 7) ? lower.slice(0, 7) : candidate > upper.slice(0, 7) ? upper.slice(0, 7) : candidate
    setMonth(next); setFocused(clampDay(`${next}-${String(Math.min(Number(focused.slice(8)), monthLength(next))).padStart(2, '0')}`)); setError('')
  }
  const chooseMonth = (candidate: string) => {
    if (!enabledMonth(candidate)) return
    if (monthly) choose(`${candidate}-01`)
    else { pendingFocus.current = true; visitMonth(candidate); setView('days') }
  }
  const pickYear = (next: number) => { pendingFocus.current = true; visitMonth(calendarMonth(next, monthNumber)); setView('months') }
  const jump = () => {
    const next = Number(jumpYear)
    if (!jumpYear.trim() || !Number.isInteger(next) || next < firstYear || next > lastYear) { setError(`请选择 ${firstYear}–${lastYear} 之间的年份。`); return }
    pickYear(next)
  }
  const changeView = () => {
    pendingFocus.current = true; setError('')
    if (view === 'days') setView('months')
    else if (view === 'months') { setJumpYear(String(year)); setView('years') }
    else setView('months')
  }
  const shift = (direction: number) => {
    const delta = view === 'days' ? 1 : view === 'months' ? 12 : 144
    const date = new Date(calendarTime(`${month}-01`)); date.setUTCMonth(date.getUTCMonth() + direction * delta)
    const nextYear = Math.max(firstYear, Math.min(lastYear, date.getUTCFullYear()))
    visitMonth(calendarMonth(nextYear, date.getUTCMonth()))
  }
  const dayKey = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let time = calendarTime(day)
    if (event.key in steps) time += steps[event.key] * 86400000
    else if (event.key === 'Home') time -= (new Date(time).getUTCDay() + 6) % 7 * 86400000
    else if (event.key === 'End') time += (6 - (new Date(time).getUTCDay() + 6) % 7) * 86400000
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const delta = (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)
      time = calendarTime(shiftCalendarMonth(day, delta))
    } else return
    event.preventDefault()
    const next = new Date(Math.max(calendarTime(lower), Math.min(calendarTime(upper), time))).toISOString().slice(0, 10)
    if (next === focused) return
    pendingFocus.current = true; setFocused(next); setMonth(next.slice(0, 7))
  }
  const monthKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12 }
    let next = year * 12 + index
    if (event.key in steps) next += steps[event.key]
    else if (event.key === 'Home') next = year * 12
    else if (event.key === 'End') next = year * 12 + 11
    else return
    event.preventDefault()
    const start = firstYear * 12 + Number(lower.slice(5, 7)) - 1, end = lastYear * 12 + Number(upper.slice(5, 7)) - 1
    next = Math.max(start, Math.min(end, next))
    if (calendarMonth(Math.floor(next / 12), next % 12) === month) return
    pendingFocus.current = true; visitMonth(calendarMonth(Math.floor(next / 12), next % 12))
  }
  const popupKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation()
      if (view === 'years') { pendingFocus.current = true; setView('months'); setError('') }
      else if (view === 'months' && !monthly) { pendingFocus.current = true; setView('days') }
      else setOpen(false)
    }
    if (event.key === 'Tab') {
      event.stopPropagation()
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0)
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() }
    }
  }
  return <div className="date-field">
    <label htmlFor={id}>{label}</label>
    <button id={id} ref={trigger} type="button" className="date-field-value" aria-label={`选择${label}，${calendarLabel(value, monthly)}`} aria-haspopup="dialog" aria-expanded={open} onClick={show}><span>{calendarLabel(value, monthly)}</span><Icon name="calendar" size={16} /></button>
    <dialog ref={dialog} className="calendar-popup" aria-label={`${label}选择`} onClose={() => setOpen(false)} onCancel={event => { event.preventDefault(); setOpen(false) }} onKeyDown={popupKey} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      {open && <div className="calendar-surface">
        <div className="calendar-titlebar"><span>{label}</span><button type="button" className="icon-button" aria-label="关闭日期选择" onClick={() => setOpen(false)}><Icon name="close" size={16} /></button></div>
        <div className="month-picker-heading">
          <button type="button" className="icon-button" aria-label={view === 'days' ? '上个月' : view === 'months' ? '上一年' : '上一组年份'} disabled={view === 'days' ? month <= lower.slice(0, 7) : view === 'months' ? year <= firstYear : yearPage <= firstYear} onClick={() => shift(-1)}><Icon name="chevron" className="reverse" size={17} /></button>
          <button type="button" className="calendar-period" aria-label={view === 'days' ? `选择月份，${calendarLabel(month, true)}` : view === 'months' ? `选择年份，${year} 年` : '返回月份选择'} onClick={changeView}>{view === 'years' ? `${Math.max(firstYear, yearPage)} — ${Math.min(lastYear, yearPage + 11)}` : <>{year}<small>年</small>{view === 'days' && <>{Number(month.slice(5))}<small>月</small></>}</>}<Icon name="chevron" size={12} className="range-chevron" /></button>
          <button type="button" className="icon-button" aria-label={view === 'days' ? '下个月' : view === 'months' ? '下一年' : '下一组年份'} disabled={view === 'days' ? month >= upper.slice(0, 7) : view === 'months' ? year >= lastYear : yearPage + 12 > lastYear} onClick={() => shift(1)}><Icon name="chevron" size={17} /></button>
        </div>
        {view === 'days' ? <>
          <div className="calendar-weekdays" aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" role="group" aria-label={`${calendarLabel(month, true)}日期`}>{calendarCells(month).map(cell => <button type="button" key={cell.date} className={`calendar-day ${cell.month !== month ? 'adjacent' : ''} ${cell.date === value ? 'selected' : ''} ${cell.date === today ? 'current' : ''}`} tabIndex={cell.date === focused ? 0 : -1} disabled={cell.time < calendarTime(lower) || cell.time > calendarTime(upper)} aria-label={calendarLabel(cell.date)} aria-pressed={cell.date === value} aria-current={cell.date === today ? 'date' : undefined} onFocus={() => setFocused(cell.date)} onKeyDown={event => dayKey(event, cell.date)} onClick={() => choose(cell.date)}>{cell.number}</button>)}</div>
        </> : view === 'months' ? <div className="month-picker-grid" role="group" aria-label={`${year} 年月份`}>{Array.from({ length: 12 }, (_, index) => calendarMonth(year, index)).map((candidate, index) => <button type="button" key={candidate} className={`month-picker-cell ${candidate === value.slice(0, 7) ? 'selected' : ''} ${candidate === today.slice(0, 7) ? 'current' : ''}`} tabIndex={candidate === month ? 0 : -1} disabled={!enabledMonth(candidate)} aria-label={calendarLabel(candidate, true)} aria-pressed={candidate === value.slice(0, 7)} onFocus={() => { if (candidate !== month) setMonth(candidate) }} onKeyDown={event => monthKey(event, index)} onClick={() => chooseMonth(candidate)}>{String(index + 1).padStart(2, '0')}<small>月</small></button>)}</div> : <>
          <div className="month-picker-grid" role="group" aria-label="选择年份">{Array.from({ length: 12 }, (_, index) => yearPage + index).map(candidate => <button type="button" key={candidate} className={`month-picker-cell year-cell ${candidate === year ? 'selected' : ''}`} disabled={candidate < firstYear || candidate > lastYear} aria-pressed={candidate === year} onClick={() => pickYear(candidate)}>{candidate}</button>)}</div>
          <div className="month-picker-jump"><label>跳到年份<input type="number" min={firstYear} max={lastYear} inputMode="numeric" value={jumpYear} onChange={event => { setJumpYear(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); jump() } }} /></label><button type="button" className="quiet-button" onClick={jump}>前往<Icon name="arrow" size={14} /></button></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
        <div className="calendar-footer"><span>{value ? calendarLabel(value, monthly) : '还未选择'}</span><button type="button" className="text-button" disabled={today < lower || (monthly ? today.slice(0, 7) > upper.slice(0, 7) : today > upper)} onClick={() => choose(monthly ? `${today.slice(0, 7)}-01` : today)}>{monthly ? '选本月' : '选今天'}</button></div>
      </div>}
    </dialog>
  </div>
}
