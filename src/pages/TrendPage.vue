<template>
  <div class="page trend-page">
    <div class="page-header">
      <span class="page-title">趋势看板<span class="title-en">Trend Dashboard</span></span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <template v-else>
      <!-- 模块1：本月亏多少（年视图 · 月盈亏） -->
      <div class="section-card edge-accent">
        <div class="section-title">
          <span class="title-accent title-accent--trend"></span>
          本月亏多少
          <span class="cal-month-title cal-month-title--inline">2026年</span>
        </div>
        <div class="year-grid">
          <div v-for="m in monthPnls" :key="m.month" class="year-cell">
            <div class="year-cell-month">{{ m.month }}月</div>
            <div v-if="m.pnl !== null" class="year-cell-pnl-wrap">
              <div class="year-cell-pnl" :class="pnlClass(m.pnl)">{{ pnlText(m.pnl) }}</div>
            </div>
            <div v-else class="year-cell-pnl year-cell-pnl--empty"></div>
          </div>
        </div>
      </div>

      <!-- 模块2：本周亏多少（周盈亏卡片视图） -->
      <div class="section-card edge-accent">
        <div class="section-title">
          <span class="title-accent title-accent--trend"></span>
          本周亏多少
          <span class="swipe-hint-overlay">{{ currentHint }}</span>
          <span class="cal-month-title cal-month-title--inline">{{ currentMonthLabel }}</span>
        </div>

        <van-swipe class="month-swipe" :loop="false" :show-indicators="false" :height="swipeHeight" :initial-swipe="1" @change="onSwipeChange">
          <van-swipe-item v-for="panel in monthPanels" :key="panel.year + '-' + panel.month" class="cal-panel">
            <div v-for="(week, wi) in panel.weeks" :key="wi" class="week-block">
              <div class="week-block-dates">
                <span v-for="(d, di) in week.days" :key="di" class="week-date" :class="{ 'week-date--muted': !d.inMonth }">
                  {{ d.day }}
                </span>
              </div>
              <div class="week-block-pnl-wrap">
                <div class="week-block-pnl" :class="pnlClass(week.pnl)">{{ pnlText(week.pnl) }}</div>
              </div>
            </div>
          </van-swipe-item>
        </van-swipe>
      </div>

      <!-- 模块3：趋势总览（仓位+资产合并，日期强制对齐） -->
      <div class="section-card edge-accent">
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
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { fetchPositionSnapshots } from '@/api/supabase'
import { saveCurrentPositionSnapshot } from '@/utils/positionSnapshot'
import { formatMoney } from '@/utils/formatters'

const loading = ref(true)
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()

// ===== 快照索引 =====
const snapByDate = ref({})
const sortedDates = ref([])

// 二分查找：<= dateStr 的最后一个快照 index，不存在返回 -1
function lastIdxAtOrBefore(dateStr) {
  const arr = sortedDates.value
  let lo = 0, hi = arr.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= dateStr) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return ans
}
function assetAtOrBefore(dateStr) {
  const idx = lastIdxAtOrBefore(dateStr)
  if (idx === -1) return null
  return snapByDate.value[sortedDates.value[idx]].asset
}
function snapDateAtOrBefore(dateStr) {
  const idx = lastIdxAtOrBefore(dateStr)
  return idx === -1 ? '' : sortedDates.value[idx]
}
function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}
function dateStrAddDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

// ===== 模块1：日历月视图（周盈亏） =====
const monthPanels = ref([])
const currentMonthLabel = ref('')
const currentHint = ref('右滑查看上月 →')
const swipeHeight = computed(() => {
  const rows = Math.max(...monthPanels.value.map(p => p.weeks.length), 6)
  return rows * 66
})

function onSwipeChange(idx) {
  if (monthPanels.value[idx]) {
    currentMonthLabel.value = (monthPanels.value[idx].month + 1) + '月'
    currentHint.value = idx === 0 ? '← 左滑查看本月' : '右滑查看上月 →'
  }
}

// 区间 (startDate, endDate] 内外部本金净变动（增资 add 为正、减资 remove 为负；剔除"初始"与校对核缺 adjust）
function externalNetIn(startDate, endDate) {
  if (!startDate || !endDate) return 0
  return fundStore.capitalLogs
    .filter(l => l.pool_id === null && l.category !== 'adjust' && l.note !== '初始' && l.created_at)
    .filter(l => {
      const d = l.created_at.slice(0, 10)
      return d > startDate && d <= endDate
    })
    .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
}

