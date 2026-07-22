// src/api/stock.js
// 使用 JSONP 方式绕过 CORS 限制，直接调用新浪行情接口
const CACHE_TTL = 15000
let cache = {}
let lastFetch = 0

/**
 * JSONP 方式获取新浪行情
 * <script> 标签不受 CORS 限制，加载后读取全局变量
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

    // Script 加载完成后，新浪数据已写入全局 hq_str_* 变量
    script.onload = () => {
      cleanup()
      const results = {}
      for (const code of codes) {
        const key = code.startsWith('6') ? `hq_str_sh${code}` : `hq_str_sz${code}`
        const raw = window[key]
        if (!raw) continue
        const fields = String(raw).split(',')
        if (fields.length < 10) continue
        const price = parseFloat(fields[3]) || 0
        const prevClose = parseFloat(fields[2]) || 0
        results[code] = {
          stock_code: code,
          stock_name: (fields[0] || '').trim(),
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
        // 清理全局变量
        delete window[key]
      }
      resolve(results)
    }

    document.body.appendChild(script)
  })
}

/**
 * 获取实时行情（带缓存）
 */
export async function fetchStockPrices(codes) {
  const now = Date.now()
  const cleanCodes = [...new Set(codes.filter(c => /^\d{6}$/.test(c)))]
  if (!cleanCodes.length) return {}

  // 缓存命中
  if (now - lastFetch < CACHE_TTL && Object.keys(cache).length > 0) {
    const cached = {}
    for (const code of cleanCodes) {
      if (cache[code]) cached[code] = cache[code]
    }
    if (Object.keys(cached).length === cleanCodes.length) return cached
  }

  try {
    const prices = await sinaJsonp(cleanCodes)
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
