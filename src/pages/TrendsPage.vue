<template>
  <div class="page trends-page">
    <div class="page-header">
      <span class="page-title">硬度榜单<span class="title-en">Hard Ranking</span></span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <template v-else>
      <!-- 赚最多（默认前3，可展开全部） -->
      <div class="section-card rank-card edge-rise">
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
      <div class="section-card rank-card edge-fall">
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
      <div class="section-card hard-card edge-warn">
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
import { fetchAllTransactions, loadPoolAllocation } from '@/api/supabase'

const loading = ref(true)

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

// ===== 子池硬度 =====
const POOL_COLORS = { '春': '#ff4d6d', '维': '#00f0a8', '队': '#ffd23f', '回': '#b18cff' }
const POOL_ORDER = ['春', '维', '队', '回']
const allocConfig = ref(null)
// 公共池初始分配：从 allocConfig 读取，未配置时不写死 11w

const hardData = computed(() => {
  return POOL_ORDER.map(name => {
    const pool = poolStore.pools.find(p => p.name === name)
    if (!pool) return null
    const adds = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'add').reduce((s, l) => s + l.amount, 0)
    const removes = fundStore.capitalLogs.filter(l => l.pool_id === pool.id && l.type === 'remove').reduce((s, l) => s + l.amount, 0)
    // 从 allocConfig 读取该池的初始分配，未配置时为 0
    const poolAlloc = allocConfig.value?.[pool.name] ?? 0
    const poolAvailable = poolAlloc + adds - removes
    const holdings = holdingStore.holdings.filter(h => h.pool_id === pool.id)
    const mv = holdings.reduce((s, h) => {
      return s + (priceStore.prices[h.stock_code]?.price || 0) * h.quantity
    }, 0)
    const totalAsset = poolAvailable + mv
    const ratio = poolAlloc > 0 ? (totalAsset / poolAlloc) * 100 : 0
    return { name, alloc: poolAlloc, mv, totalAsset, ratio, color: POOL_COLORS[name] }
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
onMounted(async () => {
  try {
    try { allocConfig.value = await loadPoolAllocation() } catch (e) {}
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])

    const allTxs = await fetchAllTransactions()
    transactionStore.transactions = allTxs

    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
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

/* ===== 盈亏排行 ===== */
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
