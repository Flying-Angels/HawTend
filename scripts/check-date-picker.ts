import assert from 'node:assert/strict'
import { calendarCells, calendarMonth, calendarTime, isCalendarDay, monthLength, shiftCalendarMonth } from '../src/calendar-picker.ts'

assert.equal(isCalendarDay('2024-02-29'), true)
assert.equal(isCalendarDay('2026-02-29'), false)
assert.equal(isCalendarDay('2026-04-31'), false)
assert.equal(isCalendarDay(''), false)
assert.equal(isCalendarDay('0000-01-01'), false)
assert.equal(isCalendarDay('0001-01-01'), true)
assert.equal(isCalendarDay('9999-12-31'), true)
assert.equal(monthLength('2024-02'), 29)
assert.equal(monthLength('2026-02'), 28)
assert.equal(shiftCalendarMonth('2024-01-31', 1), '2024-02-29')
assert.equal(shiftCalendarMonth('2026-01-31', 1), '2026-02-28')
assert.equal(shiftCalendarMonth('2026-12-31', 1), '2027-01-31')
assert.equal(shiftCalendarMonth('2024-02-29', 12), '2025-02-28')
assert.equal(shiftCalendarMonth('0001-01-01', -1), '0001-01-01')
assert.equal(shiftCalendarMonth('9999-12-31', 1), '9999-12-31')
for (const year of [1, 99, 1900, 2000, 2024, 2026, 2100, 9999]) {
  for (let month = 0; month < 12; month++) {
    const period = calendarMonth(year, month), cells = calendarCells(period)
    assert.ok(cells.length >= 28 && cells.length <= 42 && cells.length % 7 === 0)
    assert.equal(new Date(cells[0].time).getUTCDay(), 1, 'weeks start on Monday')
    assert.equal(new Set(cells.map(c => c.date)).size, cells.length)
    assert.equal(cells.filter(c => c.month === period).length, monthLength(period))
    assert.ok(cells.every((c, i) => i === 0 || c.time - cells[i - 1].time === 86400000))
  }
}
assert.equal(calendarTime('2026-10-09') - calendarTime('2026-10-08'), 86400000)
console.log('Calendar grid, leap dates, month/year navigation and supported date boundaries passed.')
