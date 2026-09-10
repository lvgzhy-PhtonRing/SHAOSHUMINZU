<!-- src/components/fund/NavOverview.vue -->
<template>
  <div class="nav-overview">
    <div class="ov-meta">
      <span class="ov-meta-title">
        <span class="ov-dot" :style="{ background: MINE.color }"></span>
        <span class="ov-meta-name">
          <span class="ov-meta-code">{{ MINE.code }}</span>
          <span class="ov-meta-short">{{ MINE.shortName }}</span>
        </span>
        <span class="ov-meta-label">单位净值（元）</span>
      </span>
      <span class="ov-date num-mono">{{ navDate }}</span>
    </div>

    <div class="ov-headline">
      <span class="ov-nav num-mono">{{ navText }}</span>
      <span v-if="dailyChange !== null" class="ov-change num-mono"
        :class="dailyChange >= 0 ? 'text-rise' : 'text-fall'">
        {{ pct(dailyChange) }}
      </span>
    </div>

    <div class="ov-info">
      <div class="ov-info-item">
        <div class="ov-info-label">成立日期</div>
        <div class="ov-info-value ov-info-value--date">{{ inceptionText }}</div>
      </div>
      <div class="ov-info-item">
        <div class="ov-info-label">最HARD基金经理</div>
        <div class="ov-info-tags">
          <span v-if="topHard" class="pool-tag"
            :style="{ background: topHard.color + '22', color: topHard.color }">
            {{ topHard.name }}
          </span>
          <span v-else class="ov-info-value">—</span>
        </div>
      </div>
      <div class="ov-info-item">
        <div class="ov-info-label">规模（元）</div>
        <div class="ov-info-value num-mono">{{ scaleText }}</div>
      </div>
    </div>

    <div class="ov-periods">
      <div class="ov-period" v-for="p in periodReturns" :key="p.label">
        <div class="ov-period-label">{{ p.label }}</div>
        <div class="ov-period-value num-mono"
          :class="p.value === null ? 'ov-na' : (p.value >= 0 ? 'text-rise' : 'text-fall')">
          {{ pct(p.value) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatMoney } from '@/utils/formatters'
import { fetchPositionSnapshots } from '@/api/supabase'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { useHardRanking } from '@/composables/useHardRanking'
import { MINE, MINE_BASE_DATE, MINE_BASE_ASSET } from '@/utils/portfolioNav'

const PERIODS = [
  { label: '近1月', months: 1 },
  { label: '近3月', months: 3 },
  { label: '近6月', months: 6 },
  { label: '近1年', months: 12 }
]

const snapshots = ref([])
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const { topHard, loadRankingData } = useHardRanking()

// 快照按日期升序（fetchPositionSnapshots 已排序）
const latest = computed(() =>
  snapshots.value.length ? snapshots.value[snapshots.value.length - 1] : null)

// 当前总资产 = 持仓市值 + 可用资金；行情未加载时回退最新快照
const currentAsset = computed(() => {
  const mv = holdingStore.holdings.reduce((s, h) => {
    return s + (priceStore.prices[h.stock_code]?.price || 0) * h.quantity
  }, 0)
  if (mv > 0) return mv + fundStore.totalAvailable
  return latest.value ? latest.value.asset : 0
})

const navDate = computed(() => (latest.value ? latest.value.date : '—'))

// 单位净值 = 当前总资产 / 7-29 转户市值，与净值比较的 100% 基准同口径
const navText = computed(() => (currentAsset.value > 0
  ? (currentAsset.value / MINE_BASE_ASSET).toFixed(4)
  : '—'))

const inceptionText = computed(() =>
  `${MINE_BASE_DATE.slice(0, 4)}年${Number(MINE_BASE_DATE.slice(5, 7))}月${Number(MINE_BASE_DATE.slice(8, 10))}日`)

const scaleText = formatMoney(MINE_BASE_ASSET)

// 当日涨跌 = Σ(现价-昨收)×股数 / 总资产。
// stock_cache 没有昨收价，按涨跌幅反推：昨收 = 现价 / (1 + 涨跌幅%)
const dailyChange = computed(() => {
  const asset = currentAsset.value
  if (!asset) return null
  let pnl = 0
  let hasPrice = false
  for (const h of holdingStore.holdings) {
    const p = priceStore.prices[h.stock_code]
    if (!p || !p.price) continue
    hasPrice = true
    const prev = p.prev_close > 0 ? p.prev_close : p.price / (1 + (p.change_pct || 0) / 100)
    pnl += (p.price - prev) * h.quantity
  }
  // 行情未加载时不要显示 0.00% 的误导值
  if (!hasPrice) return null
  return (pnl / asset) * 100
})

function toStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function shiftMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() - months)
  return toStr(d)
}

// 取 ≤ 目标日的最后一个快照资产
function assetOnOrBefore(dateStr) {
  let res = null
  for (const s of snapshots.value) {
    if (s.date <= dateStr) res = s
  }
  return res ? res.asset : null
}

const periodReturns = computed(() => {
  const last = latest.value
  const asset = currentAsset.value || (last ? last.asset : 0)
  return PERIODS.map(it => {
    if (!last || !asset) return { ...it, value: null }
    const target = shiftMonths(last.date, it.months)
    // 窗口起点早于 7-29 成立日 → 无快照可比，留空
    if (target < MINE_BASE_DATE) return { ...it, value: null }
    const past = assetOnOrBefore(target)
    return { ...it, value: past ? (asset / past - 1) * 100 : null }
  })
})

function pct(v) {
  return v === null || v === undefined ? '—' : `${Number(v).toFixed(2)}%`
}

onMounted(async () => {
  try {
    await loadRankingData()
    snapshots.value = await fetchPositionSnapshots(500)
  } catch (e) {
    console.warn('NavOverview load error:', e)
  }
})
</script>

<style scoped>
.nav-overview { padding: 0 0 4px; }

/* 第一行：红点 + 组合身份 + 单位净值（元），右侧净值日期 */
.ov-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.ov-meta-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ov-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ov-meta-name {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
/* 编号细体、组合名粗体：与净值比较图里的 编号/名称 两级层次一致 */
.ov-meta-code {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}
.ov-meta-short {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.ov-meta-label {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}
.ov-date {
  font-size: 10px;
  opacity: .8;
  white-space: nowrap;
}

/* 主数字行：净值 + 当日涨跌 */
.ov-headline {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.ov-nav {
  font-size: 34px;
  font-weight: 700;
  font-family: var(--font-number);
  letter-spacing: -1px;
  line-height: 1.1;
  background: linear-gradient(120deg, #ffffff, #c9b8ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.ov-change {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: var(--radius-round);
  background: rgba(255, 255, 255, .06);
  white-space: nowrap;
}

/* 成立日期 / 基金经理 / 规模：三等分，避免文字挤出一行 */
.ov-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.ov-info-item {
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: 6px;
  min-width: 0;
}
.ov-info-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
.ov-info-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 成立日期字符串最长，降字号和字重，避免它压过另两项 */
.ov-info-value--date {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: -0.2px;
}

/* 基金经理：排行榜第一名的色块，沿用持仓页 pool-tag 款式 */
.ov-info-tags {
  display: flex;
  align-items: center;
}
.pool-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

/* 区间收益 */
.ov-periods {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
}
.ov-period {
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: 7px 4px;
  text-align: center;
}
.ov-period-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 3px;
}
.ov-period-value {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-number);
}
.ov-na { color: var(--text-muted); font-weight: 400; }
</style>
