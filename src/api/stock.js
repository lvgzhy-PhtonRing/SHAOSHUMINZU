// src/api/stock.js
// 逐级尝试行情接口: 东方财富(fetch) → 新浪(JSONP)
// 缓存: 名称永久缓存, 价格60分钟过期

const PRICE_MAX_AGE = 60 * 60 * 1000
let nameCache = {}
let priceCache = {}
let cacheTime = {}

function isStale(code) {
  return !cacheTime[code] || (Date.now() - cacheTime[code] > PRICE_MAX_AGE)
}

// ========== 方法1: 东方财富 REST API ==========
const EM_URL = 'https://push2.eastmoney.com/api/qt/stock/get'

async function fetchEastMoney(codes) {
  const requests = codes.map(code => {
    const market = code.startsWith('6') ? 1 : 0
    const url = `${EM_URL}?secid=${market}.${code}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f169`
    // 用 no-cors 获取, 或用普通 fetch
    return fetch(url).then(r => r.ok ? r.json() : null).catch(() => null)
  })
  const results = await Promise.all(requests)
  const prices = {}
  for (let i = 0; i < codes.length; i++) {
    const d = results[i]?.data
    if (!d) continue
    const price = (d.f43 || 0) / 100
    const prevClose = (d.f169 || 0) / 100
    const name = String(d.f58 || '').trim()
    if (name) nameCache[codes[i]] = name
    prices[codes[i]] = {
      stock_code: codes[i],
      stock_name: name,
      price,
      prev_close: prevClose,
      high: (d.f44 || 0) / 100,
      low: (d.f45 || 0) / 100,
      volume: d.f47 || 0,
      amount: d.f48 || 0,
      change_pct: prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : '0',
      updated_at: new Date().toISOString()
    }
  }
  return prices
}

// ========== 方法2: 新浪 JSONP (编码兼容) ==========
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
        // GB18030 编码可能导致中文乱码, 用 unescape 尝试修复
        let name = f[0] || ''
        try { name = decodeURIComponent(escape(name)) } catch(e) {}
        name = name.replace(/[^\w一-龥（）]/g, '').trim()
        if (name) nameCache[code] = name
        const price = parseFloat(f[3]) || 0
        const prevClose = parseFloat(f[2]) || 0
        prices[code] = {
          stock_code: code, stock_name: name,
          price, prev_close: prevClose,
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

  let fresh = {}
  // 优先用东方财富 API
  try { fresh = await fetchEastMoney(needFetch) } catch(e) {}

  // 东方财富没数据时，用新浪 JSONP
  if (Object.keys(fresh).length === 0) {
    try { fresh = await fetchSinaJSONP(needFetch) } catch(e) {}
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
