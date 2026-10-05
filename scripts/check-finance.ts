import assert from 'node:assert/strict'
import { futureValue, monthlySaving, monthsUntil } from '../src/finance.ts'
import type { Fund } from '../src/model.ts'
const fund: Fund = { id: 'test', name: 'test', principalCents: 5000000, rate: 5, startDate: '2026-10-05', maturityDate: '2036-10-05', mode: 'compound', liquid: false }
assert.equal(futureValue(fund, '2036-10-05'), 8144473, '完整十年复利，包括闰年')
assert.equal(futureValue({ ...fund, mode: 'simple' }, '2036-10-05'), 7500000, '十年单利')
assert.equal(futureValue(fund, '2040-10-05'), 8144473, '到期后默认不继续计息')
assert.equal(futureValue(fund, '2020-10-05'), 5000000, '参考日前不反向计算余额')
assert.equal(monthlySaving(10000000, 3000000, 0, 27).monthly, 259260, '零收益月末储蓄向上取整到分')
// 由 Python Decimal 40 位精度独立推导：2539.8561289264975 元/月。
assert.equal(monthlySaving(10000000, 3000000, 1, 27).monthly, 253986, '年化转换为月末复利系数')
assert.equal(monthlySaving(10000, 30000, 1, 27).monthly, 0, '已足额时没有负储蓄')
assert.equal(monthlySaving(10000000, 0, 1, 0).monthly, null, '已到期且有缺口须明确提示')
assert.equal(monthsUntil('2026-10-05', '2028-12-31'), 27, '包含本月月底和目标月底的投入')
assert.equal(monthsUntil('2026-10-05', '2028-12-15'), 26, '目标月未到月底不计入该月投入')
assert.equal(monthsUntil('2026-10-05', ''), 0, '编辑时清空日期不会进入无限循环')
assert.equal(monthsUntil('2026-10-05', '2026-10-15'), 0, '月末以前的目标没有本月月末投入')
console.log('Finance checks passed')
