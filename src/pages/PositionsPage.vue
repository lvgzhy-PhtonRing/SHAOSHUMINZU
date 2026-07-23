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
        <div class="legend-horizontal">
          <div v-for="item in poolShares" :key="item.name" class="lh-item">
            <span class="lh-dot" :style="{ background: item.color }"></span>
            <span class="lh-label">{{ item.name }}</span>
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
            :capital-alloc="poolPositionData[0].poolCapital"
            :pool-available="poolPositionData[0].poolAvailable"
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
            :capital-alloc="item.poolCapital"
            :pool-available="item.poolAvailable"
            :color="item.color"
          />
        </div>
      </div>

      <!-- 总仓位变化模块 -->
      <div class="section-card">
        <div class="section-title">总仓位变化 <span class="subtitle">近10天</span></div>
        <div class="trend-chart">
          <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="trend-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--bg-accent)" stop-opacity="0.25" />
                <stop offset="100%" stop-color="var(--bg-accent)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <!-- 参考线 -->
            <line v-for="pct in [20, 30]" :key="pct"
              :x1="PAD_L" :x2="SVG_W - PAD_R"
              :y1="yPos(pct)" :y2="yPos(pct)"
              stroke="rgba(255,255,255,0.05)" stroke-dasharray="3,3" />
            <!-- 面积填充 -->
            <path :d="areaPath" fill="url(#trendGrad)" />
            <!-- 折线 -->
            <polyline :points="linePoints" fill="none" stroke="var(--bg-accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <!-- 数据点 + 标签 -->
            <g v-for="(d, i) in trendData" :key="i">
              <circle :cx="xPos(i)" :cy="yPos(d.ratio)" r="3.5" fill="var(--bg-accent)" stroke="var(--bg-card)" stroke-width="1.5" />
              <text :x="xPos(i)" :y="yPos(d.ratio) - 10" text-anchor="middle" class="trend-pct">{{ d.ratio }}%</text>
              <text :x="xPos(i)" :y="SVG_H - 4" text-anchor="middle" class="trend-day">{{ d.label }}</text>
            </g>
          </svg>
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
import { loadPoolAllocation } from '@/api/supabase'
import DonutChart from '@/components/positions/DonutChart.vue'
import PoolPositionCard from '@/components/positions/PoolPositionCard.vue'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const fundStore = useFundStore()
const loading = ref(true)
const totalCapital = computed(() => fundStore.totalCapital)

const colorList = ['#5b8def', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

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
// 从 localStorage/Supabase 恢复各池分配金额（元）
function loadLocalAlloc() {
  const raw = localStorage.getItem('poolAmounts')
  if (!raw) return null
  let parsed = JSON.parse(raw)
  // 迁移旧 '共有' 键 → '公共池'
  if (parsed['共有'] !== undefined && parsed['公共池'] === undefined) {
    parsed = { ...parsed }; parsed['公共池'] = parsed['共有']; delete parsed['共有']
  }
  const vals = Object.values(parsed)
  const sum = vals.reduce((s, v) => s + v, 0)
  if (vals.every(v => v <= 100) && Math.abs(sum - 100) < 1) {
    const amt = {}
    for (const k of Object.keys(parsed)) amt[k] = totalCapital.value * parsed[k] / 100
    return amt
  }
  return parsed
}
function defaultAlloc() {
  const each = Math.floor(totalCapital.value / 5 / 10000) * 10000
  return { '公共池': each, '春': each, '维': each, '队': each, '回': each }
}
const poolAmounts = reactive(loadLocalAlloc() || defaultAlloc())

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
  // 先算四个子池的可用资金
  const subAvailable = {}
  for (const p of poolStore.pools) {
    if (p.name === '公共池') continue
    const alloc = poolAmounts[p.name] || 0
    const pcost = holdingStore.holdings
      .filter(h => h.pool_id === p.id)
      .reduce((s, h) => s + h.cost_price * h.quantity, 0)
    subAvailable[p.name] = alloc - pcost
  }
  const subSum = Object.values(subAvailable).reduce((s, v) => s + v, 0)
  // 公共池可用资金 = 总可用 − 四子池可用之和
  const publicAvailable = totalAvailable.value - subSum

  return poolStore.pools.map((p, i) => {
    const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === p.id)
    const mv = poolHoldings.reduce((s, h) => {
      const price = priceStore.prices[h.stock_code]?.price || 0
      return s + price * h.quantity
    }, 0)
    const cost = poolHoldings.reduce((s, h) => s + h.cost_price * h.quantity, 0)

    let poolCapital = poolAmounts[p.name] || 0
    let poolAvailable = poolCapital - cost

    if (p.name === '公共池') {
      poolAvailable = publicAvailable
      poolCapital = poolAvailable + cost  // 倒推出初始分配
    }

    // 子池资产 = 初始分配 + 持仓盈亏
    const totalPoolAsset = poolCapital + (mv - cost)
    // 仓位 = 持股市值 / 子池资产
    const positionRatio = totalPoolAsset > 0 ? (mv / totalPoolAsset) * 100 : 0
    return {
      ...p, marketValue: mv, cost, poolCapital,
      totalPoolAsset, positionRatio,
      poolAvailable,
      percent: positionRatio,
      color: colorList[i % colorList.length]
    }
  })
})

