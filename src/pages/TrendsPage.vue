<template>
  <div class="page trends-page">
    <div class="page-header">
      <span class="page-title">越套越深</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 仓位趋势 -->
      <div class="section-card">
        <div class="section-title">仓位趋势 <span class="subtitle">近10天</span></div>
        <div class="trend-chart">
          <div v-if="!trendData.length" class="trend-empty">暂无数据</div>
          <svg v-else :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="trend-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="ratioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--bg-accent)" stop-opacity="0.25" />
                <stop offset="100%" stop-color="var(--bg-accent)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <!-- 参考线 -->
            <line v-for="pct in ratioRefLines" :key="pct"
              :x1="PAD_L" :x2="SVG_W - PAD_R"
              :y1="ratioY(pct)" :y2="ratioY(pct)"
              stroke="rgba(255,255,255,0.05)" stroke-dasharray="3,3" />
            <!-- 面积 -->
            <path :d="ratioAreaPath" fill="url(#ratioGrad)" />
            <!-- 折线 -->
            <polyline :points="ratioLinePts" fill="none" stroke="var(--bg-accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <!-- 数据点 + 标签 -->
            <g v-for="(d, i) in trendData" :key="i">
              <circle :cx="xPos(i)" :cy="ratioY(d.ratio)" r="3.5" fill="var(--bg-accent)" stroke="var(--bg-card)" stroke-width="1.5" />
              <text :x="xPos(i)" :y="ratioY(d.ratio) - 10" text-anchor="middle" class="trend-pct">{{ d.ratio }}%</text>
              <text :x="xPos(i)" :y="SVG_H - 4" text-anchor="middle" class="trend-day">{{ d.label }}</text>
            </g>
          </svg>
        </div>
      </div>

      <!-- 资产趋势 -->
      <div class="section-card">
        <div class="section-title">资产趋势 <span class="subtitle">近10天</span></div>
        <div class="trend-chart">
          <div v-if="!trendData.length" class="trend-empty">暂无数据</div>
          <svg v-else :viewBox="`0 0 ${SVG_W} ${SVG_H2}`" class="trend-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--color-rise)" stop-opacity="0.2" />
                <stop offset="100%" stop-color="var(--color-rise)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <!-- 参考线 -->
            <line v-for="a in assetRefLines" :key="a"
              :x1="PAD_L" :x2="SVG_W - PAD_R"
              :y1="assetY(a)" :y2="assetY(a)"
              stroke="rgba(255,255,255,0.05)" stroke-dasharray="3,3" />
            <!-- 面积 -->
            <path :d="assetAreaPath" fill="url(#assetGrad)" />
            <!-- 折线 -->
            <polyline :points="assetLinePts" fill="none" stroke="var(--color-rise)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <!-- 资金变动标记（竖线 + 标签） -->
            <g v-for="(d, i) in trendData" :key="'cc'+i">
              <template v-if="d.capitalChange !== 0">
                <line :x1="xPos(i)" :x2="xPos(i)"
                  :y1="PAD_T" :y2="SVG_H2 - PAD_B"
                  :stroke="d.capitalChange > 0 ? 'var(--color-rise)' : 'var(--color-fall)'"
                  stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6" />
                <text :x="xPos(i)" :y="assetY(d.asset) - 14"
                  text-anchor="middle"
                  class="cap-chg-label"
                  :fill="d.capitalChange > 0 ? 'var(--color-rise)' : 'var(--color-fall)'">
                  {{ formatCapitalChange(d.capitalChange) }}
                </text>
              </template>
            </g>
            <!-- 数据点 + 金额标签 -->
            <g v-for="(d, i) in trendData" :key="i">
              <circle :cx="xPos(i)" :cy="assetY(d.asset)" r="3.5" fill="var(--color-rise)" stroke="var(--bg-card)" stroke-width="1.5" />
              <text :x="xPos(i)" :y="assetY(d.asset) - 2"
                text-anchor="end" class="trend-asset"
                :fill="d.capitalChange !== 0 ? (d.capitalChange > 0 ? 'var(--color-rise)' : 'var(--color-fall)') : 'var(--text-secondary)'">
                {{ formatCompactAsset(d.asset) }}
              </text>
              <text :x="xPos(i)" :y="SVG_H2 - 4" text-anchor="middle" class="trend-day">{{ d.label }}</text>
            </g>
          </svg>
        </div>
      </div>

      <!-- 谁最HARD -->
      <div class="section-card hard-card">
        <div class="section-title hard-title">🔥 谁最HARD</div>
        <div class="hard-subtitle">子池资产 / 初始分配</div>

        <LoadingSkeleton v-if="!hardData.length" :count="4" mode="paragraph" />

        <div v-else class="hard-cols">
          <div v-for="(item, idx) in sortedHard" :key="item.name"
            class="hard-col"
            :class="{ 'hard-col--top': idx === 0 }">
            <!-- 排名 -->
            <div class="hard-col-rank" :class="`hard-col-rank--${idx + 1}`">{{ idx + 1 }}</div>
            <!-- 百分比值 -->
            <div class="hard-col-pct" :class="item.ratio >= 100 ? 'pct-up' : 'pct-down'">
              {{ item.ratio.toFixed(1) }}%
            </div>
            <!-- 柱体 -->
            <div class="hard-col-chart">
              <div class="hard-col-bar" :style="{ height: hardBarHeight(item.ratio) + '%', background: item.color }">
              </div>
            </div>
            <!-- 名字 -->
            <div class="hard-col-name" :style="{ color: item.color }">{{ item.name }}</div>
            <!-- 原始资产数 -->
            <div class="hard-col-asset">{{ Math.round(item.totalAsset) }}</div>
            <!-- 冠军皇冠 -->
            <div v-if="idx === 0" class="hard-col-crown">👑</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { fetchPositionSnapshots, loadPoolAllocation } from '@/api/supabase'

