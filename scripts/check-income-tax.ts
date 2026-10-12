import assert from 'node:assert/strict'
import { grossForNet, salaryFromGross, withIncomeBasis, withSalaryDeductions, isSalaryDeductions, MAX_SALARY_CENTS } from '../src/income-tax.ts'
import { isFinancialPlan } from '../src/cashflow.ts'
const zero = { monthlyEmployeeCents: 0, monthlyAdditionalCents: 0 }
assert.equal(salaryFromGross(500000, zero).netCents, 500000)
assert.equal(salaryFromGross(1000000, zero).monthlyTaxCents, 29000)
assert.equal(salaryFromGross(2000000, { monthlyEmployeeCents: 200000, monthlyAdditionalCents: 150000 }).netCents, 1706000)
for (const [taxable, tax] of [[36000, 1080], [144000, 11880], [300000, 43080], [420000, 73080], [660000, 145080], [960000, 250080]]) {
  const gross = Math.round((taxable + 60000) / 12 * 100)
  assert.ok(Math.abs(salaryFromGross(gross, zero).annualTaxCents - tax * 100) <= 3)
}
for (const net of [0, 1, 500000, 971000, 1800000, 9000000]) {
  for (const deductions of [zero, { monthlyEmployeeCents: 200000, monthlyAdditionalCents: 150000 }]) {
    const gross = grossForNet(net, deductions)!
    assert.ok(salaryFromGross(gross, deductions).netCents >= net)
    if (gross > 0) assert.ok(salaryFromGross(gross - 1, deductions).netCents < net, 'inverse is the lowest salary to the cent')
  }
}
assert.equal(grossForNet(MAX_SALARY_CENTS, zero), null)
let plan = withIncomeBasis({ monthlyExpenseCents: 650000, annualRate: .8, monthlyIncomeCents: 971000 }, 'gross')
assert.ok(isFinancialPlan(plan))
assert.equal(plan.grossMonthlyIncomeCents, 1000000)
plan = withSalaryDeductions(plan, { monthlyEmployeeCents: 100000, monthlyAdditionalCents: 0 })
assert.equal(plan.monthlyIncomeCents, 881000)
assert.ok(isFinancialPlan(plan))
assert.equal(isFinancialPlan({ ...plan, monthlyIncomeCents: 123 }), false, 'inconsistent gross and net cannot be imported')
assert.ok(isFinancialPlan(withIncomeBasis(plan, 'net')))
assert.equal(isSalaryDeductions({ ...zero, monthlyAdditionalCents: -1 }), false)
console.log('Salary bands, actual deductions, rounded reverse calculation and legacy plan compatibility passed')
