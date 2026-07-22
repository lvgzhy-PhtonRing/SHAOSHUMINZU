// src/api/stock.js
const CACHE_TTL = 15000 // 15秒缓存

let cache = {}
let lastFetch = 0

/**
 * 东方财富行情接口
 * secid: 0.002340 → 深市(0).格林美(002340), 1.600519 → 沪市(1).茅台
 * 响应: JSON { data: { f43: 642, f58: "格林美", f170: -0.71, ... } }
 * f43=最新价(×100), f58=名称, f170=涨跌幅(×100), f169=昨收, f44=最高, f45=最低
 */

function getSecId(code) {
  // 6开头=沪市, 0/3开头=深市, 4/8开头=北交所(简化处理)
  const market = code.startsWith('6') ? 1 : 0
  return `${market}.${code}`
}

function parseEastMoneyResponse(raw, codes) {
  const results = {}
  for (const code of codes) {
    const secid = getSecId(code)
    // 东方财富返回的 key 是完整的 secid 格式
    const key = `1.${code}`
    const skey = `0.${code}`
    const item = raw[key] || raw[skey]
    if (!item) continue
    const price = (item.f43 || 0) / 100
    const prevClose = (item.f169 || 0) / 100
    results[code] = {
      stock_code: code,
      stock_name: item.f58 || '',
      open: (item.f46 || 0) / 100,
      prev_close: prevClose,
      price: price,
      high: (item.f44 || 0) / 100,
      low: (item.f45 || 0) / 100,
      volume: item.f47 || 0,
      amount: item.f48 || 0,
      change_pct: prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : '0',
      updated_at: new Date().toISOString()
    }
  }
  return results
}

/**
 * 通过 CORS 代理请求东方财富 API
 * 直接请求会被浏览器 CORS 拦截，使用免费代理转发
 */
const PROXY = 'https://api.allorigins.win/raw?url='

async function fetchViaProxy(codes) {
  const fields = 'f43,f44,f45,f46,f47,f48,f57,f58,f169'
  const requests = codes.map(code => {
    const secid = getSecId(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}`
    return fetch(`${PROXY}${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => ({ code, data: d?.data }))
      .catch(() => ({ code, data: null }))
  })

  const results = await Promise.all(requests)
  const raw = {}
  for (const r of results) {
    if (r.data) raw[`${getSecId(r.code)}`] = r.data
  }
  return parseEastMoneyResponse(raw, codes)
}

/**
 * 获取实时行情（带缓存）
 */
export async function fetchStockPrices(codes) {
  const now = Date.now()
  const cleanCodes = [...new Set(codes.filter(c => /^\d{6}$/.test(c)))]

  if (!cleanCodes.length) return {}

  // 检查缓存
  if (now - lastFetch < CACHE_TTL && Object.keys(cache).length > 0) {
    const cached = {}
    for (const code of cleanCodes) {
      if (cache[code]) cached[code] = cache[code]
    }
    if (Object.keys(cached).length === cleanCodes.length) return cached
  }

  try {
    const prices = await fetchViaProxy(cleanCodes)
    if (Object.keys(prices).length > 0) {
      cache = { ...cache, ...prices }
      lastFetch = now
    }
    return prices
  } catch (err) {
    console.error('Fetch stock prices error:', err)
    const fallback = {}
    for (const code of cleanCodes) {
      if (cache[code]) fallback[code] = cache[code]
    }
    return fallback
  }
}

/**
 * 单只股票查询
 */
export async function fetchStockPrice(code) {
  if (!/^\d{6}$/.test(code)) return null
  const result = await fetchStockPrices([code])
  return result[code] || null
}

/**
 * 清除缓存（强制刷新用）
 */
export function clearPriceCache() {
  cache = {}
  lastFetch = 0
}