const loading = ref(true)
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const trendData = ref([])

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const totalCapital = computed(() => fundStore.totalCapital)

// ===== 子池分配金额（用于"谁最HARD"计算） =====
function loadLocalAlloc() {
  const raw = localStorage.getItem('poolAmounts')
  if (!raw) return null
  let parsed = JSON.parse(raw)
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
  const each = Math.floor((totalCapital.value || 1000000) / 5 / 10000) * 10000
  return { '公共池': each, '春': each, '维': each, '队': each, '回': each }
}
const poolAmounts = reactive(loadLocalAlloc() || defaultAlloc())

// SVG 参数（仓位图）
const SVG_W = 800, SVG_H = 260
const PAD_L = 24, PAD_R = 24, PAD_T = 32, PAD_B = 26
const CHART_W = SVG_W - PAD_L - PAD_R
const CHART_H = SVG_H - PAD_T - PAD_B

// SVG 参数（资产图，更高一些给标签留空间）
const SVG_H2 = 320

// ===== 仓位折线 =====
const ratioMax = computed(() => {
  if (!trendData.value.length) return 100
  const max = Math.max(...trendData.value.map(d => d.ratio))
  return Math.ceil((max + 10) / 10) * 10 || 100
})
const ratioRefLines = computed(() => {
  const m = ratioMax.value
  return [m * 0.25, m * 0.5, m * 0.75].filter(p => p > 0).map(p => Math.round(p))
})

function xPos(i) {
  return PAD_L + (i / Math.max(trendData.value.length - 1, 1)) * CHART_W
}
function ratioY(r) {
  return PAD_T + CHART_H * (1 - r / ratioMax.value)
}
const ratioLinePts = computed(() =>
  trendData.value.map((d, i) => `${xPos(i)},${ratioY(d.ratio)}`).join(' ')
)
const ratioAreaPath = computed(() => {
  if (!trendData.value.length) return ''
  const pts = trendData.value.map((d, i) => `${xPos(i)},${ratioY(d.ratio)}`).join(' L ')
  const lastX = xPos(trendData.value.length - 1)
  const bottomY = SVG_H - PAD_B
  return `M ${xPos(0)},${ratioY(trendData.value[0].ratio)} L ${pts} L ${lastX},${bottomY} L ${xPos(0)},${bottomY} Z`
})

