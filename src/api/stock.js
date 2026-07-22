// src/api/stock.js
const BASE_URL = 'https://hq.sinajs.cn/list='
const CACHE_TTL = 15000 // 15秒缓存

let cache = {}
let lastFetch = 0

/**
 * 构建新浪股票代码格式：深市 sz, 沪市 sh
 */
function formatCode(code) {
  if (code.startsWith('6')) return `sh${code}`
  if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`
  return code
}

/**
 * 解析新浪返回的 CSV 格式
 * 格式：var hq_str_sh600519="贵州茅台,1482.00,-1.23,..."
 * 字段：名称,今开,昨收,现价,最高,最低,买入价,卖出价,成交量,成交额,日期,时间,...
 */
function parseSinaResponse(text) {
  const results = {}
  const lines = text.split(';\n').filter(l => l.trim())
  for (const line of lines) {
    const match = line.match(/hq_str_(\w+)="(.+)"/)
    if (!match) continue
    const code = match[1].replace(/^(sh|sz)/, '')
    const fields = match[2].split(',')
    results[code] = {
      stock_code: code,
      stock_name: fields[0],
      open: parseFloat(fields[1]) || 0,
      prev_close: parseFloat(fields[2]) || 0,
      price: parseFloat(fields[3]) || 0,
      high: parseFloat(fields[5]) || 0,
      low: parseFloat(fields[6]) || 0,
      volume: parseInt(fields[8]) || 0,
      amount: parseFloat(fields[9]) || 0,
      change_pct: fields[2] && fields[3]
        ? (((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2])) * 100).toFixed(2)
        : '0',
      updated_at: new Date().toISOString()
    }
  }
  return results
}

/**
 * 获取实时行情（带缓存）
 */
export async function fetchStockPrices(codes) {
  const now = Date.now()

  // 如果缓存还在有效期内，直接返回缓存数据
  if (now - lastFetch < CACHE_TTL && Object.keys(cache).length > 0) {
    const cached = {}
    for (const code of codes) {
      if (cache[code]) cached[code] = cache[code]
    }
    if (Object.keys(cached).length === codes.length) return cached
  }

  try {
    const formattedCodes = codes.map(formatCode).join(',')
    // 添加随机参数避免浏览器缓存
    const url = `${BASE_URL}${formattedCodes}&r=${now}`
    const response = await fetch(url, {
      headers: { 'Referer': 'https://finance.sina.com.cn' }
    })
    const text = await response.text()
    const prices = parseSinaResponse(text)

    // 更新缓存
    cache = { ...cache, ...prices }
    lastFetch = now
    return prices
  } catch (err) {
    console.error('Fetch stock prices error:', err)
    // 出错时返回缓存数据
    const fallback = {}
    for (const code of codes) {
      if (cache[code]) fallback[code] = cache[code]
    }
    return fallback
  }
}

/**
 * 单只股票查询
 */
export async function fetchStockPrice(code) {
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
