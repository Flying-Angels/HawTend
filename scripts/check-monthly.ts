import assert from 'node:assert/strict'
import { emptyJournal, isUneditedSample, seedJournal } from '../src/model.ts'
import { isJournal } from '../src/cloud/journal-validation.ts'
import { isMonthlySummaries, monthlyReminderCalendar, previousMonth } from '../src/monthly.ts'

assert.equal(previousMonth('2027-01-01'), '2026-12')
assert.equal(previousMonth('2026-10-06'), '2026-09')
const entry = { month: '2026-09', incomeCents: 1800000, expenseCents: 650025, note: '独立测试数据' }
assert.equal(isJournal(emptyJournal()), true, '旧数据无需补字段即可读取')
assert.equal(isJournal({ ...emptyJournal(), monthlySummaries: [entry] }), true)
assert.equal(isUneditedSample({ ...seedJournal(), monthlySummaries: [entry] }), false, '含个人月结算的旧样例不可被清空')
assert.equal(isMonthlySummaries([entry, entry]), false, '同月只能有一份结算，防止重复累加')
for (const value of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(isMonthlySummaries([{ ...entry, expenseCents: value }]), false)
assert.equal(isMonthlySummaries([{ ...entry, month: '2026-13' }]), false)
const calendar = monthlyReminderCalendar('2026-12-31', new Date(2026, 11, 31, 12))
assert.ok(calendar.includes('DTSTART:20270101T100000'))
assert.ok(calendar.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=1'))
assert.ok(calendar.includes('BEGIN:VALARM\r\nTRIGGER:PT0M'))
assert.ok(!calendar.includes('TZID='), '按导入设备当地时间提醒')
assert.ok(!calendar.includes('\n') || calendar.split('\r\n').every(line => !line.includes('\n')))
assert.ok(calendar.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75), '中文折行不超过75字节')
assert.ok(calendar.replaceAll('\r\n ', '').includes('填写上个月收入和支出总额。'))
assert.ok(monthlyReminderCalendar('2026-10-01', new Date(2026, 9, 1, 9)).includes('DTSTART:20261001T100000'))
assert.ok(monthlyReminderCalendar('2026-10-01', new Date(2026, 9, 1, 10)).includes('DTSTART:20261101T100000'))
assert.ok(monthlyReminderCalendar('2026-10-06', new Date(2026, 9, 6, 9)).includes('DTSTART:20261101T100000'))
console.log('Monthly settlement, legacy data and calendar reminder checks passed')
