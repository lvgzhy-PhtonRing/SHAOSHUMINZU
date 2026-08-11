<template>
  <div class="page trends-page">
    <div class="page-header">
      <span class="page-title">榜单</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <template v-else>
      <!-- 已清仓最赚钱TOP3 -->
      <div class="section-card">
        <div class="section-title">
          <span class="rank-icon">🚀</span> 已清仓最赚钱TOP3
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!topGainers.length" class="rank-empty">暂无已清仓盈利股票</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in topGainers" :key="item.stock_code" class="rank-item">
            <span class="rank-badge" :class="'rank-badge--' + (idx + 1)">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit rise">{{ formatProfit(item.profit) }}</span>
          </div>
        </div>
      </div>

      <!-- 已清仓亏最多TOP3 -->
      <div class="section-card">
        <div class="section-title">
          <span class="rank-icon">💩</span> 已清仓亏最多TOP3
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!topLosers.length" class="rank-empty">暂无已清仓亏损股票 🎉</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in topLosers" :key="item.stock_code" class="rank-item">
            <span class="rank-badge" :class="'rank-badge--' + (idx + 1)">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit fall">{{ formatProfit(item.profit) }}</span>
          </div>
        </div>
      </div>

      <!-- 谁最HARD -->
      <div class="section-card hard-card">
        <div class="section-title">🔥 谁最HARD</div>
        <div class="hard-subtitle">子池资产 / 初始分配</div>

        <LoadingSkeleton v-if="!hardData.length" :count="4" mode="paragraph" />

        <div v-else class="hard-cols">
          <div v-for="(item, idx) in sortedHard" :key="item.name"
            class="hard-col"
            :class="{ 'hard-col--top': idx === 0 }">
            <div class="hard-col-rank" :class="`hard-col-rank--${idx + 1}`">{{ idx + 1 }}</div>
            <div class="hard-col-pct" :class="item.ratio >= 100 ? 'pct-up' : 'pct-down'">
              {{ item.ratio.toFixed(1) }}%
            </div>
            <div class="hard-col-chart">
              <div class="hard-col-bar" :style="{ height: hardBarHeight(item.ratio) + '%', background: item.color }">
              </div>
            </div>
            <div class="hard-col-name" :style="{ color: item.color }">{{ item.name }}</div>
            <div class="hard-col-asset">{{ Math.round(item.totalAsset) }}</div>
            <div v-if="idx === 0" class="hard-col-crown">👑</div>
          </div>
        </div>
      </div>

      <!-- 仓位趋势 -->
      <div class="section-card">
        <div class="section-title">📊 仓位趋势 <span class="subtitle">近7交易日</span></div>
        <div v-if="!trendData.length" class="trend-empty">暂无数据</div>
        <div v-else class="bar-chart">
          <div v-for="(d, i) in trendData" :key="'r'+i" class="bar-row">
            <span class="bar-label">{{ d.label }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-fill--ratio" :style="{ width: ratioBarPct(d.ratio) + '%' }"></div>
            </div>
            <span class="bar-value">{{ d.ratio.toFixed(1) }}%</span>
            <span v-if="i > 0" class="bar-delta" :class="d.ratio >= trendData[i-1].ratio ? 'rise' : 'fall'">
              {{ d.ratio >= trendData[i-1].ratio ? '▲' : '▼' }}
            </span>
            <span v-else class="bar-delta-spacer"></span>
          </div>
        </div>
      </div>

      <!-- 资产趋势 -->
      <div class="section-card">
        <div class="section-title">💰 资产趋势 <span class="subtitle">近7交易日</span></div>
        <div v-if="!trendData.length" class="trend-empty">暂无数据</div>
        <div v-else class="bar-chart">
          <div v-for="(d, i) in trendData" :key="'a'+i" class="bar-row">
            <span class="bar-label">{{ d.label }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-fill--asset" :style="{ width: assetBarPct(d.asset) + '%' }"></div>
            </div>
            <span class="bar-value">{{ formatCompact(d.asset) }}</span>
            <span v-if="i > 0" class="bar-delta" :class="d.asset >= trendData[i-1].asset ? 'rise' : 'fall'">
              {{ d.asset >= trendData[i-1].asset ? '▲' : '▼' }}
            </span>
            <span v-else class="bar-delta-spacer"></span>
          </div>
          <!-- 资金变动标记 -->
          <div v-for="(d, i) in trendData" :key="'cc'+i">
            <div v-if="d.capitalChange !== 0" class="capchg-tag"
              :class="d.capitalChange > 0 ? 'rise' : 'fall'">
              {{ d.capitalChange > 0 ? '增资' : '减资' }}{{ formatCompact(Math.abs(d.capitalChange)) }}
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
import { useFundStore } from '@/stores/funds'
import { useTransactionStore } from '@/stores/transactions'
import { fetchPositionSnapshots, fetchAllTransactions } from '@/api/supabase'
import { saveCurrentPositionSnapshot } from '@/utils/positionSnapshot'
import { formatMoney } from '@/utils/formatters'

const loading = ref(true)
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const trendData = ref([])

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const transactionStore = useTransactionStore()
const totalCapital = computed(() => fundStore.totalCapital)

// ===== 盈亏排行（仅已清仓股票） =====
const clearedProfitRankings = computed(() => {
  // 按 stock_code 聚合所有已核实交易
  const byStock = {}
  for (const tx of transactionStore.transactions) {
    if (tx.status !== 'verified') continue
    if (!byStock[tx.stock_code]) {
      byStock[tx.stock_code] = {
        stock_code: tx.stock_code,
        stock_name: tx.stock_name,
        buyQty: 0,
        sellQty: 0,
        buyAmount: 0,
        sellAmount: 0
      }
    }
    const entry = byStock[tx.stock_code]
    if (tx.type === 'buy') {
      entry.buyQty += tx.quantity
      entry.buyAmount += tx.actual_amount || tx.amount
    } else {
      entry.sellQty += tx.quantity
      entry.sellAmount += tx.actual_amount || tx.amount
    }
  }

  // 只保留已清仓（买入量 == 卖出量 > 0）的股票
  return Object.values(byStock)
    .filter(s => s.buyQty > 0 && s.buyQty === s.sellQty)
    .map(s => ({
      stock_code: s.stock_code,
      stock_name: s.stock_name,
      profit: s.sellAmount - s.buyAmount,
      totalQty: s.buyQty
    }))
    .sort((a, b) => b.profit - a.profit)
})

const topGainers = computed(() =>
  clearedProfitRankings.value.filter(r => r.profit > 0).slice(0, 3)
)

const topLosers = computed(() =>
  [...clearedProfitRankings.value].filter(r => r.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 3)
)

function formatProfit(profit) {
  const abs = Math.abs(Math.round(profit))
  if (profit >= 0) return `盈利 +${abs.toLocaleString('zh-CN')}元`
  return `亏损 -${abs.toLocaleString('zh-CN')}元`
}

// ===== 趋势图 CSS 柱状 =====
const maxRatio = computed(() => {
  if (!trendData.value.length) return 100
  return Math.max(...trendData.value.map(d => d.ratio), 1)
})
const maxAsset = computed(() => {
  if (!trendData.value.length) return 1000000
  return Math.max(...trendData.value.map(d => d.asset), 1)
})

function ratioBarPct(ratio) {
  return (ratio / maxRatio.value) * 100
}
function assetBarPct(asset) {
  return (asset / maxAsset.value) * 100
}

function formatCompact(v) {
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿'
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return Math.round(v).toLocaleString('zh-CN')
}

// ===== 谁最HARD =====
const POOL_COLORS = { '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }
const POOL_ORDER = ['春', '维', '队', '回']
const SUB_POOL_INIT = 110000

const hardData = computed(() => {
  return POOL_ORDER.map(name => {
    const pool = poolStore.pools.find(p => p.name === name)
    if (!pool) return null
    const adds = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'add').reduce((s, l) => s + l.amount, 0)
    const removes = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'remove').reduce((s, l) => s + l.amount, 0)
    const poolAvailable = SUB_POOL_INIT + adds - removes
    const holdings = holdingStore.holdings.filter(h => h.pool_id === pool.id)
    const mv = holdings.reduce((s, h) => {
      return s + (priceStore.prices[h.stock_code]?.price || 0) * h.quantity
    }, 0)
    const totalAsset = poolAvailable + mv
    const ratio = (totalAsset / SUB_POOL_INIT) * 100
    return { name, alloc: SUB_POOL_INIT, mv, totalAsset, ratio, color: POOL_COLORS[name] }
  }).filter(Boolean)
})

const sortedHard = computed(() =>
  [...hardData.value].sort((a, b) => b.ratio - a.ratio)
)

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
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])

    // 拉取全部交易记录用于清仓盈亏排行
    const allTxs = await fetchAllTransactions()
    transactionStore.transactions = allTxs

    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)

    await saveCurrentPositionSnapshot()

    const snaps = await fetchPositionSnapshots(15)
    const tradingDays = snaps.filter(s => !isWeekend(s.date))
    const last7 = tradingDays.slice(-7)
    trendData.value = last7.map(s => ({
      label: (() => { const d = new Date(s.date + 'T00:00:00'); return '周' + WEEKDAY[d.getDay()] + ' ' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'); })(),
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
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; margin-left: 6px; }
.section-card + .section-card { margin-top: 16px; }
.section-card { padding: 16px 14px 18px; }

/* ===== 盈亏排行 ===== */
.rank-icon { font-size: 16px; }
.rank-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-card);
  border-radius: 10px;
}
.rank-badge {
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.rank-badge--1 { background: linear-gradient(135deg, #ffc107, #ff9800); }
.rank-badge--2 { background: linear-gradient(135deg, #90a4ae, #78909c); }
.rank-badge--3 { background: linear-gradient(135deg, #a1887f, #8d6e63); }
.rank-stock-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}
.rank-profit {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-number);
  white-space: nowrap;
}
.rank-profit.rise { color: var(--color-rise); }
.rank-profit.fall { color: var(--color-fall); }

/* ===== CSS 柱状趋势图 ===== */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.bar-label {
  width: 72px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}
.bar-track {
  flex: 1;
  height: 20px;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  min-width: 2px;
}
.bar-fill--ratio {
  background: linear-gradient(90deg, var(--bg-accent), rgba(15,52,96,0.5));
}
.bar-fill--asset {
  background: linear-gradient(90deg, var(--color-rise), rgba(233,69,96,0.3));
}
.bar-value {
  width: 56px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-number);
  text-align: right;
  flex-shrink: 0;
}
.bar-delta {
  width: 16px;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}
.bar-delta-spacer {
  width: 16px;
  flex-shrink: 0;
}
.bar-delta.rise { color: var(--color-rise); }
.bar-delta.fall { color: var(--color-fall); }

.capchg-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  margin-top: 2px;
}
.capchg-tag.rise { color: var(--color-rise); }
.capchg-tag.fall { color: var(--color-fall); }

.trend-empty {
  height: 80px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* ===== 谁最HARD（竖向4柱） ===== */
.hard-card { padding-bottom: 20px; }
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
.hard-col-rank {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; margin-bottom: 4px;
}
.hard-col-rank--1 { background: linear-gradient(135deg, #ffc107, #ff9800); }
.hard-col-rank--2 { background: linear-gradient(135deg, #90a4ae, #78909c); }
.hard-col-rank--3 { background: linear-gradient(135deg, #a1887f, #8d6e63); }
.hard-col-rank--4 { background: linear-gradient(135deg, #b0bec5, #90a4ae); }
.hard-col-pct {
  font-size: 13px; font-weight: 800; font-family: var(--font-number);
  margin-bottom: 6px; letter-spacing: -0.5px;
}
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
.hard-col-name {
  font-size: 15px; font-weight: 700; margin-bottom: 2px;
}
.hard-col-asset {
  font-size: 10px; font-family: var(--font-number); color: var(--text-muted);
  line-height: 1.2; word-break: break-all; text-align: center;
}
.hard-col-crown {
  position: absolute; top: -6px; right: -2px; font-size: 18px;
  animation: crown-bounce 1.5s ease-in-out infinite;
}
@keyframes crown-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>
