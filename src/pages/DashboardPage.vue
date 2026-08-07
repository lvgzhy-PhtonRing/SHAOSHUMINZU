<!-- src/pages/DashboardPage.vue -->
<template>
  <div class="page dashboard-page">
    <div class="page-header">
      <span class="page-title">持仓总览</span>
      <span class="price-time" v-if="lastUpdated">非实时市值，更新于 {{ lastUpdated }}</span>
    </div>

    <!-- 账户总资产模块 -->
    <div class="section-card">
      <AccountSummary
        :total-asset="summary.totalAsset"
        :market-value="summary.totalMarketValue"
        :available="summary.totalAvailable"
        :position-ratio="summary.positionRatio"
      />
    </div>

    <!-- 盈亏概览模块 -->
    <div class="section-card">
      <ProfitCard
        :float-pnl="summary.floatPnl"
        :daily-pnl="summary.dailyPnl"
      />
    </div>

    <PoolSelector
      :pools="poolStore.pools"
      :current="poolStore.currentPoolId"
      @select="poolStore.setCurrentPool"
    />

    <div class="section-title">
      <span>持仓股票</span>
      <span class="stock-count">{{ displayHoldings.length }} 只</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <EmptyState
      v-else-if="!displayHoldings.length"
      icon="&#x1F4ED;"
      text="暂无持仓"
    />

    <template v-else>
      <HoldingCard
        v-for="h in displayHoldings"
        :key="h.merged ? 'merged-' + h.stock_code : `${h.pool_id}-${h.stock_code}`"
        :stock="h"
        :pool-name="h.merged ? '' : (poolNameMap[h.pool_id] || '')"
        :pool-color="h.merged ? '#888888' : (poolColorMap[h.pool_id] || '#0f3460')"
        :pool-tags="h.merged ? h.poolNames : []"
        :show-verify="needsVerify(h)"
        :show-verified="!needsVerify(h) && hasVerifiedTx(h)"
        @sell="onSellStock"
        @verify="onVerifyStock"
      />
    </template>
  </div>

  <FeeVerifyDialog
    :show="verifyDialog.show"
    :pool-id="verifyDialog.poolId"
    :stock-code="verifyDialog.stockCode"
    :stock-name="verifyDialog.stockName"
    :holding-qty="verifyDialog.holdingQty"
    :current-cost="verifyDialog.currentCost"
    :transactions="verifyDialog.transactions"
    @close="verifyDialog.show = false"
    @verified="onVerifyConfirmed"
  />
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { useTransactionStore } from '@/stores/transactions'
import { calcProfit, calcPositionRatio } from '@/utils/calculators'
import { verifyHoldingCost } from '@/api/supabase'
import AccountSummary from '@/components/dashboard/AccountSummary.vue'
import ProfitCard from '@/components/dashboard/ProfitCard.vue'
import HoldingCard from '@/components/dashboard/HoldingCard.vue'
import PoolSelector from '@/components/common/PoolSelector.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FeeVerifyDialog from '@/components/holdings/FeeVerifyDialog.vue'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const txStore = useTransactionStore()

const loading = ref(true)
const lastUpdated = ref('')

// 子池名称/颜色映射
const router = useRouter()

const poolNameMap = {}
const poolColorMap = {}
const colorList = ['#5b8def', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

// ===== 手续费校对 =====
const verifyDialog = reactive({ show: false, poolId: null, stockCode: '', stockName: '', holdingQty: 0, currentCost: 0, transactions: [] })
function openVerifyDialog(stock, poolId) {
  const poolHolding = holdingStore.holdings.find(h => h.pool_id === poolId && h.stock_code === stock.stock_code)
  const qty = poolHolding ? poolHolding.quantity : stock.quantity
  const cost = poolHolding ? poolHolding.cost_price : stock.cost_price
  const txs = txStore.transactions.filter(t =>
    t.pool_id === poolId && t.stock_code === stock.stock_code && t.type === 'buy' && (!t.fee || t.fee === 0)
  )
  verifyDialog.show = true
  verifyDialog.poolId = poolId
  verifyDialog.stockCode = stock.stock_code
  verifyDialog.stockName = stock.stock_name
  verifyDialog.holdingQty = qty
  verifyDialog.currentCost = cost
  verifyDialog.transactions = txs.map(t => ({ id: t.id, quantity: t.quantity, amount: t.amount }))
}
async function onVerifyConfirmed({ poolId, stockCode, newCost, allocations }) {
  try {
    await verifyHoldingCost(poolId, stockCode, newCost, allocations)
    await Promise.all([holdingStore.loadHoldings(), txStore.loadTransactions(), fundStore.loadCapitalLogs()])
    verifyDialog.show = false
    alert('✅ 已校对，手续费已合并到交易记录')
  } catch (e) { console.error('Verify fee error:', e); alert('校对失败：' + e.message) }
}
function onVerifyStock(stock) {
  // 合并持仓：找到第一个有未校对交易的子池
  let poolId = stock.pool_id
  if (stock.merged) {
    const h = holdingStore.holdings.find(ho => ho.stock_code === stock.stock_code && txStore.transactions.some(t => t.pool_id === ho.pool_id && t.type === 'buy' && (!t.fee || t.fee === 0)))
    if (h) poolId = h.pool_id
  }
  openVerifyDialog(stock, poolId)
}
function needsVerify(h) {
  // 合并持仓：任一子池有未校对交易即显示
  if (h.merged) {
    const poolIds = holdingStore.holdings.filter(ho => ho.stock_code === h.stock_code).map(ho => ho.pool_id)
    return txStore.transactions.some(t => poolIds.includes(t.pool_id) && t.stock_code === h.stock_code && t.type === 'buy' && (!t.fee || t.fee === 0))
  }
  return txStore.transactions.some(t => t.pool_id === h.pool_id && t.stock_code === h.stock_code && t.type === 'buy' && (!t.fee || t.fee === 0))
}
function hasVerifiedTx(h) {
  if (h.merged) {
    const poolIds = holdingStore.holdings.filter(ho => ho.stock_code === h.stock_code).map(ho => ho.pool_id)
    return txStore.transactions.some(t => poolIds.includes(t.pool_id) && t.stock_code === h.stock_code && t.type === 'buy' && t.fee > 0)
  }
  return txStore.transactions.some(t => t.pool_id === h.pool_id && t.stock_code === h.stock_code && t.type === 'buy' && t.fee > 0)
}

onMounted(async () => {
  try {
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])

    poolStore.pools.forEach((p, i) => {
      poolNameMap[p.id] = p.name
      poolColorMap[p.id] = colorList[i % colorList.length]
    })

    const codes = holdingStore.stockCodes
    if (codes.length) {
      await priceStore.loadPrices(codes)
    } else {
      await priceStore.loadFromCache()
    }
  } catch (e) {
    console.error('Dashboard load error:', e)
  } finally {
    updateTime()
    loading.value = false
  }
})