// ===== 资产折线 =====
const CHART_H2 = SVG_H2 - PAD_T - PAD_B

const assetMin = computed(() => {
  if (!trendData.value.length) return 0
  return Math.min(...trendData.value.map(d => d.asset))
})
const assetMax = computed(() => {
  if (!trendData.value.length) return 1000000
  const max = Math.max(...trendData.value.map(d => d.asset))
  // 向上取整到万
  return Math.ceil(max / 10000) * 10000
})

function assetY(v) {
  const range = assetMax.value - assetMin.value || 1
  return PAD_T + CHART_H2 * (1 - (v - assetMin.value) / range)
}

const assetRefLines = computed(() => {
  const min = assetMin.value, max = assetMax.value
  const step = Math.round((max - min) / 3 / 10000) * 10000 || 10000
  return [min + step, min + step * 2].filter(v => v < max)
})

const assetLinePts = computed(() =>
  trendData.value.map((d, i) => `${xPos(i)},${assetY(d.asset)}`).join(' ')
)
const assetAreaPath = computed(() => {
  if (!trendData.value.length) return ''
  const pts = trendData.value.map((d, i) => `${xPos(i)},${assetY(d.asset)}`).join(' L ')
  const lastX = xPos(trendData.value.length - 1)
  const bottomY = SVG_H2 - PAD_B
  return `M ${xPos(0)},${assetY(trendData.value[0].asset)} L ${pts} L ${lastX},${bottomY} L ${xPos(0)},${bottomY} Z`
})

// ===== 格式化 =====
function formatCompactAsset(v) {
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿'
  if (v >= 10000) return (v / 10000).toFixed(2) + '万'
  return v.toLocaleString('zh-CN')
}
function formatCapitalChange(v) {
  const prefix = v > 0 ? '+' : ''
  if (Math.abs(v) >= 10000) return prefix + (v / 10000).toFixed(1) + '万'
  return prefix + v.toLocaleString('zh-CN')
}

