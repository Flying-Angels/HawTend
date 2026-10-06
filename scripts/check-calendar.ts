import assert from 'node:assert/strict'
import { localDay, nextMidnight, welcomeDay, yearsAfter } from '../src/calendar.ts'

assert.equal(localDay(new Date(2026, 9, 6, 0, 1)), '2026-10-06')
assert.equal(localDay(new Date(2026, 9, 5, 23, 59)), '2026-10-05')
assert.equal(nextMidnight(new Date(2026, 9, 5, 23, 59, 59, 900)), 100)
assert.equal(nextMidnight(new Date(2026, 11, 31, 23, 59, 59)), 1000)
assert.equal(localDay(new Date(new Date(2026, 11, 31, 23, 59, 59).getTime() + 1000)), '2027-01-01')
assert.equal(yearsAfter('2024-02-29', 1), '2025-02-28', 'one-year forecasts must not overflow leap day')
assert.equal(yearsAfter('2024-02-29', 4), '2028-02-29')
assert.equal(welcomeDay('2026-10-06'), 'TUESDAY, OCTOBER 06, 2026')
console.log('Local calendar, midnight/year transitions and leap-day forecasts passed.')
