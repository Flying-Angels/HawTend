import { seedJournal } from './model'
import type { Journal } from './model'
import { previousMonth } from './monthly'

// Fictional account and valuation data, confined to the existing sample mode.
export function assetSample(today: string): Journal {
  const sample = seedJournal(), date = `${previousMonth(today)}-01`
  return { ...sample,
    accounts: [{ id: 'sample-pay', name: '支付宝', kind: 'payment' }, { id: 'sample-wechat', name: '微信', kind: 'payment' }, { id: 'sample-bank', name: '招商银行', kind: 'bank' }],
    funds: [...sample.funds.map(f => ({ ...f, assetType: 'deposit' as const, accountId: 'sample-bank' })),
      { id: 'sample-cash', name: '随手留下的余额', accountId: 'sample-pay', assetType: 'cash', returnMode: 'fixed', principalCents: 120000, startDate: date, rate: 0, liquid: true, maturityDate: '', mode: 'simple' },
      { id: 'sample-wechat-cash', name: '日常零钱', accountId: 'sample-wechat', assetType: 'cash', returnMode: 'fixed', principalCents: 32000, startDate: date, rate: 0, liquid: true, maturityDate: '', mode: 'simple' },
      { id: 'sample-market', name: '慢慢积攒的基金', accountId: 'sample-pay', assetType: 'fund', returnMode: 'manual', principalCents: 762345, startDate: date, rate: 0, liquid: true, maturityDate: '', mode: 'compound',
        valuationBase: { date: `${Number(date.slice(0, 4)) - 1}-12-31`, valueCents: 726345 }, valuations: [{ date, valueCents: 762345, netFlowCents: 0, cashIncomeCents: 0, note: '虚构示例：定期回看市值，不套用固定年化。' }] },
    ] }
}
