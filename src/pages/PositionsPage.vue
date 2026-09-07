<template>
  <div class="page positions-page">
    <div class="page-header">
      <span class="page-title">仓位分析<span class="title-en">Position Analysis</span></span>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 总仓位模块 -->
      <div class="section-card edge-accent clickable-section" @click="openTotalDetail">
        <div class="section-title">
          <span class="title-accent title-accent--accent"></span>总体仓位
          <span class="title-hint">详情 ›</span>
        </div>
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
      <div class="section-card edge-warn">
        <div class="section-title"><span class="title-accent title-accent--warn"></span>子池仓位</div>
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
            @click="openPoolDetail(poolPositionData[0])"
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
            @click="openPoolDetail(item)"
          />
        </div>
      </div>

      <!-- 详情弹窗 -->
      <van-popup
        v-model:show="detailShow"
        position="center"
        round
        :style="{ width: '86%', maxWidth: '360px' }"
        :close-on-click-overlay="true"
      >
        <div class="detail-panel">
          <div class="dp-header">
            <span class="dp-dot" :style="{ background: detail.color }"></span>
            <span class="dp-title">{{ detail.title }}</span>
            <span class="dp-percent num-mono">{{ detail.percent.toFixed(1) }}%</span>
          </div>
          <div class="dp-divider"></div>
          <div v-if="detail.items.length === 0" class="dp-empty">暂无持仓</div>
          <div v-else class="dp-list">
            <div v-for="(it, i) in detail.items" :key="i" class="dp-item">
              <span class="dp-label">{{ it.name }}</span>
              <span class="dp-value num-mono">{{ it.percent.toFixed(1) }}%</span>
            </div>
          </div>
          <div class="dp-footer">
            分母：{{ detail.denominator }} {{ formatMoney(detail.denominatorValue) }}
          </div>
        </div>
      </van-popup>

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
import { loadPoolAllocation } from '@/api/supabase'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const fundStore = useFundStore()
const loading = ref(true)
const allocConfig = ref(null)
const totalCapital = computed(() => fundStore.totalCapital)

const colorList = ['#4d9fff', '#ff4d6d', '#00f0a8', '#ffd23f', '#b18cff']

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
// 可用资金 = 实际现金流（总入金 + 卖出到账 − 买入支出，含已实现盈亏）
const totalAvailable = computed(() => fundStore.totalAvailable)
// 总资产 = 总市值 + 总可用资金（真实资产 = 持仓价值 + 现金）
const totalAsset = computed(() => totalMarketValue.value + totalAvailable.value)
// 四个子池初始分配：从 allocConfig 读取（未配置时不写死 11w，避免公共池计算错误）
// 若未配置，public pool 由 totalCapital - 0 = totalCapital 表示，避免错误写入 44w 固定值

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
  // 每个子池的初始分配：四人从配置读取（缺省 11 万），公共池 = 总资本 − 四人合计（不读配置）
  const poolInitial = {}
  const fourAlloc = {}
  for (const p of poolStore.pools) {
    if (p.name !== '公共池') {
      fourAlloc[p.id] = allocConfig.value?.[p.name] ?? 0
    }
  }
  const fourSum = Object.values(fourAlloc).reduce((s, v) => s + v, 0)
  for (const p of poolStore.pools) {
    poolInitial[p.id] = p.name === '公共池'
      ? totalCapital.value - fourSum
      : fourAlloc[p.id]
  }

  // 从 capital_log 实际流水计算每个子池可用资金
  const poolAvailable = {}
  for (const p of poolStore.pools) {
    const pid = p.id
    const adds = fundStore.capitalLogs.filter(l => l.pool_id === pid && l.type === 'add').reduce((s, l) => s + l.amount, 0)
    const removes = fundStore.capitalLogs.filter(l => l.pool_id === pid && l.type === 'remove').reduce((s, l) => s + l.amount, 0)
    poolAvailable[pid] = poolInitial[pid] + adds - removes
  }

  return poolStore.pools.map((p, i) => {
    const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === p.id)
    const mv = poolHoldings.reduce((s, h) => {
      const price = priceStore.prices[h.stock_code]?.price || 0
      return s + price * h.quantity
    }, 0)
    const cost = poolHoldings.reduce((s, h) => s + h.cost_price * h.quantity, 0)

    const avail = poolAvailable[p.id]
    // 子池总资产 = 可用资金 + 持仓市值（与全局公式一致）
    const totalPoolAsset = avail + mv
    // 仓位 = 持股市值 / 子池总资产
    const positionRatio = totalPoolAsset > 0 ? (mv / totalPoolAsset) * 100 : 0

    return {
      ...p, marketValue: mv, cost,
      poolCapital: poolInitial[p.id],
      totalPoolAsset, positionRatio,
      poolAvailable: avail,
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

// ===== 详情弹窗 =====
const detailShow = ref(false)
const detail = ref({
  title: '',
  percent: 0,
  color: '#4d9fff',
  items: [],
  denominator: '',
  denominatorValue: 0
})

function openTotalDetail() {
  detail.value = {
    title: '总体仓位',
    percent: totalPositionRatio.value,
    color: '#4d9fff',
    items: poolShares.value.map(s => ({ name: s.name, percent: s.share })),
    denominator: '总资产',
    denominatorValue: totalAsset.value
  }
  detailShow.value = true
}

function openPoolDetail(pool) {
  const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === pool.id)
  const items = poolHoldings.map(h => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    const mv = price * h.quantity
    const name = priceStore.prices[h.stock_code]?.stock_name || h.stock_name || h.stock_code
    return {
      name,
      percent: pool.totalPoolAsset > 0 ? (mv / pool.totalPoolAsset) * 100 : 0
    }
  }).sort((a, b) => b.percent - a.percent)
  detail.value = {
    title: `${pool.name}仓位`,
    percent: pool.percent,
    color: pool.color,
    items,
    denominator: '子池资产',
    denominatorValue: pool.totalPoolAsset
  }
  detailShow.value = true
}

onMounted(async () => {
  try {
    try { allocConfig.value = await loadPoolAllocation() } catch (e) {}
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
.legend {
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; padding: 0 0 12px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { font-size: 12px; color: var(--text-secondary); }
.legend-value { font-size: 12px; font-weight: 600; font-family: var(--font-number); }
.section-title { display: flex; align-items: center; gap: 6px; padding: 0 0 10px; font-size: 13px; font-weight: 600; }
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.title-hint { font-size: 10px; color: var(--text-muted); font-weight: 400; margin-left: auto; }
.clickable-section { cursor: pointer; transition: background 0.15s; }
.clickable-section:hover { background: var(--bg-hover); }
.pos-gongyou { margin-bottom: 8px; }
.pos-users-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
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

/* 详情弹窗 */
.detail-panel {
  background: var(--bg-solid);
  border-radius: var(--radius-lg);
  padding: 16px;
  color: var(--text-primary);
  min-height: 120px;
}
.dp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
}
.dp-dot {
  width: 10px; height: 10px; border-radius: 50%;
  flex-shrink: 0;
}
.dp-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}
.dp-percent {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.dp-divider {
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin-bottom: 8px;
}
.dp-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px 0;
}
.dp-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.dp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.dp-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.dp-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.dp-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}
</style>
