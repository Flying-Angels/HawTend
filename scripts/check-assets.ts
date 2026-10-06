import assert from 'node:assert/strict'
import { accountBalance, availableForPlanning, isAssetAccounts, periodGain, planningRate, recordValuation } from '../src/assets.ts'
import { futureValue } from '../src/finance.ts'
import { emptyJournal, isUneditedSample, seedJournal } from '../src/model.ts'
import type { Fund } from '../src/model.ts'
import { isJournal } from '../src/cloud/journal-validation.ts'

const accounts = [{ id: 'a', name: '测试平台', kind: 'payment' as const }, { id: 'b', name: '测试银行', kind: 'bank' as const }]
const fund: Fund = { id: 'asset', name: '虚构基金', principalCents: 800000, startDate: '2026-08-31', rate: 5, maturityDate: '', mode: 'compound', liquid: true, assetType: 'fund', returnMode: 'manual', accountId: 'a', valuationBase: { date: '2026-08-31', valueCents: 800000 }, valuations: [] }
const sep = { date: '2026-09-30', valueCents: 900000, netFlowCents: 150000, cashIncomeCents: 10000, note: '测试用' }
const first = recordValuation(fund, sep)
assert.equal(periodGain(first, sep), -40000, '追加本金与分红要分开；净市值变化不能当作收益')
assert.equal(first.principalCents, 900000)
assert.equal(first.startDate, '2026-09-30', '参考日移到最新市值日期')
assert.deepEqual(fund.valuations, [], '录入不得改写传入记录')
assert.equal(planningRate(first), 0, '手动市值忽略旧年化，不能继续复利')
assert.equal(futureValue(first, '2036-09-30'), 900000, '手动市值不得套用年化预测')
assert.equal(futureValue(first, '2026-09-01'), 800000, '历史日期不可使用后来才记录的市值')
const oct = { date: '2026-10-06', valueCents: 610000, netFlowCents: -300000, cashIncomeCents: 0, note: '' }
const second = recordValuation(first, oct)
assert.equal(periodGain(second, oct), 10000, '赎回款不是亏损')
const correction = { ...oct, valueCents: 605000 }
const corrected = recordValuation(second, correction)
assert.equal(corrected.valuations!.length, 2, '同日更正替换，不累计市值')
assert.equal(periodGain(corrected, correction), 5000, '更正沿用期间起点而非旧的同日市值')
assert.throws(() => recordValuation(corrected, { ...oct, date: '2026-09-01' }), /最近一次/)
assert.throws(() => recordValuation(corrected, { ...oct, valueCents: -1 }), /有效金额/)
assert.equal(accountBalance([corrected, { ...seedJournal().funds[0], accountId: 'b' }], 'a'), 605000)
assert.equal(accountBalance([{ ...fund, accountId: undefined }]), 800000, '旧资产未归类仍保留')
assert.equal(isAssetAccounts(accounts), true)
assert.equal(isAssetAccounts([...accounts, { ...accounts[0], id: 'c', name: '测试平台' }]), false)
assert.equal(isAssetAccounts([...accounts, { ...accounts[0], name: '新名称' }]), false)
const journal = { ...emptyJournal(), accounts, funds: [corrected] }
assert.equal(isJournal(journal), true)
assert.equal(isJournal({ ...journal, accounts: accounts.slice(1) }), false, '引用中的账户不能删除')
assert.equal(isJournal({ ...journal, funds: [{ ...corrected, principalCents: 800000 }] }), false, '市值与最新快照必须一致')
assert.equal(isJournal({ ...journal, funds: [{ ...corrected, valuations: [oct, sep] }] }), false)
assert.equal(isJournal(seedJournal()), true, '旧资产无需迁移即可读取')
assert.equal(isUneditedSample({ ...seedJournal(), accounts }), false, '仅添加过账户的旧样例也是个人数据')
const locked = { ...corrected, liquid: false, maturityDate: '2026-09-15' }
assert.equal(isJournal({ ...journal, funds: [locked] }), true, '可保存到期之后的真实市值记录')
assert.equal(availableForPlanning(locked, '2026-09-14'), false)
assert.equal(availableForPlanning(locked, '2026-10-06'), true)
console.log('Asset accounts, valuation cash flows, corrections, forecasts and legacy integrity checks passed')
