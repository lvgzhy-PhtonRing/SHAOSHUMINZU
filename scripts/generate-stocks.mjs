// scripts/generate-stocks.mjs
// 从新浪 API 拉取全部 A 股（沪主板、科创板、深主板、创业板），
// 生成带拼音的 public/stocks.json，供前端本地搜索使用。
//
// 用法: node scripts/generate-stocks.mjs

import { pinyin } from 'pinyin-pro'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'public', 'stocks.json')

const SINA = 'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData'

async function fetchSinaMarket(node, label) {
  const stocks = []
  let page = 1
  while (true) {
    const url = `${SINA}?page=${page}&num=100&sort=symbol&asc=1&node=${node}`
    const resp = await fetch(url)
    const text = await resp.text()
    if (!text || text.trim() === 'null' || text.trim() === '[]') break
    try {
      const data = JSON.parse(text)
      if (!Array.isArray(data) || data.length === 0) break
      for (const item of data) {
        // Sina 返回 symbol 带 sh/sz 前缀，如 "sh600519"
        const code = item.symbol.replace(/^(sh|sz)/, '')
        if (!/^\d{6}$/.test(code)) continue
        stocks.push({
          c: code,
          n: item.name,
          m: node.startsWith('sh') ? 'sh' : 'sz'
        })
      }
      page++
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.warn(`  ⚠ ${label} page ${page}: parse error`)
      break
    }
  }
  return stocks
}

async function main() {
  console.log('📡 拉取 A 股全量列表（新浪）…')

  const sh = await fetchSinaMarket('sh_a', '沪市')
  console.log(`  ✅ 沪市: ${sh.length} 只`)

  const sz = await fetchSinaMarket('sz_a', '深市')
  console.log(`  ✅ 深市: ${sz.length} 只`)

  // 筛选目标市场
  // 沪主板: 600-605, 科创板: 688-689
  // 深主板: 000-003, 创业板: 300-302
  const ALLOWED = /^(60[0-5]|68[8-9]|00[0-3]|30[0-2])/
  const all = [...sh, ...sz].filter(s => ALLOWED.test(s.c))

  // 去重
  const seen = new Set()
  const deduped = []
  for (const s of all) {
    if (seen.has(s.c)) continue
    seen.add(s.c)
    deduped.push(s)
  }

  console.log(`\n📊 四市场共 ${deduped.length} 只股票`)
  console.log('🔤 生成拼音…')

  const stocks = deduped.map(s => {
    const full = pinyin(s.n, { toneType: 'none', type: 'array' }).join('').toLowerCase()
    const first = pinyin(s.n, { pattern: 'first', toneType: 'none' }).replace(/\s+/g, '').toLowerCase()
    return { c: s.c, n: s.n, p: full, f: first, m: s.m }
  })

  const data = { v: new Date().toISOString().slice(0, 10), s: stocks }
  writeFileSync(OUT, JSON.stringify(data))
  const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1)
  console.log(`\n✨ 已生成 ${OUT}`)
  console.log(`   ${stocks.length} 只股票 · ${kb} KB (原始)`)

  // 样本验证
  const samples = ['600519', '000001', '688981', '300750']
  console.log('\n📋 样本:')
  for (const c of samples) {
    const s = stocks.find(x => x.c === c)
    if (s) console.log(`   ${s.c} ${s.n} → ${s.p} / ${s.f}`)
    else console.log(`   ${c}: MISSING!`)
  }
}

main().catch(err => {
  console.error('❌ 生成失败:', err)
  process.exit(1)
})
