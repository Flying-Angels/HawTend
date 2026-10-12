import type { FinancialPlan, SalaryDeductions } from './model.ts'

// PRC resident salary, constant monthly salary over a full year. Verified 2026-10-12:
// https://www.chinatax.gov.cn/n810219/n810744/n3752930/n3752974/c3970366/content.html
// This is an annual-average estimate, not each month's cumulative withholding.
const bands = [
  { ceiling: 36000, rate: .03, quick: 0 },
  { ceiling: 144000, rate: .1, quick: 2520 },
  { ceiling: 300000, rate: .2, quick: 16920 },
  { ceiling: 420000, rate: .25, quick: 31920 },
  { ceiling: 660000, rate: .3, quick: 52920 },
  { ceiling: 960000, rate: .35, quick: 85920 },
  { ceiling: Infinity, rate: .45, quick: 181920 },
]
export const MAX_SALARY_CENTS = 10_000_000_000
export const salaryDeductions = (plan: FinancialPlan): SalaryDeductions => plan.salaryDeductions ?? { monthlyEmployeeCents: 0, monthlyAdditionalCents: 0 }
export function isSalaryDeductions(value: unknown): value is SalaryDeductions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as SalaryDeductions
  return [row.monthlyEmployeeCents, row.monthlyAdditionalCents].every(n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_SALARY_CENTS)
}
export function salaryFromGross(grossCents: number, deductions: SalaryDeductions) {
  const employeeCents = Math.min(grossCents, deductions.monthlyEmployeeCents)
  const taxable = Math.max(0, (grossCents - employeeCents - deductions.monthlyAdditionalCents) * 12 - 6_000_000)
  const band = bands.find(b => taxable <= b.ceiling * 100)!
  const annualTaxCents = Math.max(0, Math.round(taxable * band.rate - band.quick * 100))
  const monthlyTaxCents = Math.round(annualTaxCents / 12)
  return { grossCents, employeeCents, annualTaxCents, monthlyTaxCents, netCents: Math.max(0, grossCents - employeeCents - monthlyTaxCents) }
}
export function grossForNet(netCents: number, deductions: SalaryDeductions): number | null {
  if (netCents === 0) return 0
  if (salaryFromGross(MAX_SALARY_CENTS, deductions).netCents < netCents) return null
  let low = 0, high = MAX_SALARY_CENTS
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (salaryFromGross(middle, deductions).netCents >= netCents) high = middle
    else low = middle + 1
  }
  return low
}
export function incomeForDisplay(netCents: number, plan: FinancialPlan): number | null {
  if (plan.incomeBasis !== 'gross') return netCents
  if (plan.grossMonthlyIncomeCents !== undefined && plan.monthlyIncomeCents === netCents) return plan.grossMonthlyIncomeCents
  return grossForNet(netCents, salaryDeductions(plan))
}
export function withSalaryDeductions(plan: FinancialPlan, deductions: SalaryDeductions): FinancialPlan {
  return { ...plan, salaryDeductions: deductions, ...(plan.incomeBasis === 'gross' && plan.grossMonthlyIncomeCents !== undefined ? { monthlyIncomeCents: salaryFromGross(plan.grossMonthlyIncomeCents, deductions).netCents } : {}) }
}
export function withIncomeBasis(plan: FinancialPlan, basis: 'net' | 'gross'): FinancialPlan {
  if ((plan.incomeBasis ?? 'net') === basis) return plan
  return { ...plan, incomeBasis: basis, grossMonthlyIncomeCents: basis === 'gross' && plan.monthlyIncomeCents !== undefined ? grossForNet(plan.monthlyIncomeCents, salaryDeductions(plan)) ?? undefined : undefined }
}
