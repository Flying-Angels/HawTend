import assert from 'node:assert/strict'
import { centeredTimelineRange, isTimelineMonth, lastTimelineMonth, monthAt, monthIndex, monthsForZoom, timelineBounds, timelineMarks, timelinePeriodLabel, timelineRange, timelineSpanLabel, zoomForMonths } from '../src/timeline-range.ts'

assert.equal(monthsForZoom(0), 1)
assert.equal(monthsForZoom(50), 36)
assert.equal(monthsForZoom(100), 1200)
assert.equal(monthsForZoom(25), 6)
assert.equal(monthsForZoom(75), 208)
let previous = 0
for (let position = 0; position <= 1000; position++) {
  const months = monthsForZoom(position / 10)
  assert.ok(months >= previous, 'zoom must never decrease when the slider moves right')
  previous = months
}
for (let months = 1; months <= 1200; months++) {
  assert.equal(monthsForZoom(zoomForMonths(months)), months, 'manual spans and the thumb must round-trip')
  const range = centeredTimelineRange('2026-10-08', months)
  const { start, end } = timelineBounds(range)
  assert.ok(start <= Date.parse('2026-10-08') && end > Date.parse('2026-10-08'), 'zoom must retain its focus month')
  const marks = timelineMarks(range, 1648)
  assert.ok(marks.length >= 2)
  assert.equal(new Set(marks.map(m => m.date)).size, marks.length)
  assert.ok(marks.every((m, i) => Date.parse(m.date) >= start && Date.parse(m.date) < end && (i === 0 || m.date > marks[i - 1].date)))
}
assert.equal(timelineBounds(timelineRange('2024-02', 1)).end - timelineBounds(timelineRange('2024-02', 1)).start, 29 * 86400000)
assert.equal(timelineBounds(timelineRange('2026-02', 1)).end - timelineBounds(timelineRange('2026-02', 1)).start, 28 * 86400000)
assert.equal(lastTimelineMonth(timelineRange('2026-12', 3)), '2027-02')
assert.equal(timelinePeriodLabel(timelineRange('2026-10', 1)), '2026 年 10 月')
assert.equal(timelinePeriodLabel(timelineRange('2026-01', 36)), '2026 — 2028')
assert.equal(timelineSpanLabel(14), '1 年 2 个月')
assert.equal(isTimelineMonth('2026-13'), false)
assert.equal(isTimelineMonth('1899-12'), false)
assert.equal(isTimelineMonth(''), false)
assert.deepEqual(timelineRange('2200-12', 1200), { startMonth: '2101-01', months: 1200 })
assert.deepEqual(centeredTimelineRange('1900-01-01', 1), { startMonth: '1900-01', months: 1 })
assert.equal(monthAt(monthIndex('2026-12') + 1), '2027-01')
console.log('Nonlinear month-to-century scale, exact calendar bounds, focus, ticks and navigation passed.')
