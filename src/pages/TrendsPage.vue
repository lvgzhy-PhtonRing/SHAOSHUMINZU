<template>
  <div class="page trends-page">
    <div class="page-header">
      <span class="page-title">硬度榜单</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <template v-else>
      <!-- 赚最多（默认前3，可展开全部） -->
      <div class="section-card rank-card rank-card--gain">
        <div class="section-title">
          <span class="title-accent title-accent--rise"></span>
          赚最多
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!gainRankings.length" class="rank-empty">暂无已清仓盈利股票</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in gainVisible" :key="item.stock_code" class="rank-item">
            <span class="rank-badge" :class="idx < 3 ? 'rank-badge--' + (idx + 1) : 'rank-badge--n'">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit rise">{{ formatProfit(item.profit) }}</span>
          </div>
        </div>
        <button v-if="gainRankings.length > 3" class="rank-toggle" @click="gainExpanded = !gainExpanded">
          {{ gainExpanded ? '收起' : `展开全部（${gainRankings.length}）` }}
        </button>
      </div>

      <!-- 亏最多（默认前3，可展开全部） -->
      <div class="section-card rank-card rank-card--loss">
        <div class="section-title">
          <span class="title-accent title-accent--fall"></span>
          亏最多
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!lossRankings.length" class="rank-empty">暂无已清仓亏损股票</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in lossVisible" :key="item.stock_code" class="rank-item">
            <span class="rank-badge" :class="idx < 3 ? 'rank-badge--' + (idx + 1) : 'rank-badge--n'">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit fall">{{ formatProfit(item.profit) }}</span>
          </div>
        </div>
        <button v-if="lossRankings.length > 3" class="rank-toggle" @click="lossExpanded = !lossExpanded">
          {{ lossExpanded ? '收起' : `展开全部（${lossRankings.length}）` }}
        </button>
      </div>

      <!-- 谁最HARD -->
      <div class="section-card hard-card">
        <div class="section-title">
          <span class="title-accent title-accent--hard"></span>
          谁最HARD
          <span class="subtitle">资产 / 初始分配</span>
        </div>

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
            <div v-if="idx === 0" class="hard-col-crown">&#9733;</div>
          </div>
        </div>
      </div>

      <!-- 趋势总览（仓位+资产合并，日期强制对齐） -->
      <div class="section-card">
        <div class="section-title">
          <span class="title-accent title-accent--trend"></span>
          趋势总览
          <span class="subtitle">近15交易日</span>
        </div>
        <div v-if="!trendData.length" class="trend-empty">暂无数据</div>
        <div v-else class="trend-table">
          <!-- 表头 -->
          <div class="trend-header">
            <span class="th-label">日期</span>
            <span class="th-col">仓位比例</span>
            <span class="th-col">总资产</span>
          </div>
          <!-- 数据行 -->
          <div v-for="(d, i) in trendData" :key="i" class="trend-row"
            :class="{ 'trend-row--week-start': i > 0 && d.label.startsWith('周一') }">
            <span class="tr-label">{{ d.label }}</span>
            <!-- 仓位比例列 -->
            <div class="tr-col">
              <div class="bar-track">
                <div class="bar-fill bar-fill--ratio" :style="{ width: ratioBarPct(d.ratio) + '%' }"></div>
              </div>
              <span class="bar-value">{{ d.ratio.toFixed(1) }}%</span>
              <span v-if="i > 0" class="bar-delta" :class="d.ratio >= trendData[i-1].ratio ? 'rise' : 'fall'">
                {{ d.ratio >= trendData[i-1].ratio ? '▲' : '▼' }}
              </span>
              <span v-else class="bar-delta-spacer"></span>
            </div>
            <!-- 总资产列 -->
            <div class="tr-col">
              <div class="bar-track">
                <div class="bar-fill bar-fill--asset" :style="{ width: assetBarPct(d.asset) + '%' }"></div>
              </div>
              <span class="bar-value">{{ formatCompact(d.asset) }}</span>
              <span v-if="i > 0" class="bar-delta" :class="d.asset >= trendData[i-1].asset ? 'rise' : 'fall'">
                {{ d.asset >= trendData[i-1].asset ? '▲' : '▼' }}
              </span>
              <span v-else class="bar-delta-spacer"></span>
              <span v-if="d.capitalChange !== 0" class="capchg-tag"
                :class="d.capitalChange > 0 ? 'rise' : 'fall'">!</span>
              <span v-else class="capchg-slot"></span>
            </div>
          </div>
        </div>

        <!-- 增资减资明细 -->
        <div v-if="capitalDetailList.length" class="capchg-detail">
          <div class="capchg-detail-title">资金变动明细</div>
          <div v-for="(c, i) in capitalDetailList" :key="i" class="capchg-detail-item">
            <span class="cd-date">{{ c.label }}</span>
            <span class="cd-type" :class="c.type === '增资' ? 'rise' : 'fall'">{{ c.type }}</span>
            <span v-if="c.note" class="cd-note">{{ c.note }}</span>
            <span class="cd-amount" :class="c.type === '增资' ? 'rise' : 'fall'">
              {{ c.type === '增资' ? '+' : '-' }}{{ formatMoney(Math.abs(c.amount)) }}
            </span>
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

