import { cents } from './finance.ts'

export function readMoney(value: string, signed = false) {
  const text = value.trim()
  return (signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(text) && Math.abs(Number(text)) <= 1_000_000_000 ? cents(text) : null
}
