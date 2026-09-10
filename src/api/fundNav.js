// src/api/fundNav.js
// 第三方基金净值数据：本地缓存 + 本地静态种子 + 东方财富抓取
//
// 读取路径（FundNavChart 用，保证图表即时渲染）：
//   1. localStorage 缓存（历史净值不可变 → 永不自动过期）
//   2. 本地静态种子 public/fund_nav/<code>.json（同源 fetch，无跨域限制）
//
// 写入路径（App 每次启动调用 refreshFundNav，无需手动刷新）：
//   联网抓取东方财富 → 成功回写缓存；抓取失败保留缓存/种子不动（本地兜底）
//
// 种子文件由 scripts/gen-fund-nav-seed.mjs 生成（gitignore，不入库）

// 跟踪的参考基金代码
export const FUND_CODES = ['027730', '027317']

const CACHE_KEY = 'etf_fund_nav_cache'
const SEED_BASE = import.meta.env.BASE_URL + 'fund_nav/'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeCache(obj) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
  } catch (e) {
    console.warn('[fundNav] cache write fail:', e)
  }
}

// 从本地静态种子 JSON 读取（同源，稳定可靠）
async function fetchSeed(code) {
  try {
    const resp = await fetch(`${SEED_BASE}${code}.json`, { cache: 'no-store' })
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.warn(`[fundNav] seed ${code} load fail:`, e.message)
    return []
  }
}

// 联网抓取东方财富 pingzhongdata 脚本（仅手动刷新时调用）
function fetchEastmoneyNav(code) {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    let done = false

    const cleanup = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      delete window.Data_netWorthTrend
      if (script.parentNode) script.parentNode.removeChild(script)
    }

    const timer = setTimeout(() => { cleanup(); resolve([]) }, 10000)
    script.onload = () => {
      const trend = window.Data_netWorthTrend
      cleanup()
      const points = (Array.isArray(trend) ? trend : [])
        .map(p => ({
          date: tsToDate(p.x),
          nav: parseFloat(p.y) || 0
        }))
        .filter(d => d.date && d.nav > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
      resolve(points)
    }
    script.onerror = () => { cleanup(); resolve([]) }
    script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    document.head.appendChild(script)
  })
}

function tsToDate(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function storeCache(code, data) {
  const cache = readCache()
  cache[code] = { fetchedAt: Date.now(), data }
  writeCache(cache)
}

// 获取基金历史净值：[{date:'YYYY-MM-DD', nav:1.0234}, ...]
// 优先级：本地缓存 → 静态种子。（不放网络抓取，避免跨域/阻塞）
export async function getFundNav(code) {
  const cache = readCache()
  const cached = cache[code]
  if (cached && Array.isArray(cached.data) && cached.data.length) {
    return { code, data: cached.data, fromCache: true, source: 'cache' }
  }
  const seed = await fetchSeed(code)
  if (seed.length) {
    storeCache(code, seed)
    return { code, data: seed, fromCache: false, source: 'seed' }
  }
  return { code, data: [], fromCache: false, source: 'none' }
}

// 强制刷新：联网抓取东方财富，成功后写入缓存并返回
export async function refreshFundNav(code) {
  const data = await fetchEastmoneyNav(code)
  if (data.length) {
    storeCache(code, data)
    return { code, data, fromCache: false, source: 'network' }
  }
  // 抓取失败 → 回退本地缓存或种子
  const cache = readCache()
  const cached = cache[code]
  if (cached && Array.isArray(cached.data) && cached.data.length) {
    return { code, data: cached.data, fromCache: true, source: 'cache' }
  }
  const seed = await fetchSeed(code)
  return { code, data: seed, fromCache: false, source: 'seed' }
}