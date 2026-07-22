// src/api/stock.js
// JSONP 绕过 CORS 调用新浪行情接口
// 缓存策略：股票名称永久缓存，实时价格 60 分钟过期

const PRICE_MAX_AGE = 60 * 60 * 1000 // 60 分钟

// nameCache: 永久缓存股票名称 { code: name }
// priceCache: 价格数据 { code: { price, change_pct, ... } }
// cacheTime: 价格缓存的时间戳 { code: timestamp }
let nameCache = {}
let priceCache = {}
let cacheTime = {}

/**
 * JSONP 获取新浪行情
 */
function sinaJsonp(codes) {
  return new Promise((resolve, reject) => {
    const formatted = codes.map(c => {
      if (c.startsWith('6')) return `sh${c}`
      if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`
      return c
    }).join(',')

    const script = document.createElement('script')
    script.src = `https://hq.sinajs.cn/list=${formatted}&r=${Date.now()}`
    script.charset = 'gb18030'
    script.onerror = () => { cleanup(); reject(new Error('Script load failed')) }

    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout')) }, 10000)

    function cleanup() {
      clearTimeout(timer)
      document.body.removeChild(script)
    }

    script.onload = () => {
      cleanup()
      const results = {}
      for (const code of codes) {
        const key = code.startsWith('6') ? `hq_str_sh${code}` : `hq_str_sz${code}`
        const raw = window[key]
        if (!raw) continue
        const fields = String(raw).split(',')
        if (fields.length < 10) continue
        const name = (fields[0] || '').trim()
        const price = parseFloat(fields[3]) || 0
        const prevClose = parseFloat(fields[2]) || 0
        // 永久保存股票名称
        if (name) nameCache[code] = name
        results[code] = {
          stock_code: code,
          stock_name: name,
          open: parseFloat(fields[1]) || 0,
          prev_close: prevClose,
          price: price,
          high: parseFloat(fields[4]) || 0,
          low: parseFloat(fields[5]) || 0,
          volume: parseInt(fields[8]) || 0,
          amount: parseFloat(fields[9]) || 0,
          change_pct: prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : '0',
          updated_at: new Date().toISOString()
        }
        delete window[key]
      }
      resolve(results)
    }

    document.body.appendChild(script)
  })
}

/**
 * 判断价格数据是否需要刷新（超过 60 分钟）
 */
function isPriceStale(code) {
  const last = cacheTime[code]
  return !last || (Date.now() - last > PRICE_MAX_AGE)
}

/**
 * 获取实时行情
 * 缓存策略：60 分钟内不重复请求
 */
export async function fetchStockPrices(codes) {
  const cleanCodes = [...new Set(codes.filter(c => /^\d{6}$/.test(c)))]
  if (!cleanCodes.length) return {}

  const now = Date.now()
  // 找出需要刷新的股票：没缓存或超过 60 分钟
  const needFetch = cleanCodes.filter(c => !priceCache[c] || isPriceStale(c))

  // 如果全部在缓存且未过期，直接返回缓存
  if (needFetch.length === 0) {
    const result = {}
    for (const code of cleanCodes) {
      if (priceCache[code]) result[code] = priceCache[code]
    }
    return result
  }

  try {
    const fresh = await sinaJsonp(needFetch)
    if (Object.keys(fresh).length > 0) {
      for (const code of needFetch) {
        if (fresh[code]) {
          priceCache[code] = fresh[code]
          cacheTime[code] = now
        }
      }
    }
  } catch (err) {
    console.error('Fetch stock prices error:', err)
  }

  // 返回所有请求的股票数据（优先返回新数据，没有则用缓存）
  const result = {}
  for (const code of cleanCodes) {
    result[code] = priceCache[code] || null
  }
  return result
}

/**
 * 单只股票查询（交易搜索用）
 * 优先返回缓存的名称，避免重复请求
 */
export async function fetchStockPrice(code) {
  if (!/^\d{6}$/.test(code)) return null

  // 如果已有名称且价格缓存未过期，直接返回
  if (nameCache[code] && priceCache[code] && !isPriceStale(code)) {
    return priceCache[code]
  }

  // 如果只有名称没有价格，也返回名称（价格字段为 0）
  if (nameCache[code] && priceCache[code]) {
    return priceCache[code]
  }

  // 需要查询
  const result = await fetchStockPrices([code])
  const data = result[code]
  if (data) return data

  // 实在查不到，至少返回缓存的名字
  if (nameCache[code]) {
    return { stock_code: code, stock_name: nameCache[code], price: 0 }
  }
  return null
}

/**
 * 强制刷新（下拉刷新用）
 */
export function clearPriceCache() {
  cacheTime = {}
  priceCache = {}
  // 注意：不清除 nameCache，股票名称永久保留
}
