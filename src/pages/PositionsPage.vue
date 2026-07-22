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
        <div class="total-ratio-detail">
          <span class="trd-label">总市值</span>
          <span class="trd-value num-mono">{{ formatMoney(totalMarketValue) }}</span>
          <span class="trd-sep">/</span>
          <span class="trd-label">总资产</span>
          <span class="trd-value num-mono">{{ formatMoney(totalAsset) }}</span>
        </div>
        <div class="total-slogan">
          <span class="slogan-emoji">{{ positionSlogan.emoji }}</span>
          <span class="slogan-text">{{ positionSlogan.text }}</span>
        </div>
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
            :total-pool-asset="poolPositionData[0].totalPoolAsset"
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
            :total-pool-asset="item.totalPoolAsset"
            :color="item.color"
          />
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
import { useFundStore } from '@/stores/funds'
import DonutChart from '@/components/positions/DonutChart.vue'
import PoolPositionCard from '@/components/positions/PoolPositionCard.vue'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const fundStore = useFundStore()
const loading = ref(true)
const totalCapital = computed(() => fundStore.totalCapital)

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
// 从 localStorage 恢复各池分配金额（元），优先 poolAmounts，兼容旧 poolPercents
function loadPoolAlloc() {
  const raw = localStorage.getItem('poolAmounts')
  if (raw) {
    const parsed = JSON.parse(raw)
    const vals = Object.values(parsed)
    const sum = vals.reduce((s, v) => s + v, 0)
    // 旧百分比（值≤100且合计≈100）→ 转金额
    if (vals.every(v => v <= 100) && Math.abs(sum - 100) < 1) {
      const amt = {}
      for (const k of Object.keys(parsed)) amt[k] = totalCapital.value * parsed[k] / 100
      return amt
    }
    return parsed
  }
  // 无保存值：平分
  const each = Math.floor(totalCapital.value / 5 / 10000) * 10000
  return { '共有': each, '春': each, '维': each, '队': each, '回': each }
}
const poolAmounts = loadPoolAlloc()

const totalPositionRatio = computed(() => {
  return totalAsset.value > 0 ? (totalMarketValue.value / totalAsset.value) * 100 : 0
})

const positionSlogan = computed(() => {
  const r = totalPositionRatio.value
  if (r >= 90) return { text: '命就一条', emoji: '🆘' }
  if (r >= 80) return { text: '准备装死', emoji: '🐻' }
  if (r >= 70) return { text: '股神出没', emoji: '🦸' }
  if (r >= 60) return { text: '稳健老登', emoji: '👴' }
  if (r >= 50) return { text: '涨跌随缘', emoji: '🧘' }
  if (r >= 40) return { text: '真的不硬', emoji: '🤏' }
  if (r >= 30) return { text: '维族是ED', emoji: '💊' }
  if (r >= 20) return { text: '反弹就干', emoji: '🚀' }
  if (r >= 10) return { text: '一群老GAY', emoji: '🌈' }
  return { text: '纯看热闹', emoji: '🍿' }
})

const poolPositionData = computed(() => {
  return poolStore.pools.map((p, i) => {
    const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === p.id)
    const mv = poolHoldings.reduce((s, h) => {
      const price = priceStore.prices[h.stock_code]?.price || 0
      return s + price * h.quantity
    }, 0)
    const cost = poolHoldings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
    // 该池分配资金 = 保存的金额（元）
    const poolCapital = poolAmounts[p.name] || 0
    // 该池仓位 = 该池持股市值 / 该池分配资金
    const positionRatio = poolCapital > 0 ? (mv / poolCapital) * 100 : 0
    // 子池总资产 = 子池市值 + (子池分配 - 子池成本)
    const totalPoolAsset = mv + Math.max(0, poolCapital - cost)
    return {
      ...p,
      marketValue: mv,
      cost,
      poolCapital,
      positionRatio,
      totalPoolAsset,
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
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
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
.total-ratio-detail {
  text-align: center;
  padding: 0 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.trd-label { font-size: 11px; color: var(--text-muted); }
.trd-value { font-size: 13px; font-weight: 600; font-family: var(--font-number); }
.trd-sep { font-size: 11px; color: var(--text-muted); }

.total-slogan {
  text-align: center;
  padding: 6px 0 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.slogan-emoji {
  font-size: 28px;
  line-height: 1;
  animation: slogan-bounce 2s ease-in-out infinite;
}
.slogan-text {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 4px;
  background: linear-gradient(135deg, var(--color-warn), #ff6b35);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  position: relative;
}
@keyframes slogan-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
