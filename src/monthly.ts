import type { MonthlySummary } from './model'

export function previousMonth(day: string): string {
  const [year, month] = day.split('-').map(Number)
  return `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`
}

export function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(19|20|21|22)\d{2}-(0[1-9]|1[0-2])$/.test(value)
}

export function isMonthlySummaries(value: unknown): value is MonthlySummary[] {
  if (!Array.isArray(value) || value.length > 2000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!row || typeof row !== 'object' || !validMonth(row.month) || seen.has(row.month)
      || ![row.incomeCents, row.expenseCents].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
      || typeof row.note !== 'string') return false
    seen.add(row.month); return true
  })
}

// Local wall-clock time: the imported calendar owns reminders; HawTend needs no server.
export function monthlyReminderCalendar(today: string, now = new Date()): string {
  const [year, month] = today.split('-').map(Number)
  const upcoming = today.slice(8) === '01' && now.getHours() < 10 ? today : `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HawTend//Monthly Journal//ZH', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:monthly-summary@hawtend.local', `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${upcoming.replaceAll('-', '')}T100000`, 'DURATION:PT10M', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1',
    'SUMMARY:补记上个月的收入与支出', 'DESCRIPTION:打开 HawTend → 资金安排 → 每月收支，填写上个月收入和支出总额。',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:补记上个月的收入与支出',
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].map(line => {
      // RFC 5545: fold by UTF-8 octets without splitting Chinese characters.
      let result = '', length = 0
      for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (length + bytes > 74) { result += '\r\n '; length = 1 }; result += char; length += bytes }
      return result
    }).join('\r\n')
}
