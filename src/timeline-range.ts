export interface TimelineRange { startMonth: string; months: number }

export const MIN_TIMELINE_MONTH = '1900-01'
export const MAX_TIMELINE_MONTH = '2200-12'
export const MAX_TIMELINE_MONTHS = 1200
export const TIMELINE_PRESETS = [1, 3, 6, 12, 36, 120, 1200]

export function monthIndex(month: string): number {
  const [year, number] = month.slice(0, 7).split('-').map(Number)
  return year * 12 + number - 1
}

export function monthAt(index: number): string {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

export function isTimelineMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= MIN_TIMELINE_MONTH && month <= MAX_TIMELINE_MONTH
}

const clampMonths = (months: number) => Math.max(1, Math.min(MAX_TIMELINE_MONTHS, Number.isFinite(months) ? Math.round(months) : 1))

export function timelineRange(startMonth: string, months: number): TimelineRange {
  const span = clampMonths(months)
  const first = isTimelineMonth(startMonth) ? monthIndex(startMonth) : monthIndex(MIN_TIMELINE_MONTH)
  return { startMonth: monthAt(Math.max(monthIndex(MIN_TIMELINE_MONTH), Math.min(monthIndex(MAX_TIMELINE_MONTH) - span + 1, first))), months: span }
}

export function centeredTimelineRange(day: string, months: number): TimelineRange {
  return timelineRange(monthAt(monthIndex(day) - Math.floor(clampMonths(months) / 2)), months)
}

export function lastTimelineMonth(range: TimelineRange): string {
  return monthAt(monthIndex(range.startMonth) + range.months - 1)
}

export function timelineBounds(range: TimelineRange) {
  const first = monthIndex(range.startMonth)
  // Calendar months, not an approximation in days: includes leap February.
  return { start: Date.UTC(Math.floor(first / 12), first % 12, 1), end: Date.UTC(Math.floor((first + range.months) / 12), (first + range.months) % 12, 1) }
}

export function timelineSpanLabel(months: number): string {
  const years = Math.floor(months / 12), rest = months % 12
  return years === 0 ? `${rest} 个月` : rest === 0 ? `${years} 年` : `${years} 年 ${rest} 个月`
}

export function timelinePeriodLabel(range: TimelineRange): string {
  const last = lastTimelineMonth(range), year = range.startMonth.slice(0, 4)
  const firstNumber = Number(range.startMonth.slice(5)), lastNumber = Number(last.slice(5))
  if (range.months === 1) return `${year} 年 ${firstNumber} 月`
  if (firstNumber === 1 && lastNumber === 12) return year === last.slice(0, 4) ? `${year} 年` : `${year} — ${last.slice(0, 4)}`
  return year === last.slice(0, 4) ? `${year} 年 ${firstNumber} — ${lastNumber} 月` : `${range.startMonth.replace('-', '.')} — ${last.replace('-', '.')}`
}

// Equal thumb movement changes the scale proportionally in each half.
// The middle is deliberately three years, not half of a century.
export function monthsForZoom(value: number): number {
  const position = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return clampMonths(position <= 50 ? 36 ** (position / 50) : 36 * (MAX_TIMELINE_MONTHS / 36) ** ((position - 50) / 50))
}

export function zoomForMonths(months: number): number {
  const span = clampMonths(months)
  return span <= 36 ? 50 * Math.log(span) / Math.log(36) : 50 + 50 * Math.log(span / 36) / Math.log(MAX_TIMELINE_MONTHS / 36)
}

export function timelineMarks(range: TimelineRange, axisWidth: number): { date: string; label: string }[] {
  const { start, end } = timelineBounds(range)
  const day = 86400000
  const isoDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10)
  const first = monthIndex(range.startMonth)
  if (range.months <= 2) {
    const count = (end - start) / day
    const step = [1, 2, 3, 5, 7, 10, 14].find(value => value >= count * 110 / Math.max(1, axisWidth)) ?? 14
    const dates = [start]
    for (let timestamp = start + step * day; timestamp < end - day; timestamp += step * day) dates.push(timestamp)
    if (dates.length > 1 && (end - day - dates[dates.length - 1]) / (end - start) * axisWidth < 90) dates.pop()
    dates.push(end - day)
    return dates.map((timestamp, index) => { const date = isoDay(timestamp); return { date, label: index === 0 ? `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日` : range.months === 1 ? `${Number(date.slice(8))}日` : date.slice(5).replace('-', '.') } })
  }
  if (range.months < 24) {
    const step = [1, 2, 3, 6, 12].find(value => value >= range.months * 120 / Math.max(1, axisWidth)) ?? 12
    const months = [first]
    for (let index = first + step; index < first + range.months; index += step) months.push(index)
    return months.map((index, i) => { const month = monthAt(index); return { date: `${month}-01`, label: i > 0 && index % 12 === 0 ? `${month.slice(0, 4)} · 1月` : `${index % 12 + 1}月` } })
  }
  const step = [1, 2, 5, 10, 20, 50, 100].find(value => value >= range.months / 12 * 120 / Math.max(1, axisWidth)) ?? 100
  const dates = [range.startMonth + '-01']
  const lastYear = Number(lastTimelineMonth(range).slice(0, 4))
  for (let year = Math.ceil((Math.floor(first / 12) + 1) / step) * step; year <= lastYear; year += step) dates.push(`${year}-01-01`)
  if (dates[dates.length - 1].slice(0, 4) !== String(lastYear)) {
    if (dates.length > 1 && (Date.UTC(lastYear, 0, 1) - Date.parse(dates[dates.length - 1])) / (end - start) * axisWidth < 90) dates.pop()
    dates.push(`${lastYear}-01-01`)
  }
  return dates.map(date => ({ date, label: date.slice(0, 4) }))
}
