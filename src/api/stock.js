// src/api/stock.js
// 行情接口：优先调用 Supabase Edge Function，降级到 JSONP
// 缓存: 股票名称永久缓存, 价格60分钟过期
// 搜索: 本地 stocks.json 优先（毫秒级），降级到远程 suggest API

const PRICE_MAX_AGE = 60 * 60 * 1000
let nameCache = {}
let priceCache = {}
let cacheTime = {}

function isStale(code) {
  return !cacheTime[code] || (Date.now() - cacheTime[code] > PRICE_MAX_AGE)
}

// ========== 本地股票列表（懒加载） ==========
const STOCKS_JSON_PATH = import.meta.env.BASE_URL + 'stocks.json'
let stockList = null       // 加载后的数组 [{c, n, p, f, m}, ...]
let stockListPromise = null

async function ensureStockList() {
  if (stockList) return stockList
  if (stockListPromise) return stockListPromise
  stockListPromise = fetch(STOCKS_JSON_PATH)
    .then(r => r.json())
    .then(data => {
      stockList = data.s || []
      return stockList
    })
    .catch(() => {
      console.warn('[stock] 本地股票列表加载失败，回退到远程搜索')
      stockList = null  // 标记加载失败，走远程降级
      stockListPromise = null
      return null
    })
  return stockListPromise
}

function searchLocalStocks(query) {
  if (!stockList) return null  // null = 尚未加载完成，调用方应等待或降级
  const q = query.toLowerCase().trim()
  if (!q) return []

  const results = []
  const isDigits = /^\d+$/.test(q)

  for (const s of stockList) {
    let score = 0

    if (isDigits) {
      // 纯数字：匹配代码前缀
      if (s.c === q) {
        score = 100
      } else if (s.c.startsWith(q)) {
        score = q.length * 15
      }
    } else {
      // 文字/拼音：多层匹配
      if (s.n === q) score = Math.max(score, 95)           // 名称完全匹配
      if (s.n.startsWith(q)) score = Math.max(score, 85)   // 名称前缀
      if (s.n.includes(q)) score = Math.max(score, 75)     // 名称包含
      if (s.p.startsWith(q)) score = Math.max(score, 70)   // 全拼前缀
      if (s.f === q) score = Math.max(score, 65)           // 首字母完全匹配
      if (s.p.includes(q)) score = Math.max(score, 60)     // 全拼包含
      if (s.f.startsWith(q)) score = Math.max(score, 55)   // 首字母前缀
      if (s.f.includes(q)) score = Math.max(score, 45)     // 首字母包含
    }

    if (score > 0) {
      results.push({ ...s, score })
    }
  }

  // 按分数降序，取前 20 条
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 20).map(s => ({
    stock_code: s.c,
    stock_name: s.n,
    market: s.m === 'sh' ? '沪' : '深'
  }))
}

export function preloadStockList() {
  ensureStockList()
}

// ========== 方法1: Supabase Edge Function ==========
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const EDGE_FN = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/stock-proxy` : null

async function fetchViaEdge(codes) {
  if (!EDGE_FN) return {}
  const resp = await fetch(`${EDGE_FN}?codes=${codes.join(',')}`, {
    headers: { 'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '') }
  })
  if (!resp.ok) return {}
  const json = await resp.json()
  const prices = json.data || {}
  for (const code of Object.keys(prices)) {
    if (prices[code]?.stock_name) nameCache[code] = prices[code].stock_name
  }
  return prices
}

// ========== 方法2: 新浪 JSONP (无 CORS 问题) ==========
function fetchSinaJSONP(codes) {
  return new Promise((resolve) => {
    const formatted = codes.map(c => {
      if (c.startsWith('6')) return `sh${c}`
      if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`
      return c
    }).join(',')

    const script = document.createElement('script')
    script.src = `https://hq.sinajs.cn/list=${formatted}&t=${Date.now()}`
    script.charset = 'gb18030'
    const timer = setTimeout(() => { cleanup(); resolve({}) }, 8000)

    function cleanup() {
      clearTimeout(timer)
      if (script.parentNode) document.body.removeChild(script)
    }

    script.onload = () => {
      cleanup()
      const prices = {}
      for (const code of codes) {
        const key = code.startsWith('6') ? `hq_str_sh${code}` : `hq_str_sz${code}`
        const raw = window[key]
        if (!raw) continue
        const f = String(raw).split(',')
        if (f.length < 10) continue
        let name = f[0] || ''
        try { name = decodeURIComponent(escape(name)) } catch (e) {}
        name = name.replace(/[^\w一-鿿（）]/g, '').trim()
        if (name) nameCache[code] = name
        const price = parseFloat(f[3]) || 0
        const prevClose = parseFloat(f[2]) || 0
        prices[code] = {
          stock_code: code, stock_name: name, price, prev_close: prevClose,
          high: parseFloat(f[4]) || 0, low: parseFloat(f[5]) || 0,
          volume: parseInt(f[8]) || 0, amount: parseFloat(f[9]) || 0,
          change_pct: prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : '0',
          updated_at: new Date().toISOString()
        }
        delete window[key]
      }
      resolve(prices)
    }
    script.onerror = () => { cleanup(); resolve({}) }
    document.body.appendChild(script)
  })
}

