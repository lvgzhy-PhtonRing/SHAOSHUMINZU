// src/utils/positionSnapshot.js
// 计算当前总仓位比率 + 总资产并保存快照（每次交易/增资减资后调用）
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { savePositionSnapshot, fetchPositionSnapshots } from '@/api/supabase'

// 判断某日是否为周五或本月最后一个工作日（周一~周五）
function isPeriodicDay(date) {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false
  if (dow === 5) return true
  // 是否为本月最后一个工作日：下一天起直到月末全为周末
  const y = date.getFullYear()
  const m = date.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  let d = date.getDate() + 1
  while (d <= lastDay) {
    const next = new Date(y, m, d)
    const w = next.getDay()
    if (w !== 0 && w !== 6) return false
    d++
  }
  return true
}

// 若今天为周五或本月最后一个工作日且当日尚无快照，则补存当日快照
export async function ensurePeriodicSnapshot() {
  const today = new Date()
  if (!isPeriodicDay(today)) return
  const todayStr = today.toISOString().slice(0, 10)
  const recent = await fetchPositionSnapshots(30)
  if (recent.some(s => s.date === todayStr)) return
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const priceStore = usePriceStore()
  await Promise.all([
    fundStore.loadCapitalLogs(),
    holdingStore.loadHoldings()
  ])
  const codes = holdingStore.stockCodes
  if (codes.length) await priceStore.loadPrices(codes)
  await saveCurrentPositionSnapshot()
}

export async function saveCurrentPositionSnapshot() {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const priceStore = usePriceStore()

  const totalAvailable = fundStore.totalAvailable
  const holdings = holdingStore.holdings
  const prices = priceStore.prices

  const totalMv = holdings.reduce((s, h) => {
    return s + (prices[h.stock_code]?.price || 0) * h.quantity
  }, 0)
  const asset = totalMv + totalAvailable
  const ratio = asset > 0 ? (totalMv / asset) * 100 : 0

  // 计算本日外部资金净变动（排除"初始"，只计增减资）
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = new Date(today + 'T00:00:00').toISOString()
  const todayCapitalChanges = fundStore.capitalLogs
    .filter(l => l.pool_id === null && l.created_at >= todayStart && l.note !== '初始' && l.category !== 'adjust')
    .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)

  await savePositionSnapshot(today, {
    ratio: parseFloat(ratio.toFixed(1)),
    asset: Math.round(asset),
    capitalChange: todayCapitalChanges,
    updatedAt: new Date().toISOString()
  })
}
