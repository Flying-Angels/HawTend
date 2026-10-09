const dayMs = 86400000
export function calendarTime(day: string): number { return Date.parse(`${day}T00:00:00Z`) }
export function isCalendarDay(day: string): boolean {
  const time = calendarTime(day)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day && day >= '0001-01-01'
}
export function calendarMonth(year: number, index: number): string { return `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}` }
export function monthLength(month: string): number {
  const date = new Date(calendarTime(`${month}-01`)); date.setUTCMonth(date.getUTCMonth() + 1, 0); return date.getUTCDate()
}
export function shiftCalendarMonth(day: string, offset: number): string {
  const date = new Date(calendarTime(day)), number = date.getUTCDate()
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset)
  if (date.getUTCFullYear() < 1) return '0001-01-01'
  if (date.getUTCFullYear() > 9999) return '9999-12-31'
  const month = calendarMonth(date.getUTCFullYear(), date.getUTCMonth())
  return `${month}-${String(Math.min(number, monthLength(month))).padStart(2, '0')}`
}
export function calendarCells(month: string) {
  const first = calendarTime(`${month}-01`), weekday = (new Date(first).getUTCDay() + 6) % 7
  const count = Math.ceil((weekday + monthLength(month)) / 7) * 7
  return Array.from({ length: count }, (_, index) => {
    const time = first + (index - weekday) * dayMs, date = new Date(time)
    return { time, date: date.toISOString().split('T')[0], number: date.getUTCDate(), month: calendarMonth(date.getUTCFullYear(), date.getUTCMonth()) }
  })
}
export function calendarLabel(value: string, monthly = false): string {
  if (!value) return monthly ? '选择月份' : '选择日期'
  return `${value.slice(0, 4)} 年 ${Number(value.slice(5, 7))} 月${monthly ? '' : ` ${Number(value.slice(8))} 日`}`
}
