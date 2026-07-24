// src/utils/positionSnapshot.js
// 计算当前总仓位比率 + 总资产并保存快照（每次交易/增资减资后调用）
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { savePositionSnapshot } from '@/api/supabase'

export async function saveCurrentPositionSnapshot() {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const priceStore = usePriceStore()

  const totalCapital = fundStore.totalCapital
  const holdings = holdingStore.holdings
  const prices = priceStore.prices

  const totalCost = holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
  const totalMv = holdings.reduce((s, h) => {
    return s + (prices[h.stock_code]?.price || 0) * h.quantity
  }, 0)
  const asset = totalCapital + (totalMv - totalCost)
  const ratio = asset > 0 ? (totalMv / asset) * 100 : 0

  // 计算本日外部资金净变动（pool_id IS NULL 的加减资）
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = new Date(today + 'T00:00:00').toISOString()
  const todayCapitalChanges = fundStore.capitalLogs
    .filter(l => l.pool_id === null && l.created_at >= todayStart)
    .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)

  await savePositionSnapshot(today, {
    ratio: parseFloat(ratio.toFixed(1)),
    asset: Math.round(asset),
    capitalChange: todayCapitalChanges
  })
}
