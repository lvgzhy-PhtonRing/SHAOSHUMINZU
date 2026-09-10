// scripts/gen-fund-nav-seed.mjs
// 从东方财富 lsjz API 抓取基金历史单位净值，生成 public/fund_nav/<code>.json 静态种子
// 同时生成 version.json（种子版本号，供前端检测缓存是否需要刷新）
// 历史净值不可变 → 种子文件可作为离线数据源
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/fund_nav')

const CODES = ['027730', '027317']

async function fetchLsjz(code) {
  const all = []
  let pageIndex = 1
  const pageSize = 100
  while (true) {
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=${pageIndex}&pageSize=${pageSize}&startDate=&endDate=`
    const resp = await fetch(url, {
      headers: { Referer: 'https://fundf10.eastmoney.com/' }
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const json = await resp.json()
    const list = json?.Data?.LSJZList || []
    all.push(...list)
    if (list.length < pageSize) break
    pageIndex++
  }
  return all
    .map(d => ({ date: d.FSRQ, nav: parseFloat(d.DWJZ) }))
    .filter(d => d.date && d.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

const written = {}
for (const code of CODES) {
  try {
    const points = await fetchLsjz(code)
    fs.mkdirSync(OUT_DIR, { recursive: true })
    const file = path.join(OUT_DIR, `${code}.json`)
    fs.writeFileSync(file, JSON.stringify(points, null, 2))
    written[code] = points.length
    console.log(`${code}: ${points.length} 点 (${points[0]?.date} ~ ${points[points.length - 1]?.date}) → ${file}`)
  } catch (e) {
    console.error(`${code}: 失败 ${e.message}`)
  }
}

// 种子版本号：内容摘要，前端据此判断本地缓存是否需要刷新
if (Object.keys(written).length) {
  const version = JSON.stringify(written) + ':' + new Date().toISOString().slice(0, 10)
  fs.writeFileSync(path.join(OUT_DIR, 'version.json'), JSON.stringify({ version }, null, 2))
  console.log('version →', version)
}
console.log('done')