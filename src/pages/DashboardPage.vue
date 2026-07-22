<!-- src/pages/DashboardPage.vue -->
<template>
  <div class="page dashboard-page">
    <div class="page-header">
      <span class="page-title">持仓总览</span>
      <span class="price-time" v-if="lastUpdated">非实时市值，更新于 {{ lastUpdated }}</span>
    </div>

    <AccountSummary
      :total-asset="summary.totalAsset"
      :market-value="summary.totalMarketValue"
      :available="summary.totalAvailable"
      :position-ratio="summary.positionRatio"
    />

    <ProfitCard
      :float-pnl="summary.floatPnl"
      :daily-pnl="summary.dailyPnl"
    />

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
        :key="`${h.pool_id}-${h.stock_code}`"
        :stock="h"
        :pool-name="poolNameMap[h.pool_id] || ''"
        :pool-color="poolColorMap[h.pool_id] || '#0f3460'"
        @sell="onSellStock"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { calcProfit, calcPositionRatio } from '@/utils/calculators'
import AccountSummary from '@/components/dashboard/AccountSummary.vue'
import ProfitCard from '@/components/dashboard/ProfitCard.vue'
import HoldingCard from '@/components/dashboard/HoldingCard.vue'
import PoolSelector from '@/components/common/PoolSelector.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const lastUpdated = ref('')

// 子池名称/颜色映射
const router = useRouter()

const poolNameMap = {}
const poolColorMap = {}
const colorList = ['#0f3460', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

onMounted(async () => {
  try {
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings()
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
  router.push({
    name: 'trade',
    query: {
      code: stock.stock_code,
      name: stock.stock_name,
      price: stock.currentPrice || stock.cost_price,
      poolId: stock.pool_id,
      poolName: poolNameMap[stock.pool_id] || ''
    }
  })
}

const displayHoldings = computed(() => {
  const poolId = poolStore.currentPoolId
  let filtered = holdingStore.holdings

  if (poolId !== null) {
    filtered = filtered.filter(h => h.pool_id === poolId)
  }

  return filtered.map(h => {
    const priceData = priceStore.prices[h.stock_code] || {}
    const currentPrice = priceData.price || h.cost_price || 0
    const stockName = priceData.stock_name || h.stock_name || ''
    return {
      ...h,
      stock_name: stockName,
      currentPrice,
      changePct: priceData.change_pct || 0,
      marketValue: currentPrice * h.quantity,
      profit: calcProfit(currentPrice, h.cost_price, h.quantity)
    }
  }).sort((a, b) => b.marketValue - a.marketValue)
})

const totalCapital = ref(829661.35)

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
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 12px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
}
.price-time {
  font-size: 10px;
  color: var(--text-muted);
}
.section-title {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px 6px;
  font-size: 13px;
  font-weight: 600;
}
.stock-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}
</style>
