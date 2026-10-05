import branch from './assets/brand-proposals/a-branch.svg'
import journal from './assets/brand-proposals/b-journal.svg'
import seal from './assets/brand-proposals/c-seal.svg'
import monogram from './assets/brand-proposals/d-monogram.svg'
import refinedBranch from './assets/brand-proposals/a2-branch.svg'

export const brandProposals = {
  a: { name: '山楂枝叶', mark: branch, font: 'HawManrope' },
  b: { name: '生长手账', mark: journal, font: 'HawDMSans' },
  c: { name: '山楂印记', mark: seal, font: 'HawLora' },
  d: { name: 'HW 私人手账', mark: monogram, font: 'HawManrope' },
  ac: { name: '原 A 图标 + 已选字体', mark: branch, font: 'HawLora' },
  a2: { name: '山楂枝叶 · 第二版', mark: refinedBranch, font: 'HawLora' },
} as const

export type BrandProposal = keyof typeof brandProposals
// Review-only URL selection. No account data or saved preference is changed.
const requested = new URLSearchParams(window.location.search).get('brand')
export const brandPreview: BrandProposal | null = requested && Object.hasOwn(brandProposals, requested) ? requested as BrandProposal : null