function buildMonthPanel(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDate = new Date(year, month, 1)
  const lastDate = new Date(year, month, daysInMonth)
  // 1号所在周的周一（可能在上月）
  const firstMonday = new Date(firstDate)
  firstMonday.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7))
  const weeks = []
  let cursor = new Date(firstMonday)
  while (cursor <= lastDate) {
    // 保存本周的周一日期，用于后面计算周盈亏
    const weekMonday = new Date(cursor)
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push({
        day: cursor.getDate(),
        inMonth: cursor.getFullYear() === year && cursor.getMonth() === month,
        date: new Date(cursor)
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    // 计算本周周盈亏：周末(周五/最新快照)资产 − 周一资产 − 区间内外部增资
    const weekFriday = new Date(weekMonday)
    weekFriday.setDate(weekFriday.getDate() + 4) // Friday
    const today = new Date()
    const todayStr = toDateStr(today)
    const mondayStr = toDateStr(weekMonday)
    let pnl = null
    if (weekFriday <= today) {
      // 完整周：周一到周五收盘对比
      const curDate = snapDateAtOrBefore(toDateStr(weekFriday))
      const prevDate = snapDateAtOrBefore(mondayStr)
      if (curDate && prevDate) {
        const cur = snapByDate.value[curDate].asset
        const prev = snapByDate.value[prevDate].asset
        const netIn = externalNetIn(prevDate, curDate)
        pnl = Math.round(cur - prev - netIn)
      }
    } else {
      // 当前周：周一至今实时盈亏
      const curDate = snapDateAtOrBefore(todayStr)
      const prevDate = snapDateAtOrBefore(mondayStr)
      if (curDate && prevDate) {
        const cur = snapByDate.value[curDate].asset
        const prev = snapByDate.value[prevDate].asset
        const netIn = externalNetIn(prevDate, curDate)
        pnl = Math.round(cur - prev - netIn)
      }
    }
    weeks.push({
      days,
      pnl
    })
    // cursor 目前已移动到周六(或月末)，下次 while 循环将从下一周开始
  }
  return { year, month, weeks }
}

// 保留 weekRefDate 作为兼容接口（实际不再直接使用，但保留以免报错）
function weekRefDate(days) {
  const friday = days[4].date
  const today = new Date()
  if (friday > today) return toDateStr(today)
  return toDateStr(friday)
}

// 面板顺序 [上月, 本月]：initial-swipe=1 默认显示本月，右滑切到上月
function buildMonthPanels() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const panels = [buildMonthPanel(prev.getFullYear(), prev.getMonth())]
  panels.push(buildMonthPanel(now.getFullYear(), now.getMonth()))
  monthPanels.value = panels
  currentMonthLabel.value = (now.getMonth() + 1) + '月'
}

// ===== 模块2：年视图（月盈亏） =====
const monthPnls = ref([])

function lastSnapshotIdxInMonth(year, month) {
  const monthEnd = toDateStr(new Date(year, month + 1, 0))
  const idx = lastIdxAtOrBefore(monthEnd)
  if (idx === -1) return -1
  const prefix = year + '-' + String(month + 1).padStart(2, '0')
  return sortedDates.value[idx].startsWith(prefix) ? idx : -1
}

// 截至 endDate 的累计外部净投入（含初始，pool_id=null，口径同 totalCapital）
function externalInvestedAt(endDate) {
  return fundStore.capitalLogs
    .filter(l => l.pool_id === null && l.category !== 'adjust' && l.created_at)
    .filter(l => l.created_at.slice(0, 10) <= endDate)
    .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
}

function buildYearPnls() {
  const year = new Date().getFullYear()
  const list = []
  const todayStr = toDateStr(new Date())
  let prevDate = ''
  let prevAsset = null
  for (let m = 0; m < 12; m++) {
    // 该月结算点：非当前月取该月末快照；当前月取最新快照（尚无月末快照）
    let curDate
    if (m === new Date().getMonth()) {
      curDate = snapDateAtOrBefore(todayStr)
    } else {
      const idx = lastSnapshotIdxInMonth(year, m)
      curDate = idx === -1 ? '' : sortedDates.value[idx]
    }
    if (!curDate) {
      list.push({ month: m + 1, pnl: null })
      continue
    }
    const curAsset = snapByDate.value[curDate].asset
    if (!prevDate) {
      // 首个有数据的月份：以截至该月结算日的累计外部净投入为期初基准
      // 使跨月累加首末相消 → 精确等于"现资产 − 累计投入" = 资本页累计
      const invested = externalInvestedAt(curDate)
      if (invested !== 0) {
        list.push({ month: m + 1, pnl: Math.round(curAsset - invested) })
      } else {
        list.push({ month: m + 1, pnl: null })
      }
      prevDate = curDate
      prevAsset = curAsset
      continue
    }
    const netIn = externalNetIn(prevDate, curDate)
    list.push({ month: m + 1, pnl: Math.round(curAsset - prevAsset - netIn) })
    prevDate = curDate
    prevAsset = curAsset
  }
  monthPnls.value = list
}

