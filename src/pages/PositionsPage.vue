<template>
  <div class="page positions-page">
    <div class="page-header">
      <span class="page-title">仓位分析</span>
      <span class="total-asset-label">总资产 {{ formatMoney(totalAsset) }}</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 总仓位模块 -->
      <div class="section-card">
        <DonutChart
          :segments="chartSegments"
          :total-percent="totalPositionRatio"
        />
        <div class="total-slogan">{{ positionSlogan }}</div>
        <div class="legend">
          <div v-for="item in poolPositionData" :key="item.name" class="legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-label">{{ item.name }}</span>
            <span class="legend-value num-mono">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- 各子池仓位模块 -->
      <div class="section-card">
        <div class="section-title">各子池仓位</div>
        <!-- 共有占整行 -->
        <div class="pos-gongyou" v-if="poolPositionData.length">
          <PoolPositionCard
            :name="poolPositionData[0].name"
            :percent="poolPositionData[0].percent"
            :market-value="poolPositionData[0].marketValue"
            :color="poolPositionData[0].color"
            wide
          />
        </div>
        <!-- 四人两排两列 -->
        <div class="pos-users-grid" v-if="poolPositionData.length > 1">
          <PoolPositionCard
            v-for="item in poolPositionData.slice(1)"
            :key="item.id || item.name"
            :name="item.name"
            :percent="item.percent"
            :market-value="item.marketValue"
            :color="item.color"
          />
        </div>
      </div>

      <!-- 各池可用资金模块 -->
      <div class="section-card">
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
      </div>

      <!-- 总仓位变化模块 -->
      <div class="section-card">
        <div class="section-title">总仓位变化 <span class="subtitle">近7天</span></div>
        <div class="trend-chart">
          <div class="bars">
            <div v-for="(day, i) in trendData" :key="i" class="bar-wrapper">
              <div class="bar" :style="{ height: day.ratio * 2 + 'px' }"></div>
              <div class="bar-label">{{ day.label }}</div>
            </div>
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

const totalPositionRatio = computed(() => {
  return totalAsset.value > 0 ? (totalMarketValue.value / totalAsset.value) * 100 : 0
})

const positionSlogan = computed(() => {
  const r = totalPositionRatio.value
  if (r >= 90) return '命就一条'
  if (r >= 80) return '准备装死'
  if (r >= 70) return '股神出没'
  if (r >= 60) return '稳健老登'
  if (r >= 50) return '涨跌随缘'
  if (r >= 40) return '真的不硬'
  if (r >= 30) return '维族是ED'
  if (r >= 20) return '反弹就干'
  if (r >= 10) return '一群老GAY'
  return '纯看热闹'
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
.total-asset-label { font-size: 12px; color: var(--text-secondary); }
.legend {
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; padding: 0 0 12px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { font-size: 12px; color: var(--text-secondary); }
.legend-value { font-size: 12px; font-weight: 600; font-family: var(--font-number); }
.section-title { padding: 0 0 10px; font-size: 13px; font-weight: 600; }
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.pos-gongyou { margin-bottom: 8px; }
.pos-users-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fund-list { border-radius: var(--radius-lg); overflow: hidden; }
.fund-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fund-item:last-child { border-bottom: none; }
.fund-left { display: flex; align-items: center; gap: 8px; }
.fund-dot { width: 8px; height: 8px; border-radius: 50%; }
.fund-name { font-size: 14px; }
.fund-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  padding: 4px 0;
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
.total-slogan {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-warn);
  padding: 2px 0 8px;
  letter-spacing: 2px;
}
</style>
