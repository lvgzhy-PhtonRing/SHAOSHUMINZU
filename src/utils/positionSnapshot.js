// src/utils/positionSnapshot.js
// 计算当前总仓位比率并保存快照（每次交易/增资减资后调用）
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

  const today = new Date().toISOString().slice(0, 10)
  await savePositionSnapshot(today, parseFloat(ratio.toFixed(1)))
}