// ===== 盈亏显示 =====
function pnlText(v) {
  if (v === null || v === undefined) return ''
  const abs = Math.abs(v).toLocaleString('zh-CN')
  if (v > 0) return '+' + abs
  if (v < 0) return '-' + abs
  return '0'
}
function pnlClass(v) {
  if (v === null || v === undefined) return 'pnl-empty'
  if (v > 0) return 'pnl-rise'
  if (v < 0) return 'pnl-fall'
  return 'pnl-zero'
}

// ===== 模块3：趋势总览 =====
const trendData = ref([])

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

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}
function formatTrendLabel(d) {
  return '周' + WEEKDAY[d.getDay()] + ' ' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0')
}

// 资金变动明细（趋势总览底部文字列表，对应每行"!"）
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

onMounted(async () => {
  try {
    await Promise.all([
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
    await saveCurrentPositionSnapshot()

    const snaps = await fetchPositionSnapshots(500)
    const map = {}
    for (const s of snaps) map[s.date] = s
    snapByDate.value = map
    sortedDates.value = Object.keys(map).sort()

    buildMonthPanels()
    buildYearPnls()

    // 趋势总览（近15交易日，缺失顺延补数）
    const dates = sortedDates.value
    if (dates.length) {
      const end = new Date(dates[dates.length - 1] + 'T00:00:00')
      const start = new Date(end)
      start.setDate(start.getDate() - 30)

      const filled = []
      let lastData = null
      const cursor = new Date(start)
      while (cursor <= end) {
        const dateStr = toDateStr(cursor)
        if (!isWeekend(dateStr)) {
          const snap = snapByDate.value[dateStr]
          if (snap) {
            lastData = { ratio: snap.ratio, asset: snap.asset || 0, capitalChange: snap.capitalChange || 0 }
            filled.push({ label: formatTrendLabel(cursor), date: dateStr, ...lastData })
          } else if (lastData) {
            filled.push({ label: formatTrendLabel(cursor), date: dateStr, ...lastData, capitalChange: 0 })
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      trendData.value = filled.slice(-15)
    }
  } catch (e) {
    console.error('Trend page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.section-title { padding: 0 0 10px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; position: relative; }
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
.title-accent--trend { background: var(--bg-accent); }

/* ===== 周盈亏/月盈亏涨跌色 ===== */
.pnl-rise { color: var(--color-rise); }
.pnl-fall { color: var(--color-fall); }
.pnl-zero { color: var(--text-muted); }
.pnl-empty { color: var(--text-muted); }

/* ===== 模块1：日历月视图 ===== */
.month-swipe { margin: 0 -2px; }
.cal-panel { padding: 0 2px; }
.cal-month-title {
  text-align: center;
  font-size: 12px; font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.cal-month-title--inline {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px; font-weight: 700;
  color: var(--text-secondary);
}
.week-block {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
.week-block:last-child { margin-bottom: 0; }
.week-block-dates {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}
.week-date {
  font-size: 11px;
  color: var(--text-primary);
  font-family: var(--font-number);
}
.week-date--muted { color: var(--text-muted); }
.week-block-pnl-wrap {
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  padding: 4px 0;
}
.week-block-pnl {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-number);
}
.swipe-hint-overlay {
  margin-left: auto;
  font-size: 11px;
  background: linear-gradient(135deg, var(--color-rise), #ff8a9a);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

/* ===== 模块2：年视图 ===== */
.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.year-cell {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 4px;
  text-align: center;
}
.year-cell-month {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.year-cell-pnl-wrap {
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  padding: 6px 0;
}
.year-cell-pnl {
  font-size: 12px; font-weight: 700;
  font-family: var(--font-number);
}
.year-cell-pnl--empty { height: 16px; }

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
</style>
