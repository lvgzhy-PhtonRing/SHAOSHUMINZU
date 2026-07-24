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
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchPositionSnapshots } from '@/api/supabase'

const loading = ref(true)
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const trendData = ref([])

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

// ===== 加载 =====
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

onMounted(async () => {
  try {
    // 多取一些，过滤周末，取最后10个交易日
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
</style>
