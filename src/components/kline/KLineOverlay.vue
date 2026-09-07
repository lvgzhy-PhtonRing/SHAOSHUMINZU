<!-- src/components/kline/KLineOverlay.vue -->
<template>
  <div class="kline-overlay">
    <div class="kline-header">
      <button class="kline-close" @click="close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="5" x2="19" y2="19"></line>
          <line x1="19" y1="5" x2="5" y2="19"></line>
        </svg>
      </button>
      <div class="kline-title">
        <span class="kline-name">{{ stock.stock_name }}</span>
        <span class="kline-code">{{ stock.stock_code }}</span>
        <span class="kline-cost" v-if="costLabel">持仓成本{{ costLabel }}元</span>
        <span class="kline-price" v-if="priceLabel" :style="{ background: priceBg }">现价{{ priceLabel }}元</span>
      </div>
      <div class="kline-tabs">
        <button
          v-for="p in PERIODS"
          :key="p.key"
          class="kline-tab"
          :class="{ active: period === p.key }"
          @click="switchPeriod(p.key)"
        >{{ p.label }}</button>
      </div>
    </div>
    <div ref="chartRef" class="kline-chart"></div>
    <div v-if="loading" class="kline-mask">
      <div class="kline-mask-inner">K线加载中…</div>
    </div>
    <div v-else-if="error" class="kline-mask">
      <div class="kline-mask-inner">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { init, dispose } from 'klinecharts'
import { fetchKLine, refreshStockPrice } from '@/api/stock'

const PERIODS = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' }
]

const props = defineProps({
  stock: { type: Object, required: true }
})
const emit = defineEmits(['close'])

const STYLES = {
  grid: {
    show: true,
    horizontal: { show: true, size: 1, color: 'rgba(255,255,255,0.06)', style: 'dashed', dashedValue: [2, 2] },
    vertical: { show: true, size: 1, color: 'rgba(255,255,255,0.04)', style: 'dashed', dashedValue: [2, 2] }
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'previous_close',
      upColor: '#ff4d6d',
      downColor: '#00f0a8',
      noChangeColor: '#6f6b8f',
      upBorderColor: '#ff4d6d',
      downBorderColor: '#00f0a8',
      noChangeBorderColor: '#6f6b8f',
      upWickColor: '#ff4d6d',
      downWickColor: '#00f0a8',
      noChangeWickColor: '#6f6b8f'
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#a7a3c8', textSize: 11, textOffset: 5 },
      low: { show: true, color: '#a7a3c8', textSize: 11, textOffset: 5 },
      last: {
        show: true,
        compareRule: 'previous_close',
        upColor: '#ff4d6d',
        downColor: '#00f0a8',
        noChangeColor: '#a7a3c8',
        line: { show: false, size: 1, style: 'dashed', dashedValue: [4, 4] },
        text: {
          show: true,
          style: 'fill',
          color: '#f4f2ff',
          size: 11,
          weight: 'bold',
          borderColor: '#6f4dff',
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3
        },
        extendTexts: []
      }
    },
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      title: { show: true, color: '#a7a3c8', size: 11, marginLeft: 0, marginTop: 0, marginRight: 0, marginBottom: 0 },
      legend: { color: '#a7a3c8', size: 11, marginLeft: 0, marginRight: 8, marginTop: 2, marginBottom: 2 }
    }
  },
  indicator: {
    bars: [{
      upColor: 'rgba(255,77,109,0.7)',
      downColor: 'rgba(0,240,168,0.7)',
      noChangeColor: 'rgba(111,107,143,0.7)'
    }],
    lines: [
      { style: 'solid', size: 1, color: '#ffd23f', smooth: false },
      { style: 'solid', size: 1, color: '#b18cff', smooth: false },
      { style: 'solid', size: 1, color: '#4d9fff', smooth: false },
      { style: 'solid', size: 1, color: '#ff7a45', smooth: false }
    ],
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      title: { show: true, color: '#a7a3c8', size: 11, showName: true, showParams: true, marginLeft: 0, marginTop: 0, marginRight: 0, marginBottom: 0 },
      legend: { color: '#a7a3c8', size: 11, marginLeft: 0, marginRight: 8, marginTop: 2, marginBottom: 2 }
    }
  },
  xAxis: {
    show: true,
    size: 22,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#a7a3c8', size: 11, marginStart: 6, marginEnd: 6 }
  },
  yAxis: {
    show: true,
    size: 50,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#a7a3c8', size: 11, marginStart: 6, marginEnd: 6 }
  },
  separator: {
    size: 1,
    color: 'rgba(255,255,255,0.08)',
    fill: true
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, size: 1, color: 'rgba(177,140,255,0.45)', style: 'dashed', dashedValue: [4, 4] },
      text: {
        show: true,
        style: 'fill',
        color: '#1e1b3a',
        size: 11,
        weight: 'bold',
        backgroundColor: '#b18cff',
        borderColor: '#b18cff',
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3
      }
    },
    vertical: {
      show: true,
      line: { show: true, size: 1, color: 'rgba(177,140,255,0.45)', style: 'dashed', dashedValue: [4, 4] },
      text: {
        show: true,
        style: 'fill',
        color: '#1e1b3a',
        size: 11,
        weight: 'bold',
        backgroundColor: '#b18cff',
        borderColor: '#b18cff',
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3
      }
    }
  }
}

