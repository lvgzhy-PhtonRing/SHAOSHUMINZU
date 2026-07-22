// src/utils/formatters.js

/**
 * 格式化金额：1234567.89 → '1,234,567.89'
 */
export function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化数量：17000 → '17,000'
 */
export function formatQuantity(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(num)) return '—'
  return num.toLocaleString('zh-CN')
}

/**
 * 格式化百分比：26.03 → '26.03%'
 */
export function formatPercent(value) {
  if (value === null || value === undefined) return '—%'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—%'
  return `${num.toFixed(2)}%`
}

/**
 * 格式化价格：6.42 → '6.420'
 */
export function formatPrice(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num.toFixed(3)
}

/**
 * 格式化日期：'2026-07-22' 或 Date → '2026-07-22'
 */
export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化涨跌：带 +/- 符号
 */
export function formatChange(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2)
}
