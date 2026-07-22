// src/api/stock.js
// 行情接口：优先调用 Supabase Edge Function，降级到 JSONP
// 缓存: 股票名称永久缓存, 价格60分钟过期

const PRICE_MAX_AGE = 60 * 60 * 1000
let nameCache = {}
let priceCache = {}
let cacheTime = {}

function isStale(code) {
  return !cacheTime[code] || (Date.now() - cacheTime[code] > PRICE_MAX_AGE)
}

// ========== 方法1: Supabase Edge Function ==========
const EDGE_FN = 'https://mqdxmbsaddebxlallgos.supabase.co/functions/v1/stock-proxy'

async function fetchViaEdge(codes) {
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
