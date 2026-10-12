import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FinancialPlan, Journal } from './model'
import type { Projection } from './IncomePlanning'
import { moneyLabel } from './IncomePlanning'
import { exactYuan } from './finance'
import { incomeForDisplay } from './income-tax'
export type Hover = { month: string; x: number; y: number; opening: boolean; pinned?: boolean }
export function CashFlowTooltip({ hover, result, journal, plan, today, id }: { hover: Hover; result: Projection; journal: Journal; plan: FinancialPlan; today: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null), [offset, setOffset] = useState({ left: 12, top: 12 })
  const row = result.rows.find(r => r.month === hover.month), actual = journal.monthlySummaries?.find(r => r.month === hover.month)
  useLayoutEffect(() => {
    const rect = ref.current!.getBoundingClientRect()
    const left = Math.max(12, Math.min(innerWidth - rect.width - 12, hover.x + 16))
    const top = hover.y + rect.height + 16 < innerHeight ? hover.y + 16 : Math.max(12, hover.y - rect.height - 16)
    setOffset({ left, top })
  }, [hover.x, hover.y, hover.month, hover.opening])
  const displayed = row && !hover.opening ? row.month === today.slice(0, 7) ? 0 : incomeForDisplay(row.incomeCents, plan) : null
  return createPortal(<div ref={ref} id={id} className="cashflow-tooltip" role="tooltip" style={offset}><div className="tooltip-date"><strong>{hover.opening ? `${today.replaceAll('-', '.')} · 当前起点` : `${hover.month.replace('-', ' 年 ')} 月`}</strong><span>{hover.opening ? '记录余额' : row ? '预测 · 月度汇总' : actual ? '实际记录' : '未记录'}</span></div>{hover.opening ? <p>计入的可用资金 <strong>¥{exactYuan(result.required.openingCents)}</strong></p> : row ? <><dl><div><dt>{plan.incomeBasis === 'gross' ? '税前收入估算' : '税后到账收入'}</dt><dd>{moneyLabel(displayed)}</dd></div>{plan.incomeBasis === 'gross' && <div><dt>税后可用收入</dt><dd>¥{exactYuan(row.incomeCents)}</dd></div>}<div><dt>活期利息</dt><dd>¥{exactYuan(row.interestCents)}</dd></div><div><dt>日常开销</dt><dd>¥{exactYuan(row.dailyExpenseCents)}</dd></div><div><dt>心愿费用</dt><dd>¥{exactYuan(row.wishExpenseCents)}</dd></div><div className="tooltip-total"><dt>{row.date.replaceAll('-', '.')} 可用余额</dt><dd className={row.balanceCents < 0 ? 'negative' : ''}>¥{exactYuan(row.balanceCents)}</dd></div></dl>{row.maturityCents > 0 && <p>到期资金转入 ¥{exactYuan(row.maturityCents)}，不计作薪资。</p>}{row.wishes.length > 0 && <ul>{row.wishes.slice(0, 3).map((w, i) => <li key={`${w.id}-${i}`}><span>{w.date.slice(5).replace('-', '.')} · {w.title}</span><strong>¥{exactYuan(w.amountCents)}</strong></li>)}{row.wishes.length > 3 && <li>另有 {row.wishes.length - 3} 项，见月份明细。</li>}</ul>}</> : actual ? <dl><div><dt>已记录收入</dt><dd>¥{exactYuan(actual.incomeCents)}</dd></div><div><dt>已记录支出</dt><dd>¥{exactYuan(actual.expenseCents)}</dd></div></dl> : <p>这个月尚未记录实际收支，历史余额也未记录。</p>}</div>, document.body)
}
