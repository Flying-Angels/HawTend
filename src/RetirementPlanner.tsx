import { useEffect, useMemo, useRef, useState } from 'react'
import type { FinancialPlan, Journal } from './model'
import { planningHorizon, retirementScenarios } from './cashflow'
import { grossForNet, salaryDeductions } from './income-tax'
import { exactYuan } from './finance'
import './retirement.css'

const amount = (value: number | null) => value === null ? '暂无法估算' : `¥${exactYuan(value)}`
const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })

export function RetirementPlanner({ journal, plan, today, update }: {
  journal: Journal; plan: FinancialPlan; today: string; update: (plan: FinancialPlan) => void
}) {
  const earliestEnd = Number(planningHorizon(journal, today).slice(0, 4))
  const horizon = planningHorizon(journal, today, plan)
  const endYear = Number(horizon.slice(0, 4))
  const [previewYear, preview] = useState<number | null>(null)
  const [width, setWidth] = useState(700)
  const plot = useRef<HTMLDivElement>(null)
  const scenarios = useMemo(() => {
    const deductions = salaryDeductions(plan)
    return retirementScenarios(journal, plan, today).map(row => ({
      ...row,
      grossCents: row.incomeCents === null ? null : grossForNet(row.incomeCents, deductions),
    }))
  }, [journal, plan, today])
  const chosenYear = plan.retirementYear ?? endYear
  const current = scenarios.find(row => row.year === previewYear)
    ?? scenarios.find(row => row.year === chosenYear)
    ?? scenarios[0]
  const plotted = scenarios.filter(row => row.grossCents !== null)
  const max = Math.max(100, ...plotted.map(row => row.grossCents!)) * 1.08
  const positive = plotted.filter(row => row.grossCents! > 0)
  const logarithmic = positive.length > 1 && max / Math.min(...positive.map(row => row.grossCents!)) > 30
  const left = 55, right = width - 18, top = 20, bottom = 198
  const firstYear = Number(today.slice(0, 4))
  const x = (year: number) => endYear === firstYear ? (left + right) / 2 : left + (year - firstYear) / (endYear - firstYear) * (right - left)
  const height = (value: number) => logarithmic ? Math.log1p(value / 100) / Math.log1p(max / 100) : value / max
  const y = (value: number) => bottom - height(value) * (bottom - top)
  const tick = (fraction: number) => logarithmic ? Math.expm1(Math.log1p(max / 100) * fraction) * 100 : max * fraction
  const choose = (year: number) => {
    preview(null)
    update({ ...plan, retirementYear: year })
  }
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width)))
    if (plot.current) observer.observe(plot.current)
    return () => observer.disconnect()
  }, [])
  const inspect = (clientX: number) => {
    const bounds = plot.current!.getBoundingClientRect()
    const year = firstYear + Math.round((clientX - bounds.left - left) / (right - left) * (endYear - firstYear))
    return Math.max(firstYear, Math.min(endYear, year))
  }
  return <section className="retirement-planner" aria-label="退休年份与所需月薪">
    <div className="retirement-heading">
      <div><h3>想工作到哪一年？</h3><p>提前退休，需要在工作期间为后面的生活多留一些。</p></div>
      <div className="retirement-fields">
        <label>工资发到什么时候
          <select aria-label="工资截止年份" value={plan.retirementYear ?? 'horizon'} onChange={e => {
            preview(null)
            update({ ...plan, retirementYear: e.target.value === 'horizon' ? undefined : Number(e.target.value) })
          }}>
            <option value="horizon">工作到预算终点</option>
            {plan.retirementYear !== undefined && (plan.retirementYear < firstYear || plan.retirementYear > endYear) && <option value={plan.retirementYear}>{plan.retirementYear} 年底</option>}
            {scenarios.map(row => <option key={row.year} value={row.year}>{row.year} 年底退休</option>)}
          </select>
        </label>
        <label>日常开销算到哪年
          <select aria-label="日常开销规划终点" value={endYear} onChange={e => {
            const year = Number(e.target.value)
            preview(null)
            update({ ...plan, expenseThroughYear: year, retirementYear: plan.retirementYear === undefined ? undefined : Math.min(plan.retirementYear, year) })
          }}>
            {Array.from({ length: 2200 - earliestEnd + 1 }, (_, index) => earliestEnd + index).map(year => <option key={year} value={year}>{year} 年</option>)}
          </select>
        </label>
      </div>
    </div>
    <p className="retirement-assumptions">
      {plan.retirementYear === undefined ? `当前按工作到 ${horizon.replaceAll('-', '.')} 试算。` : `工资发到 ${plan.retirementYear} 年 12 月，从次年 1 月起按 0 计。`}
      日常开销持续至 {horizon.replaceAll('-', '.')}，心愿按各自日期支付。养老金与通胀暂按 0，退休后的结余继续按 {plan.annualRate.toFixed(2)}% 年化复利试算。
    </p>
    <div className="retirement-curve-heading"><h4>哪年退休，需要多少月薪</h4><span>税前固定月薪 / 元{logarithmic && ' · 对数刻度'}</span></div>
    <div className="retirement-plot" ref={plot} tabIndex={0} role="group" aria-label="退休年份曲线，左右键预览，回车应用年份"
      onPointerMove={e => { if (e.pointerType === 'mouse' && !e.buttons) preview(inspect(e.clientX)) }}
      onPointerLeave={() => preview(null)} onClick={e => choose(inspect(e.clientX))}
      onKeyDown={e => {
        if (e.key === 'Enter' && current) { e.preventDefault(); choose(current.year) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          preview(Math.max(firstYear, Math.min(endYear, (current?.year ?? chosenYear) + (e.key === 'ArrowLeft' ? -1 : 1))))
        }
      }}>
      {plotted.length > 0 ? <svg viewBox={`0 0 ${width} 240`} role="img" aria-label="各退休年份对应的最低税前月薪">
        {[0, .5, 1].map(fraction => <g key={fraction}>
          <line x1={left} x2={right} y1={y(tick(fraction))} y2={y(tick(fraction))} stroke="var(--line)" />
          <text x={left - 8} y={y(tick(fraction)) + 4} textAnchor="end">{compact.format(tick(fraction) / 100)}</text>
        </g>)}
        <polyline points={plotted.map(row => `${x(row.year)},${y(row.grossCents!)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {plotted.map(row => <circle key={row.year} cx={x(row.year)} cy={y(row.grossCents!)} r={row.year === chosenYear ? 5 : 2} fill="var(--accent)"><title>{row.year} 年底退休 · 税前 {amount(row.grossCents)} / 月</title></circle>)}
        {current?.grossCents !== null && current && <g>
          <line x1={x(current.year)} x2={x(current.year)} y1={top} y2={bottom} stroke="var(--muted)" opacity=".4" />
          <circle cx={x(current.year)} cy={y(current.grossCents)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </g>}
        {[...new Set([firstYear, ...(width > 500 ? [Math.round((firstYear + endYear) / 2)] : []), endYear])].map(year => <text key={year} x={x(year)} y={bottom + 27} textAnchor={firstYear === endYear ? 'middle' : year === firstYear ? 'start' : year === endYear ? 'end' : 'middle'}>{year} 年</text>)}
      </svg> : <p className="retirement-no-result">当前预算无法由未来工资覆盖，或税前金额超出换算范围。请核对付款日期与费用。</p>}
    </div>
    {current && <div className="retirement-preview" aria-live="polite">
      <div><span>{current.year} 年底退休 · {current.salaryMonths} 次未来工资</span><strong>{amount(current.grossCents)}<small> / 月 · 税前</small></strong></div>
      <p>对应税后 {amount(current.incomeCents)} / 月</p>
      {previewYear !== null && previewYear !== chosenYear && <button className="quiet-button" onClick={() => choose(current.year)}>用 {current.year} 年试算</button>}
    </div>}
    <p className="retirement-footnote">各年份覆盖同一份费用预算。悬停查看，点击曲线或选择年份应用；修改后点击「保存规划假设」。预算终点至少覆盖最后一个心愿日期。</p>
  </section>
}
