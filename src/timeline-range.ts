export interface TimelineRange { startYear: number; years: number }

export const MIN_TIMELINE_YEAR = 1900
export const MAX_TIMELINE_YEAR = 2200
export const MAX_TIMELINE_YEARS = 100

export function timelineRange(startYear: number, years: number): TimelineRange {
  const span = Math.max(1, Math.min(MAX_TIMELINE_YEARS, Math.round(years)))
  return { startYear: Math.max(MIN_TIMELINE_YEAR, Math.min(MAX_TIMELINE_YEAR - span + 1, Math.round(startYear))), years: span }
}

export function timelineBounds(range: TimelineRange) {
  return { start: Date.UTC(range.startYear, 0, 1), end: Date.UTC(range.startYear + range.years, 0, 1) }
}

export function timelineMarks(range: TimelineRange, axisWidth: number): { date: string; label: string }[] {
  if (range.years === 1) return [1, 4, 7, 10].map(month => ({ date: `${range.startYear}-${String(month).padStart(2, '0')}-01`, label: month === 1 ? `${range.startYear} · 1月` : `${month}月` }))
  const step = [1, 2, 5, 10, 20, 50].find(value => value >= range.years * 120 / axisWidth) ?? 100
  const lastYear = range.startYear + range.years - 1
  const years = [range.startYear]
  for (let year = Math.ceil((range.startYear + 1) / step) * step; year < lastYear; year += step) years.push(year)
  if (years.length > 1 && (lastYear - years[years.length - 1]) / range.years * axisWidth < 90) years.pop()
  years.push(lastYear)
  return years.map(year => ({ date: `${year}-01-01`, label: String(year) }))
}