function updateTime() {
  const now = new Date()
  lastUpdated.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

function onSellStock(stock) {
  // 合并持仓：选择该股票持仓量最大的子池作为卖出池
  let poolId = stock.pool_id
  let poolName = poolNameMap[poolId] || ''

  if (stock.merged) {
    const best = holdingStore.holdings
      .filter(h => h.stock_code === stock.stock_code)
      .sort((a, b) => b.quantity - a.quantity)[0]
    if (best) {
      poolId = best.pool_id
      poolName = poolNameMap[poolId] || ''
    }
  }

  router.push({
    name: 'trade',
    query: {
      code: stock.stock_code,
      name: stock.stock_name,
      price: stock.currentPrice || stock.cost_price,
      poolId,
      poolName
    }
  })
}

const displayHoldings = computed(() => {
  const poolId = poolStore.currentPoolId
  let filtered = holdingStore.holdings

  if (poolId !== null) {
    filtered = filtered.filter(h => h.pool_id === poolId)
    return filtered.map(h => {
      const priceData = priceStore.prices[h.stock_code] || {}
      const currentPrice = priceData.price || h.cost_price || 0
      const stockName = priceData.stock_name || h.stock_name || ''
      return {
        ...h,
        merged: false,
        stock_name: stockName,
        currentPrice,
        changePct: priceData.change_pct || 0,
        marketValue: currentPrice * h.quantity,
        profit: calcProfit(currentPrice, h.cost_price, h.quantity)
      }
    }).sort((a, b) => b.marketValue - a.marketValue)
  }

  // 总账户模式：相同股票跨子池合并
  const merged = {}
  for (const h of filtered) {
    if (!merged[h.stock_code]) {
      merged[h.stock_code] = { ...h, totalQty: 0, totalCost: 0, poolCount: 0, poolNames: [] }
    }
    merged[h.stock_code].totalQty += h.quantity
    merged[h.stock_code].totalCost += h.cost_price * h.quantity
    merged[h.stock_code].poolCount++
    const pn = poolNameMap[h.pool_id]
    const pc = poolColorMap[h.pool_id]
    if (pn && !merged[h.stock_code].poolNames.some(t => t.name === pn)) {
      merged[h.stock_code].poolNames.push({ name: pn, color: pc || '#888' })
    }
  }

  return Object.values(merged).map(m => {
    const priceData = priceStore.prices[m.stock_code] || {}
    const currentPrice = priceData.price || m.cost_price || 0
    const stockName = priceData.stock_name || m.stock_name || ''
    const avgCost = m.totalQty > 0 ? m.totalCost / m.totalQty : 0
    return {
      ...m,
      merged: true,
      stock_name: stockName,
      currentPrice,
      changePct: priceData.change_pct || 0,
      quantity: m.totalQty,
      cost_price: avgCost,
      marketValue: currentPrice * m.totalQty,
      profit: calcProfit(currentPrice, avgCost, m.totalQty),
      pool_id: null  // 无对应单子池
    }
  }).sort((a, b) => b.marketValue - a.marketValue)
})

const totalCapital = computed(() => fundStore.totalCapital)

const summary = computed(() => {
  const holdings = displayHoldings.value
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
  const floatPnl = totalMarketValue - totalCost
  // 总资产 = 资金池 + 浮动盈亏
  const totalAsset = totalCapital.value + floatPnl
  // 可用资金 = 资金池 - 持仓成本
  const totalAvailable = totalCapital.value - totalCost
  return {
    totalAsset,
    totalMarketValue,
    totalAvailable,
    positionRatio: calcPositionRatio(totalMarketValue, totalAsset),
    floatPnl,
    dailyPnl: holdings.reduce((s, h) => {
      const prevClose = priceStore.prices[h.stock_code]?.prev_close
      if (prevClose && prevClose > 0) return s + (h.currentPrice - prevClose) * h.quantity
      return s
    }, 0)
  }
})
</script>

<style scoped>
.price-time { font-size: 10px; color: var(--text-muted); }
.section-title {
  display: flex; justify-content: space-between;
  padding: 8px 0 6px; font-size: 13px; font-weight: 600;
}
.stock-count { font-size: 12px; color: var(--text-secondary); font-weight: 400; }
</style>