const chartRef = ref(null)
const period = ref('day')
const loading = ref(false)
const error = ref('')
let chart = null
let priceTimer = null

const costLabel = computed(() => {
  const c = Number(props.stock.cost_price)
  return c > 0 ? c.toFixed(3) : ''
})

const currentPrice = ref(Number(props.stock.currentPrice) || 0)
const changePct = ref(Number(props.stock.changePct) || 0)
const priceLabel = computed(() => currentPrice.value > 0 ? currentPrice.value.toFixed(2) : '')
const priceBg = computed(() => {
  if (changePct.value > 0) return 'var(--color-rise)'
  if (changePct.value < 0) return 'var(--color-fall)'
  return 'rgba(167, 163, 200, 0.28)'
})

// 定时实时刷新现价（绕过行情缓存）
async function refreshPrice() {
  const d = await refreshStockPrice(props.stock.stock_code)
  if (d && d.price) {
    currentPrice.value = d.price
    changePct.value = Number(d.change_pct) || 0
  }
}

function close() {
  emit('close')
}

function switchPeriod(p) {
  if (p === period.value || !chart) return
  period.value = p
  chart.setPeriod({ span: 1, type: p })
  chart.scrollToRealTime()
}

function resizeChart() {
  if (chart) chart.resize()
}

function enterFullscreen() {
  return new Promise(resolve => {
    const el = document.documentElement
    if (!el.requestFullscreen) return resolve()
    el.requestFullscreen()
      .then(() => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {})
        }
        resolve()
      })
      .catch(() => resolve())
  })
}

function exitFullscreen() {
  return new Promise(resolve => {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock().catch(() => {})
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().then(resolve).catch(resolve)
    } else {
      resolve()
    }
  })
}

function initChart() {
  if (!chartRef.value) return
  const cost = Number(props.stock.cost_price) || 0
  chart = init(chartRef.value, { locale: 'zh-CN', styles: STYLES })
  chart.setSymbol({ ticker: props.stock.stock_code, pricePrecision: 3, volumePrecision: 0 })
  chart.setPeriod({ span: 1, type: period.value })
  chart.setDataLoader({
    getBars: async ({ type, symbol, period: kdPeriod, callback }) => {
      if (type !== 'init') {
        callback([])
        return
      }
      loading.value = true
      error.value = ''
      try {
        const data = await fetchKLine(symbol.ticker, kdPeriod.type)
        if (!data.length) {
          error.value = '暂无K线数据'
          callback([])
          return
        }
        callback(data, false)
        chart.scrollToRealTime()
      } catch (e) {
        error.value = 'K线加载失败'
        callback([])
      } finally {
        loading.value = false
      }
    }
  })
  chart.createIndicator({ name: 'MA', paneId: 'candle_pane' }, true)
  chart.createIndicator('VOL')
  if (cost > 0) createCostLine(cost)
  chart.setOffsetRightDistance(60)
}

function createCostLine(cost) {
  chart.createOverlay({
    name: 'simpleTag',
    paneId: 'candle_pane',
    points: [{ dataIndex: 0, value: cost }],
    styles: {
      line: { style: 'dashed', size: 1, color: '#f4f2ff', dashedValue: [8, 4] },
      text: {
        style: 'fill',
        color: '#12102a',
        size: 11,
        weight: 'bold',
        borderRadius: 4,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#f4f2ff'
      }
    }
  })
}

onMounted(() => {
  enterFullscreen()
  nextTick(() => {
    initChart()
    resizeChart()
  })
  refreshPrice()
  priceTimer = setInterval(refreshPrice, 30 * 1000)
  window.addEventListener('resize', resizeChart)
  window.addEventListener('orientationchange', resizeChart)
})

onBeforeUnmount(() => {
  if (priceTimer) {
    clearInterval(priceTimer)
    priceTimer = null
  }
  window.removeEventListener('resize', resizeChart)
  window.removeEventListener('orientationchange', resizeChart)
  if (chart) {
    dispose(chartRef.value)
    chart = null
  }
  exitFullscreen()
})
</script>

<style scoped>
.kline-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: #12102a;
  display: flex;
  flex-direction: column;
}

.kline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(30, 27, 58, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.kline-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.kline-close:active {
  background: rgba(255, 255, 255, 0.16);
}

.kline-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.kline-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.kline-code {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-number);
}

.kline-cost {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-number);
  padding: 4px 10px;
  background: linear-gradient(135deg, #6f4dff, #9d7bff);
  border: none;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.kline-price {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-number);
  padding: 4px 10px;
  border: none;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.kline-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px;
  border-radius: 8px;
  flex-shrink: 0;
}

.kline-tab {
  padding: 5px 14px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.kline-tab.active {
  background: var(--bg-accent);
  color: #fff;
}

.kline-chart {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.kline-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 16, 42, 0.85);
  z-index: 2;
}

.kline-mask-inner {
  color: var(--text-secondary);
  font-size: 14px;
  padding: 12px 22px;
  background: var(--bg-solid);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
</style>