// ===== 谁最HARD =====
const POOL_COLORS = { '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }
const POOL_ORDER = ['春', '维', '队', '回']

const hardData = computed(() => {
  return POOL_ORDER.map(name => {
    const pool = poolStore.pools.find(p => p.name === name)
    if (!pool) return null
    const alloc = poolAmounts[name] || 0
    if (alloc <= 0) return null
    const holdings = holdingStore.holdings.filter(h => h.pool_id === pool.id)
    const cost = holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
    const mv = holdings.reduce((s, h) => {
      return s + (priceStore.prices[h.stock_code]?.price || 0) * h.quantity
    }, 0)
    const totalAsset = alloc + (mv - cost)
    const ratio = (totalAsset / alloc) * 100
    return { name, alloc, cost, mv, totalAsset, ratio, color: POOL_COLORS[name] }
  }).filter(Boolean)
})

const sortedHard = computed(() =>
  [...hardData.value].sort((a, b) => b.ratio - a.ratio)
)

const maxRatio = computed(() => {
  const m = Math.max(...hardData.value.map(d => d.ratio), 100)
  return Math.max(m, 100)
})

// 竖向柱的高度缩放（扩大微小差异）
const hardBarScale = computed(() => {
  const vals = sortedHard.value.map(d => d.ratio)
  if (!vals.length) return { base: 100, range: 10 }
  const min = Math.min(...vals, 100)
  const max = Math.max(...vals, 100)
  const pad = Math.max((max - min) * 0.15, 1)
  return { base: min - pad, range: (max - min) + pad * 2 }
})
function hardBarHeight(ratio) {
  const { base, range } = hardBarScale.value
  if (range <= 0) return 50
  return Math.max(((ratio - base) / range) * 100, 2)
}

// ===== 加载 =====
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

onMounted(async () => {
  try {
    // 加载池数据（给"谁最HARD"用）
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])

    // 从 Supabase 同步分配金额（跨设备）
    let server = await loadPoolAllocation()
    if (server) {
      if (server['共有'] !== undefined && server['公共池'] === undefined) {
        server = { ...server }; server['公共池'] = server['共有']; delete server['共有']
      }
      for (const k of Object.keys(server)) {
        if (poolAmounts[k] !== undefined) poolAmounts[k] = server[k]
      }
    }

    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)

    // 多取一些快照，过滤周末，取最后10个交易日
    const snaps = await fetchPositionSnapshots(20)
    const tradingDays = snaps.filter(s => !isWeekend(s.date))
    const last10 = tradingDays.slice(-10)
    trendData.value = last10.map(s => ({
      label: WEEKDAY[new Date(s.date + 'T00:00:00').getDay()],
      ratio: s.ratio,
      asset: s.asset || 0,
      capitalChange: s.capitalChange || 0
    }))
  } catch (e) {
    console.error('Trends page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.section-title { padding: 0 0 10px; font-size: 13px; font-weight: 600; }
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.trend-chart { padding: 4px 0 6px; }
.trend-empty { height: 80px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--text-muted); }
.trend-svg { width: 100%; height: auto; display: block; }
.section-card + .section-card { margin-top: 16px; }
.section-card { padding: 16px 14px 18px; }
.trend-pct { font-size: 10px; fill: var(--text-secondary); font-family: var(--font-number); }
.trend-day { font-size: 10px; fill: var(--text-muted); }
.trend-asset { font-size: 10px; font-family: var(--font-number); }
.cap-chg-label { font-size: 10px; font-weight: 600; font-family: var(--font-number); }

/* ===== 谁最HARD（竖向4柱） ===== */
.hard-card { padding-bottom: 20px; }
.hard-title { font-size: 15px; }
.hard-subtitle { font-size: 11px; color: var(--text-muted); margin: -6px 0 14px; }
.pct-up { color: var(--color-rise); }
.pct-down { color: var(--color-fall); }

.hard-cols {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  align-items: start;
}
.hard-col {
  display: flex; flex-direction: column; align-items: center;
  padding: 14px 6px 12px; border-radius: 12px;
  background: var(--bg-card); position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
}
.hard-col--top {
  background: linear-gradient(180deg, rgba(255,215,0,0.1), rgba(255,193,7,0.03));
  box-shadow: 0 0 0 1px rgba(255,193,7,0.15);
}
/* 排名圆标 */
.hard-col-rank {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; margin-bottom: 4px;
}
.hard-col-rank--1 { background: linear-gradient(135deg, #ffc107, #ff9800); }
.hard-col-rank--2 { background: linear-gradient(135deg, #90a4ae, #78909c); }
.hard-col-rank--3 { background: linear-gradient(135deg, #a1887f, #8d6e63); }
.hard-col-rank--4 { background: linear-gradient(135deg, #b0bec5, #90a4ae); }
/* 百分比值 */
.hard-col-pct {
  font-size: 13px; font-weight: 800; font-family: var(--font-number);
  margin-bottom: 6px; letter-spacing: -0.5px;
}
/* 柱体容器 */
.hard-col-chart {
  width: 100%; height: 130px;
  display: flex; align-items: flex-end; justify-content: center;
  margin-bottom: 6px;
}
.hard-col-bar {
  width: 60%; min-width: 16px; max-width: 44px;
  border-radius: 4px 4px 0 0;
  transition: height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* 名字 */
.hard-col-name {
  font-size: 15px; font-weight: 700; margin-bottom: 2px;
}
/* 资产原始数字 */
.hard-col-asset {
  font-size: 10px; font-family: var(--font-number); color: var(--text-muted);
  line-height: 1.2; word-break: break-all; text-align: center;
}
/* 皇冠 */
.hard-col-crown {
  position: absolute; top: -6px; right: -2px; font-size: 18px;
  animation: crown-bounce 1.5s ease-in-out infinite;
}
@keyframes crown-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>
