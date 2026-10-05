import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Browser authoring helper. The committed PNG outputs keep npm build independent
// of Playwright and the Windows icon toolchain.
const root = new URL('../', import.meta.url)
const source = process.argv[2] ?? new URL('src/assets/hawtend-mark.svg', root)
const svg = await readFile(source, 'utf8')
if (!svg.includes('<svg') || !svg.includes('viewBox="0 0 64 64"')) throw new Error('Expected the approved 64px SVG mark.')
const folder = new URL('output/brand-build/', root)
await mkdir(folder, { recursive: true })
await writeFile(new URL('public/brand/hawtend-logo.svg', root), svg, 'utf8')
const page = new URL('source.html', folder)
const callback = new URL('rasterize.js', folder)
const output = fileURLToPath(new URL('public/brand/hawtend-logo-source-1024.png', root))
await writeFile(page, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style></head><body>${svg}</body></html>`, 'utf8')
await writeFile(callback, `async (page) => {
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.goto(${JSON.stringify(page.href)});
  const rect = await page.locator('svg').boundingBox();
  if (rect.width !== 1024 || rect.height !== 1024) throw new Error('Unexpected raster dimensions');
  await page.locator('svg').screenshot({ path: ${JSON.stringify(output)}, omitBackground: true, animations: 'disabled' });
  return { width: rect.width, height: rect.height, output: ${JSON.stringify(output)} };
}
`, 'utf8')
console.log(fileURLToPath(callback))
