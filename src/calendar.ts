// Calendar days belong to the device's local timezone, not UTC.
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function nextMidnight(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
}

export function yearsAfter(day: string, years: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const last = new Date(year + years, month, 0).getDate()
  return localDay(new Date(year + years, month - 1, Math.min(date, last)))
}

export function welcomeDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' })
    .format(new Date(`${day}T12:00:00`)).toUpperCase()
}