// ========== 对外开放接口 ==========

export async function fetchStockPrices(codes) {
  const cleanCodes = [...new Set(codes.filter(c => /^\d{6}$/.test(c)))]
  if (!cleanCodes.length) return {}

  const needFetch = cleanCodes.filter(c => !priceCache[c] || isStale(c))
  if (needFetch.length === 0) {
    const r = {}; for (const c of cleanCodes) if (priceCache[c]) r[c] = priceCache[c]; return r
  }

  // 优先用 Edge Function
  let fresh = await fetchViaEdge(needFetch).catch(() => ({}))

  // Edge Function 未部署或失败时，用 JSONP
  if (Object.keys(fresh).length === 0) {
    fresh = await fetchSinaJSONP(needFetch).catch(() => ({}))
  }

  const now = Date.now()
  for (const code of needFetch) {
    if (fresh[code]) { priceCache[code] = fresh[code]; cacheTime[code] = now }
  }

  const result = {}
  for (const code of cleanCodes) result[code] = priceCache[code] || null
  return result
}

export async function fetchStockPrice(code) {
  if (!/^\d{6}$/.test(code)) return null
  if (nameCache[code] && priceCache[code] && !isStale(code)) return priceCache[code]
  const result = await fetchStockPrices([code])
  return result[code] || (nameCache[code] ? { stock_code: code, stock_name: nameCache[code], price: 0 } : null)
}

export function clearPriceCache() {
  cacheTime = {}; priceCache = {}
}

// ========== 拼音/名称联想 ==========
const SUGGEST_MAX_AGE = 2 * 60 * 1000
let suggestCache = {}
let suggestCacheTime = {}

async function fetchSuggestViaEdge(key) {
  if (!EDGE_FN) return []
  const resp = await fetch(`${EDGE_FN}?key=${encodeURIComponent(key)}`, {
    headers: { 'Authorization': 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || '') }
  })
  if (!resp.ok) return []
  const json = await resp.json()
  const suggestions = json.suggestions || []
  for (const s of suggestions) {
    if (s.stock_name) nameCache[s.stock_code] = s.stock_name
  }
  return suggestions
}

function fetchSuggestJSONP(key) {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(key)}&t=${Date.now()}`
    script.charset = 'gb18030'
    const timer = setTimeout(() => { cleanup(); resolve([]) }, 8000)

    function cleanup() {
      clearTimeout(timer)
      if (script.parentNode) document.body.removeChild(script)
      delete window.suggestvalue
    }

    // Sina suggest 返回 var suggestvalue="..." 声明全局变量，不是 JSONP callback
    script.onload = () => {
      cleanup()
      const raw = window.suggestvalue
      if (!raw) { resolve([]); return }
      const suggestions = []
      const entries = String(raw).split(';').filter(e => e.trim())
      for (const entry of entries) {
        const parts = entry.split(',')
        const name = parts[0] || ''
        const type = parts[1] || ''
        const code = parts[2] || ''
        if (!/^\d{6}$/.test(code)) continue
        if (type !== '11' && type !== '12') continue
        try {
          const decoded = decodeURIComponent(escape(name))
          if (decoded) nameCache[code] = decoded.replace(/[^\w一-鿿（）]/g, '').trim()
        } catch (e) {}
        suggestions.push({
          stock_code: code,
          stock_name: nameCache[code] || name,
          market: type === '11' ? '沪' : '深'
        })
      }
      resolve(suggestions)
    }

    script.onerror = () => { cleanup(); resolve([]) }
    document.body.appendChild(script)
  })
}

export async function fetchStockSuggestions(key) {
  if (!key || !key.trim()) return []
  const k = key.trim()

  // 优先本地搜索（毫秒级）
  const list = await ensureStockList()
  if (list) {
    return searchLocalStocks(k) || []
  }

  // 降级：本地列表未加载成功，走远程 API
  if (suggestCache[k] && (Date.now() - suggestCacheTime[k] < SUGGEST_MAX_AGE)) {
    return suggestCache[k]
  }

  let suggestions = await fetchSuggestViaEdge(k).catch(() => [])
  if (!suggestions.length) {
    suggestions = await fetchSuggestJSONP(k).catch(() => [])
  }

  suggestCache[k] = suggestions
  suggestCacheTime[k] = Date.now()
  return suggestions
}