const donutSize = 200
const chartRadius = donutSize / 2 - 20

// 各子池持股市值占总资产比例（环形分段 = 有色段，灰底 = 现金比例）
const poolShares = computed(() => {
  return poolPositionData.value.map(p => ({
    name: p.name, color: p.color,
    share: totalAsset.value > 0 ? (p.marketValue / totalAsset.value) * 100 : 0
  }))
})

const chartSegments = computed(() => {
  let offset = 0
  const circ = 2 * Math.PI * chartRadius
  return poolShares.value.map(p => {
    const arcLength = (p.share / 100) * circ
    const seg = { color: p.color, arcLength, offset: -offset }
    offset += arcLength
    return seg
  })
})

const trendData = [
  { label: '一', ratio: 24 }, { label: '二', ratio: 28 },
  { label: '三', ratio: 32 }, { label: '四', ratio: 26 },
  { label: '五', ratio: 22 }, { label: '六', ratio: 26 },
  { label: '日', ratio: 25 }, { label: '一', ratio: 29 },
  { label: '二', ratio: 31 }, { label: '三', ratio: 27 },
]

// SVG 折线图参数
const SVG_W = 800, SVG_H = 200
const PAD_L = 20, PAD_R = 20, PAD_T = 28, PAD_B = 22
const CHART_W = SVG_W - PAD_L - PAD_R
const CHART_H = SVG_H - PAD_T - PAD_B

function xPos(i) {
  return PAD_L + (i / (trendData.length - 1)) * CHART_W
}
function yPos(r) {
  return PAD_T + CHART_H * (1 - r / 40)
}
const linePoints = computed(() =>
  trendData.map((d, i) => `${xPos(i)},${yPos(d.ratio)}`).join(' ')
)
const areaPath = computed(() => {
  const pts = trendData.map((d, i) => `${xPos(i)},${yPos(d.ratio)}`).join(' L ')
  const lastX = xPos(trendData.length - 1)
  const bottomY = SVG_H - PAD_B
  return `M ${xPos(0)},${yPos(trendData[0].ratio)} L ${pts} L ${lastX},${bottomY} L ${xPos(0)},${bottomY} Z`
})

onMounted(async () => {
  try {
    // 优先从 Supabase 加载分配金额（跨设备同步）
    let server = await loadPoolAllocation()
    if (server) {
      // 迁移旧 '共有' 键
      if (server['共有'] !== undefined && server['公共池'] === undefined) {
        server = { ...server }; server['公共池'] = server['共有']; delete server['共有']
      }
      for (const k of Object.keys(server)) {
        if (poolAmounts[k] !== undefined) poolAmounts[k] = server[k]
      }
    }

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
.trend-chart { padding: 4px 0 6px; }
.trend-svg { width: 100%; height: auto; display: block; }
.trend-pct { font-size: 10px; fill: var(--text-secondary); font-family: var(--font-number); }
.trend-day { font-size: 10px; fill: var(--text-muted); }
.legend-horizontal {
  display: flex; flex-wrap: wrap; gap: 10px 16px; justify-content: center; padding: 4px 0 0;
}
.lh-item { display: flex; align-items: center; gap: 5px; }
.lh-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.lh-label { font-size: 11px; color: var(--text-secondary); }
.lh-value { font-size: 11px; font-weight: 600; font-family: var(--font-number); }

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
