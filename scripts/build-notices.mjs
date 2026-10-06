import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const notices = ['HawTend · Third-party software notices\n\nRuntime dependency licenses. Original texts follow; fonts have additional files in brand/font-licenses.\n']
for (const [directory, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!directory || info.dev) continue
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  const names = (await readdir(directory)).filter(name => /^licen[cs]e([.-]|$)/i.test(name))
  let license
  if (names.length) license = (await Promise.all(names.map(name => readFile(join(directory, name), 'utf8')))).join('\n\n')
  else if (['remark-math', 'rehype-katex'].includes(pkg.name)) license = await readFile('public/brand/font-licenses/remark-math-MIT.txt', 'utf8')
  else throw new Error(`Missing runtime license: ${pkg.name}`)
  notices.push(`\n${'='.repeat(70)}\n${pkg.name} ${pkg.version} (${pkg.license})\n${'='.repeat(70)}\n${license}`)
}
await writeFile('public/THIRD-PARTY-NOTICES.txt', notices.join('\n'))
console.log('Runtime dependency notices generated.')
