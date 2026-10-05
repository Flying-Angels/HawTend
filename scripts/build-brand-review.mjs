import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Build a standalone review sheet from screenshots of the running app.
// Fonts and screenshots are embedded, so the HTML can be opened directly.
const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root))
const embedded = async (path, type) => `data:${type};base64,${(await read(path)).toString('base64')}`
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const refinement = process.argv.includes('--refine')
const variants = refinement ? [
  { key: 'ac', label: 'A', name: '原 A 图标 · 已选字体', asset: 'a-branch.svg', font: 'Lora', weight: 450, tracking: '-1px', note: '原图标配上你选定的字体，用来对照图形变化。' },
  { key: 'a2', label: 'A2', name: '优化版 · 已选字体', asset: 'a2-branch.svg', font: 'Lora', weight: 450, tracking: '-1px', note: '枝条收束、双果错落，保留叶片与山楂花萼。' },
] : [
  { key: 'a', name: '山楂枝叶', asset: 'a-branch.svg', font: 'Manrope', weight: 500, tracking: '-1.1px', note: '两颗山楂与枝叶，平面色块；自然、轻盈。' },
  { key: 'b', name: '生长手账', asset: 'b-journal.svg', font: 'DM Sans', weight: 500, tracking: '-.7px', note: '打开的手账与一颗山楂，和页面线条图标呼应。' },
  { key: 'c', name: '山楂印记', asset: 'c-seal.svg', font: 'Lora', weight: 450, tracking: '-1px', note: '果实里留出 H，搭配轻衬线字；安静、有书卷感。' },
  { key: 'd', name: 'HW 私人手账', asset: 'd-monogram.svg', font: 'Manrope', weight: 600, tracking: '-1.2px', note: '把 Hao / Wen 的 HW 写进封面，保留暖红色书签。' },
]
let fontCSS = ''
for (const [font, file] of [['Manrope', 'manrope'], ['DM Sans', 'dm-sans'], ['Lora', 'lora']]) {
  fontCSS += `@font-face{font-family:'${font}';src:url('${await embedded(`src/assets/fonts/${file}-latin.woff2`, 'font/woff2')}') format('woff2');font-weight:400 600;font-style:normal;font-display:block;}\n`
}
let licenses = ''
for (const file of ['Manrope-OFL.txt', 'DM-Sans-OFL.txt', 'Lora-OFL.txt']) {
  licenses += `<details><summary>${file}</summary><pre>${escape((await read(`public/brand/font-licenses/${file}`)).toString('utf8'))}</pre></details>`
}
const items = []
for (const item of variants) {
  items.push({
    ...item,
    svg: (await read(`src/assets/brand-proposals/${item.asset}`)).toString('utf8'),
    desktop: await embedded(`output/playwright/hawtend-brand-${item.key}-desktop-frame.png`, 'image/png'),
    mobile: await embedded(`output/playwright/hawtend-brand-${item.key}-mobile.png`, 'image/png'),
  })
}
const style = `${fontCSS}
*{box-sizing:border-box}body{margin:0;background:#f0ede5;color:#445749;font-family:'Microsoft YaHei','PingFang SC',sans-serif;-webkit-font-smoothing:antialiased}
#comparison{width:1560px;padding:46px 48px 38px;margin:0 auto}.eyebrow{margin:0 0 15px;font-size:12px;letter-spacing:3px;color:#7d8d77}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}h1{margin:0;font-size:30px;font-weight:500;letter-spacing:1px}header p{margin:0;font-size:13px;line-height:1.9;color:#7c8376;text-align:right}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}.card{padding:23px;background:#faf8f2;border:1px solid #dcded1;border-radius:16px}.label{display:flex;align-items:center;gap:12px;font-size:18px;font-weight:500}.letter{font:500 15px Manrope,sans-serif;display:grid;place-items:center;width:30px;height:30px;border:1px solid #bcc8b3;border-radius:50%;color:#596e58}.font-label{margin-left:auto;font:12px Manrope,sans-serif;color:#86907e}.lockup{display:flex;align-items:center;justify-content:center;gap:15px;height:108px;color:#506455}.lockup svg{width:60px;height:60px;flex-shrink:0}.wordmark{font-size:38px;line-height:1.2;font-optical-sizing:auto}.tagline{margin:9px 0 0;font-size:11px;letter-spacing:2px;color:#818778}.note{margin:0 0 18px;font-size:13px;color:#7a8374;line-height:1.7;text-align:center}.screen{display:block;width:100%;height:auto;border:1px solid #dedfd3;border-radius:9px}.footnote{margin:12px 0 0;font-size:11px;letter-spacing:.4px;color:#87907f;text-align:center}.endnote{margin:24px 0 0;color:#818976;font-size:12px;line-height:1.8;text-align:center}.licenses{max-width:1464px;margin:20px auto;padding:20px;font-size:12px;color:#7c8376}pre{white-space:pre-wrap;font-family:monospace;line-height:1.5}
.mobile-grid{grid-template-columns:repeat(4,1fr);gap:22px}.mobile-grid .card{padding:20px 16px}.mobile-grid .label{font-size:15px;gap:9px}.mobile-grid .font-label{display:none}.mobile-grid .lockup{height:96px;gap:8px}.mobile-grid .lockup svg{width:38px;height:38px}.mobile-grid .wordmark{font-size:26px}.mobile-grid .tagline{font-size:9px;letter-spacing:1px}.mobile-grid .note{font-size:11px;height:38px;margin-bottom:13px}.mobile-grid .screen{border-radius:18px}
.refinement .letter{width:34px;height:34px}.refinement .lockup{height:139px;gap:17px}.refinement .lockup svg{width:76px;height:76px}.refinement .wordmark{font-size:46px}.refinement .tagline{font-size:12px}.refinement .note{font-size:14px}.refinement .mobile-grid{grid-template-columns:repeat(2,1fr)}#comparison.refinement.mobile-sheet{width:1100px}.refinement .mobile-grid .screen{max-width:390px;margin:auto}.refinement .mobile-grid .note{height:auto}.refinement .mobile-grid .lockup svg{width:58px;height:58px}.refinement .mobile-grid .wordmark{font-size:34px}
`
const lockup = item => `<div class="lockup">${item.svg}<div><div class="wordmark" style="font-family:'${item.font}';font-weight:${item.weight};letter-spacing:${item.tracking}">HawTend</div><p class="tagline">照料生活，慢慢生长</p></div></div>`
const card = (item, mobile) => `<article class="card"><div class="label"><span class="letter">${item.label ?? item.key.toUpperCase()}</span>${item.name}<span class="font-label">${item.font}</span></div>${lockup(item)}<p class="note">${item.note}</p><img class="screen" src="${mobile ? item.mobile : item.desktop}" alt="${item.name}在${mobile ? '手机' : '桌面'}页面中的实际效果"><p class="footnote">${mobile ? '390 × 844 · 手机页面' : '1440 × 1080 · 桌面页面'} · 同一套虚构样例</p></article>`
const title = refinement ? '山楂枝叶，继续细化' : '四个方向，同一本手账'
const note = refinement ? '沿用 A 的山楂枝叶方向，两边均搭配已选定的 C 字体 Lora。A2 图标为本轮优化候选。' : '以上均为待选择的品牌方案。截图使用同一套样例手账，便于比较搭配效果。图标与字体可以交叉组合。'
for (const mobile of [false, true]) {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HawTend · ${mobile ? '手机' : '桌面'}品牌对照</title><style>${style}</style></head><body><main id="comparison" class="${refinement ? 'refinement' : ''}${mobile ? ' mobile-sheet' : ''}"><p class="eyebrow">HAWTEND / BRAND ${refinement ? 'REFINEMENT' : 'EXPLORATIONS'} / 2026.10.05</p><header><h1>${title}</h1><p>品牌放大 + ${mobile ? '手机' : '桌面'}实际页面<br>${refinement ? '已选字体：Lora · 图标方向：山楂枝叶' : '暖纸色 · 鼠尾草绿 · 低饱和山楂红'}</p></header><section class="grid${mobile ? ' mobile-grid' : ''}">${items.map(item => card(item, mobile)).join('')}</section><p class="endnote">${note}</p></main><footer class="licenses"><p>标记：项目内原创 SVG。字体：Manrope、DM Sans、Lora；原文件随 SIL Open Font License 1.1 及版权说明分发。字体与页面截图已内嵌，本文件可直接打开。</p>${licenses}</footer></body></html>`
  const output = new URL(`output/brand-review/${refinement ? 'refine-' : ''}${mobile ? 'mobile-compare' : 'compare'}.html`, root)
  await mkdir(new URL('./', output), { recursive: true })
  await writeFile(output, html, 'utf8')
  console.log(fileURLToPath(output))
}