const gainRankings = computed(() =>
  clearedProfitRankings.value.filter(r => r.profit > 0)
)

const lossRankings = computed(() =>
  [...clearedProfitRankings.value].filter(r => r.profit < 0).sort((a, b) => a.profit - b.profit)
)

// 默认显示前3，展开后显示全部
const gainExpanded = ref(false)
const lossExpanded = ref(false)
const gainVisible = computed(() => gainExpanded.value ? gainRankings.value : gainRankings.value.slice(0, 3))
const lossVisible = computed(() => lossExpanded.value ? lossRankings.value : lossRankings.value.slice(0, 3))

function formatProfit(profit) {
  const abs = Math.abs(Math.round(profit))
  if (profit >= 0) return `+${abs.toLocaleString('zh-CN')}`
  return `-${abs.toLocaleString('zh-CN')}`
}

// ===== 趋势图 =====
const maxRatio = computed(() => {
  if (!trendData.value.length) return 100
  return Math.max(...trendData.value.map(d => d.ratio), 1)
})
const minRatio = computed(() => {
  if (!trendData.value.length) return 0
  return Math.min(...trendData.value.map(d => d.ratio), 100)
})
const maxAsset = computed(() => {
  if (!trendData.value.length) return 1000000
  return Math.max(...trendData.value.map(d => d.asset), 1)
})
const minAsset = computed(() => {
  if (!trendData.value.length) return 0
  return Math.min(...trendData.value.map(d => d.asset))
})

function ratioBarPct(ratio) {
  const range = maxRatio.value - minRatio.value
  if (range < 0.01) return 100
  return ((ratio - minRatio.value) / range) * 100
}
function assetBarPct(asset) {
  const range = maxAsset.value - minAsset.value
  if (range < 0.01) return 100
  return ((asset - minAsset.value) / range) * 100
}

function formatCompact(v) {
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿'
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return Math.round(v).toLocaleString('zh-CN')
}

// ===== 资金变动明细（趋势总览底部文字列表，对应每行"!"） =====
const capitalDetailList = computed(() => {
  if (!trendData.value.length) return []
  const minDate = trendData.value[0].date
  const maxDate = trendData.value[trendData.value.length - 1].date
  return fundStore.capitalLogs
    .filter(l => l.pool_id === null && l.note !== '初始' && l.category !== 'adjust' && l.created_at)
    .filter(l => {
      const d = l.created_at.slice(0, 10)
      return d >= minDate && d <= maxDate
    })
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(l => {
      const dStr = l.created_at.slice(0, 10)
      const d = new Date(dStr + 'T00:00:00')
      return {
        label: formatTrendLabel(d),
        type: l.type === 'add' ? '增资' : '减资',
        note: l.note || '',
        amount: l.amount
      }
    })
})

// ===== 子池硬度 =====
const POOL_COLORS = { '春': '#ff4d6d', '维': '#00f0a8', '队': '#ffd23f', '回': '#b18cff' }
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
function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}
function formatTrendLabel(d) {
  return '周' + WEEKDAY[d.getDay()] + ' ' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0')
}

