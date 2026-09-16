// src/composables/useHardRanking.js
// 「谁最HARD」= 子池资产 / 初始分配。榜单页与净值页共用同一口径，
// 保证「基金经理」显示的人与榜单第一名永远一致。
import { ref, computed } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { loadPoolAllocation } from '@/api/supabase'

export const POOL_COLORS = { '春': '#ff4d6d', '维': '#00f0a8', '队': '#ffd23f', '回': '#b18cff', '公共池': '#90a4ae' }
export const POOL_ORDER = ['春', '维', '队', '回']

export function useHardRanking() {
  const poolStore = usePoolStore()
  const holdingStore = useHoldingStore()
  const priceStore = usePriceStore()
  const fundStore = useFundStore()
  const allocConfig = ref(null)

  const hardData = computed(() => {
    const rankedNames = POOL_ORDER
    const fourAlloc = poolStore.pools
      .filter(p => rankedNames.includes(p.name))
      .reduce((sum, p) => sum + (allocConfig.value?.[p.name] ?? 0), 0)
    const totalCapital = fundStore.totalCapital

    return [...rankedNames, '公共池'].map(name => {
      const pool = poolStore.pools.find(p => p.name === name)
      if (!pool) return null
      const adds = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'add').reduce((s, l) => s + l.amount, 0)
      const removes = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'remove').reduce((s, l) => s + l.amount, 0)
      const poolAlloc = name === '公共池'
        ? (totalCapital - fourAlloc)
        : (allocConfig.value?.[pool.name] ?? 0)
      const poolAvailable = poolAlloc + adds - removes
      const holdings = holdingStore.holdings.filter(h => h.pool_id === pool.id)
      const mv = holdings.reduce((s, h) => {
        return s + (priceStore.prices[h.stock_code]?.price || 0) * h.quantity
      }, 0)
      const totalAsset = poolAvailable + mv
      const ratio = poolAlloc > 0 ? (totalAsset / poolAlloc) * 100 : 0
      return { name, alloc: poolAlloc, mv, totalAsset, ratio, color: POOL_COLORS[name], isPublic: name === '公共池' }
    }).filter(Boolean)
  })

  const sortedHard = computed(() => {
    const ranked = hardData.value.filter(d => !d.isPublic).sort((a, b) => b.ratio - a.ratio)
    const pub = hardData.value.filter(d => d.isPublic)
    return [...ranked, ...pub]
  })

  // 榜单第一名；未配置初始分配时 ratio 全为 0，视为无结果
  const topHard = computed(() => (sortedHard.value[0]?.alloc > 0 ? sortedHard.value[0] : null))

  async function loadRankingData() {
    try { allocConfig.value = await loadPoolAllocation() } catch (e) {}
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  }

  return { allocConfig, hardData, sortedHard, topHard, loadRankingData }
}
