<template>
  <div class="page positions-page">
    <div class="page-header">
      <span class="page-title">仓位分析</span>
      <span class="total-asset-label">总资产 {{ formatMoney(totalAsset) }}</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 环形饼图 + 图例 -->
      <div class="card" style="margin:0 16px 16px">
        <DonutChart
          :segments="chartSegments"
          :total-percent="totalPositionRatio"
        />
        <div class="legend">
          <div v-for="item in poolPositionData" :key="item.name" class="legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-label">{{ item.name }}</span>
            <span class="legend-value num-mono">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- 子池仓位网格 -->
      <div class="section-title">各子池仓位</div>
      <div class="pool-pos-grid">
        <PoolPositionCard
          v-for="item in poolPositionData"
          :key="item.id || item.name"
          :name="item.name"
          :percent="item.percent"
          :market-value="item.marketValue"
          :color="item.color"
        />
      </div>

      <!-- 各池可用资金 -->
      <div class="section-title">各池可用资金</div>
      <div class="fund-list">
        <div v-for="item in poolFundData" :key="item.name" class="fund-item">
          <div class="fund-left">
            <span class="fund-dot" :style="{ background: item.color }"></span>
            <span class="fund-name">{{ item.name }}</span>
          </div>
          <span class="fund-amount num-mono">{{ formatMoney(item.available) }}</span>
        </div>
      </div>

      <!-- 仓位趋势 -->
      <div class="section-title">总仓位变化 <span class="subtitle">近7天</span></div>
      <div class="card trend-chart">
        <div class="bars">
          <div v-for="(day, i) in trendData" :key="i" class="bar-wrapper">
            <div class="bar" :style="{ height: day.ratio * 2 + 'px' }"></div>
            <div class="bar-label">{{ day.label }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'
import DonutChart from '@/components/positions/DonutChart.vue'
import PoolPositionCard from '@/components/positions/PoolPositionCard.vue'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const totalCapital = ref(829661.35)

const colorList = ['#0f3460', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

const totalCost = computed(() => {
  return holdingStore.holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
})

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

const floatPnl = computed(() => totalMarketValue.value - totalCost.value)
const totalAsset = computed(() => totalCapital.value + floatPnl.value)
const totalAvailable = computed(() => totalCapital.value - totalCost.value)
// 从 localStorage 恢复各池分配比例
const saved = localStorage.getItem('poolPercents')
const poolPercents = saved ? JSON.parse(saved) : { '共有': 40, '春': 15, '维': 15, '队': 15, '回': 15 }

const totalCost = computed(() => {
  return holdingStore.holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
})

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

const floatPnl = computed(() => totalMarketValue.value - totalCost.value)
const totalAsset = computed(() => totalCapital.value + floatPnl.value)
const totalAvailable = computed(() => totalCapital.value - totalCost.value)
const totalPositionRatio = computed(() => {
  return totalAsset.value > 0 ? (totalMarketValue.value / totalAsset.value) * 100 : 0
})

const poolPositionData = computed(() => {
  return poolStore.pools.map((p, i) => {
    const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === p.id)
    const mv = poolHoldings.reduce((s, h) => {
      const price = priceStore.prices[h.stock_code]?.price || 0
      return s + price * h.quantity
    }, 0)
    const cost = poolHoldings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
    // 该池分配资金 = 总资金池 × 分配百分比
    const allocPct = poolPercents[p.name] || 20
    const poolCapital = totalCapital.value * allocPct / 100
    // 该池仓位 = 该池持股市值 / 该池分配资金
    const positionRatio = poolCapital > 0 ? (mv / poolCapital) * 100 : 0
    return {
      ...p,
      marketValue: mv,
      cost,
      poolCapital,
      positionRatio,
      percent: positionRatio,
      color: colorList[i % colorList.length]
    }
  })
})

const donutSize = 200
const chartRadius = donutSize / 2 - 20

const chartSegments = computed(() => {
  let offset = 0
  const circ = 2 * Math.PI * chartRadius
  return poolPositionData.value.map(p => {
    const arcLength = (p.percent / 100) * circ
    const seg = { color: p.color, arcLength, offset: -offset }
    offset += arcLength
    return seg
  })
})

const poolFundData = computed(() => {
  return poolStore.pools.map((p, i) => {
    const poolData = poolPositionData.value.find(d => d.id === p.id)
    const percent = poolData?.percent || 0
    return {
      name: p.name,
      available: (percent / 100) * totalAvailable.value,
      color: colorList[i % colorList.length]
    }
  })
})

const trendData = [
  { label: '一', ratio: 24 }, { label: '二', ratio: 28 },
  { label: '三', ratio: 32 }, { label: '四', ratio: 26 },
  { label: '五', ratio: 22 }, { label: '六', ratio: 26 },
  { label: '日', ratio: 26 }
]

onMounted(async () => {
  try {
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Positions page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 16px;
}
.page-title { font-size: 18px; font-weight: 700; }
.total-asset-label { font-size: 12px; color: var(--text-secondary); }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  padding: 0 16px 16px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { font-size: 12px; color: var(--text-secondary); }
.legend-value { font-size: 12px; font-weight: 600; font-family: var(--font-number); }
.section-title {
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 600;
}
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.pool-pos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px 8px;
}
.fund-list {
  margin: 0 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.fund-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fund-item:last-child { border-bottom: none; }
.fund-left { display: flex; align-items: center; gap: 8px; }
.fund-dot { width: 8px; height: 8px; border-radius: 50%; }
.fund-name { font-size: 14px; }
.fund-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.trend-chart { margin: 0 16px 16px; }
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  padding: 8px 0;
}
.bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.bar {
  width: 100%;
  max-width: 24px;
  background: var(--bg-accent);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}
.bar-label { font-size: 10px; color: var(--text-muted); }
</style>