onMounted(async () => {
  try {
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])

    const allTxs = await fetchAllTransactions()
    transactionStore.transactions = allTxs

    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)

    await saveCurrentPositionSnapshot()

    // 拉取较多快照，用于对缺失的交易日顺延补数据
    const snaps = await fetchPositionSnapshots(60)
    const snapByDate = {}
    for (const s of snaps) snapByDate[s.date] = s

    const dates = Object.keys(snapByDate).sort()
    if (dates.length) {
      const end = new Date(dates[dates.length - 1] + 'T00:00:00')
      const start = new Date(end)
      start.setDate(start.getDate() - 30)  // 30 日历日足够覆盖 15 个交易日

      const filled = []
      let lastData = null
      const cursor = new Date(start)
      while (cursor <= end) {
        const dateStr = toDateStr(cursor)
        if (!isWeekend(dateStr)) {
          const snap = snapByDate[dateStr]
          if (snap) {
            lastData = { ratio: snap.ratio, asset: snap.asset || 0, capitalChange: snap.capitalChange || 0 }
            filled.push({ label: formatTrendLabel(cursor), date: dateStr, ...lastData })
          } else if (lastData) {
            // 交易日无快照 → 用最近一个已知快照顺延补上，资金变动归 0
            filled.push({ label: formatTrendLabel(cursor), date: dateStr, ...lastData, capitalChange: 0 })
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      trendData.value = filled.slice(-15)
    }
  } catch (e) {
    console.error('Trends page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.section-title { padding: 0 0 10px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.section-card + .section-card { margin-top: 16px; }
.section-card { padding: 16px 14px 18px; }

/* 标题左边 accent 色条，替代 emoji */
.title-accent {
  display: inline-block;
  width: 3px; height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}
.title-accent--rise { background: var(--color-rise); }
.title-accent--fall { background: var(--color-fall); }
.title-accent--hard { background: linear-gradient(180deg, #ffd23f, #ff9f45); }
.title-accent--trend { background: var(--bg-accent); }

/* ===== 盈亏排行 ===== */
.rank-card { border-left: 3px solid transparent; }
.rank-card--gain { border-left-color: rgba(233,69,96,0.3); }
.rank-card--loss { border-left-color: rgba(0,210,161,0.3); }
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
  width: 24px;
  font-size: 15px;
  font-weight: 800;
  font-family: var(--font-number);
  text-align: center;
  flex-shrink: 0;
}
.rank-badge--1 { color: var(--color-rise); }
.rank-badge--2 { color: var(--text-secondary); }
.rank-badge--3 { color: var(--text-muted); }
.rank-badge--n { color: var(--text-muted); }
.rank-toggle {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: 1px dashed rgba(255,255,255,0.14);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.rank-toggle:active { background: rgba(255,255,255,0.04); }
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

/* ===== 趋势总览（合并表格，日期强制对齐） ===== */
.trend-table {
  display: flex;
  flex-direction: column;
}
.trend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
}
.th-label {
  width: 72px; flex-shrink: 0;
  font-size: 10px; color: var(--text-muted); text-align: left;
}
.th-col {
  flex: 1;
  font-size: 10px; color: var(--text-muted);
}
.trend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.trend-row--week-start {
  border-top: 1px dashed rgba(255,255,255,0.14);
  margin-top: 4px;
  padding-top: 8px;
}
.tr-label {
  width: 72px; flex-shrink: 0;
  font-size: 11px; font-weight: 600;
  color: var(--text-secondary);
  text-align: left;
  white-space: nowrap;
}
.tr-col {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bar-track {
  flex: 1;
  height: 18px;
  background: rgba(255,255,255,0.04);
  border-radius: 3px;
  overflow: hidden;
  min-width: 20px;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  min-width: 2px;
}
.bar-fill--ratio {
  background: linear-gradient(90deg, var(--bg-accent), rgba(111,77,255,0.35));
}
.bar-fill--asset {
  background: linear-gradient(90deg, var(--color-rise), rgba(233,69,96,0.25));
}
.bar-value {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-number);
  white-space: nowrap;
  flex-shrink: 0;
}
.bar-delta {
  width: 14px;
  font-size: 11px;
  text-align: center;
  flex-shrink: 0;
}
.bar-delta-spacer {
  width: 14px;
  flex-shrink: 0;
}
.bar-delta.rise { color: var(--color-rise); }
.bar-delta.fall { color: var(--color-fall); }

.capchg-tag {
  font-size: 9px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.capchg-tag.rise { color: var(--color-rise); background: rgba(233,69,96,0.1); }
.capchg-tag.fall { color: var(--color-fall); background: rgba(0,210,161,0.1); }
.capchg-slot {
  display: inline-block; width: 0; height: 0;
  flex-shrink: 0;
}

/* 资金变动明细 */
.capchg-detail {
  margin-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px;
}
.capchg-detail-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.capchg-detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
}
.cd-date { width: 72px; flex-shrink: 0; color: var(--text-secondary); font-weight: 600; }
.cd-type { font-weight: 700; flex-shrink: 0; }
.cd-type.rise { color: var(--color-rise); }
.cd-type.fall { color: var(--color-fall); }
.cd-note { flex: 1; min-width: 0; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-amount { font-family: var(--font-number); font-weight: 700; flex-shrink: 0; }
.cd-amount.rise { color: var(--color-rise); }
.cd-amount.fall { color: var(--color-fall); }

.trend-empty {
  height: 80px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* ===== 子池硬度 ===== */
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
.hard-col-rank--1 { background: linear-gradient(135deg, #ffd23f, #ff9f45); }
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
  position: absolute; top: -6px; right: -2px;
  font-size: 16px; color: #ffd23f;
  animation: crown-bounce 1.5s ease-in-out infinite;
}
@keyframes crown-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>
