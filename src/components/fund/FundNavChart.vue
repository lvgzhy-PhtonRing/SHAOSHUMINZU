<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div class="fund-nav" :class="{ 'fund-nav--fs': isFullscreen }">
      <div class="nav-head">
        <span class="title-accent title-accent--accent"></span>
        <span class="nav-title">净值比较</span>
        <span class="nav-subtitle">NAV Compare</span>
        <button v-if="!isFullscreen" class="nav-refresh" :class="{ 'is-spinning': refreshing }" @click="refreshAll" aria-label="刷新净值">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
        <button v-if="!isFullscreen" class="nav-expand" @click="openFullscreen">⛶ 全屏</button>
        <span class="nav-fs-btn" v-if="isFullscreen" @click="closeFullscreen">✕ 退出</span>
      </div>

      <!-- 图表 -->
      <div class="nav-chart" v-if="hasData" ref="chartEl"
        @pointermove="onPointerMove" @pointerdown="onPointerMove"
        @pointerleave="onPointerLeave" @pointercancel="onPointerLeave">
        <svg :viewBox="`0 0 ${G.W} ${G.H}`" class="nav-svg" preserveAspectRatio="xMidYMid meet">
          <!-- 横向网格 + Y轴标签 -->
          <line v-for="t in yTicks" :key="'g' + t.value"
            :x1="G.PAD.left" :x2="G.W - G.PAD.right"
            :y1="t.y" :y2="t.y"
            stroke="rgba(255,255,255,0.06)" />
          <text v-for="t in yTicks" :key="'yl' + t.value"
            :x="G.PAD.left - 5" :y="t.y + 3.5"
            text-anchor="end" :font-size="G.fs"
            fill="#6f6b8f" font-family="var(--font-number)">{{ t.value.toFixed(1) }}%</text>

          <!-- 100% 基准线 -->
          <line :x1="G.PAD.left" :x2="G.W - G.PAD.right"
            :y1="yOf(100)" :y2="yOf(100)"
            stroke="rgba(255,255,255,0.15)" stroke-dasharray="3,3" />

          <!-- 自适应横向刻度虚线（跨度短=每周一格，长=每两周/每月一格） -->
          <line v-for="tk in xTicks" :key="'xt' + tk.key"
            :x1="tk.x" :x2="tk.x"
            :y1="G.PAD.top" :y2="G.PAD.top + G.CH"
            stroke="rgba(255,255,255,0.07)" stroke-dasharray="2,4" />

          <!-- 三根折线 -->
          <path v-for="s in chartSeries" :key="s.key"
            :d="s.path" fill="none"
            :stroke="s.color"
            :stroke-width="G.lw" stroke-linecap="round" stroke-linejoin="round"
            :stroke-dasharray="s.key === 'mine' ? '' : '2,6'" />

          <!-- 各线数据点圆点（起点=同心圆；金枪不倒首尾=实心点、7/29 转户完成日=同心圆；参考基金每个披露点） -->
          <template v-for="dp in allDots" :key="dp.dotKey">
            <circle v-if="dp.start"
              :cx="dp.x" :cy="dp.y" :r="G.rr"
              fill="none" :stroke="dp.color" :stroke-width="G.rs" />
            <circle
              :cx="dp.x" :cy="dp.y" :r="G.dr"
              :fill="dp.color" stroke="#1e1b3a" :stroke-width="G.ds" />
          </template>

          <!-- 末端数值标签（仅全屏） -->
          <text v-if="G.endLabel" v-for="s in seriesMeta" :key="'el' + s.key"
            :x="s.lastX + 8" :y="s.lastY + G.fs * 0.35"
            text-anchor="start" :font-size="G.fs"
            :fill="s.color" font-weight="700"
            font-family="var(--font-number)">{{ s.latestText }}</text>

          <!-- 触摸十字线 + 命中圆点（仅全屏） -->
          <template v-if="hover">
            <line :x1="hover.x" :x2="hover.x"
              :y1="G.PAD.top" :y2="G.PAD.top + G.CH"
              stroke="rgba(255,255,255,0.3)" stroke-dasharray="4,4" />
            <template v-for="it in hover.items" :key="'hv' + it.key">
              <circle v-if="it.val !== null"
                :cx="hover.x" :cy="yOf(it.val)" r="5"
                :fill="it.color" stroke="#12102a" stroke-width="1.4" />
            </template>
          </template>

          <!-- X轴刻度标签（随跨度自适应：短=日期，长=月份） -->
          <text v-for="tk in xTicks" :key="'xl' + tk.key"
            :x="tk.x" :y="G.H - 6"
            text-anchor="middle" :font-size="G.fs"
            fill="#6f6b8f">{{ tk.label }}</text>
        </svg>
        <div class="fs-tip" v-if="hover" :style="{ left: tipLeft + 'px', top: tipTop + 'px' }">
          <div class="tip-date">{{ hover.date }}</div>
          <div class="tip-row" v-for="it in hover.items" :key="'tip' + it.key">
            <span class="tip-dot" :style="{ background: it.color }"></span>
            <span class="tip-name">{{ it.name }}</span>
            <span class="tip-val">{{ it.val === null ? '—' : it.val.toFixed(2) + '%' }}</span>
          </div>
        </div>
      </div>
      <div v-else class="nav-empty">暂无净值数据</div>

      <!-- 基金明细：每支基金=编号+名称+净值 / 基准说明 -->
      <div class="nav-funds" v-if="seriesMeta.length">
        <div v-for="s in seriesMeta" :key="s.key" class="nf-item">
          <div class="nf-row">
            <span class="nf-dot" :style="{ background: s.color }"></span>
            <span class="nf-code num-mono">{{ s.code }}</span>
            <span class="nf-name">{{ s.shortName }}</span>
            <span class="nf-nav num-mono">{{ s.navText }}</span>
          </div>
          <div class="nf-desc">
            {{ s.descParts.pre }}<span v-if="s.descParts.num !== null" class="nf-num" :style="{ color: s.color }">{{ s.descParts.num }}</span>{{ s.descParts.post }}
          </div>
        </div>
      </div>

    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { fetchPositionSnapshots } from '@/api/supabase'
import { FUND_CODES, getFundNav, refreshFundNav } from '@/api/fundNav'
import { showToast } from 'vant'
import { MINE, MINE_BASE_DATE, MINE_BASE_ASSET, MINE_BASE_NOTE } from '@/utils/portfolioNav'

const FUND_META = {
  '027730': { code: '027730', shortName: '沪深300增C', name: '027730 沪深300增C', color: '#4d9fff' },
  '027317': { code: '027317', shortName: '兴全科技A', name: '027317 兴全科技A', color: '#ffd23f' }
}

const snapshots = ref([])
const funds = ref({})     // code -> [{date, ts, val}]

const isFullscreen = ref(false)
const fsSize = ref({ w: 900, h: 420 })
const hover = ref(null)
const chartEl = ref(null)
let ro = null
const refreshing = ref(false)


// ===== 几何参数（compact 内嵌卡片 / large 全屏横版） =====
function withSize(g) {
  return { ...g, CW: g.W - g.PAD.left - g.PAD.right, CH: g.H - g.PAD.top - g.PAD.bottom }
}
const COMPACT = withSize({
  W: 420, H: 220,
  PAD: { top: 14, right: 14, bottom: 22, left: 42 },
  fs: 9, lw: 2, dr: 2.5, rr: 5, rs: 1.5, ds: 1.2,
  endLabel: false,
  yStepOf: r => (r > 16 ? 4 : r > 8 ? 2 : 1),
  xRules: [
    { maxDays: 60,  step: 7,  label: 'day' },
    { maxDays: 120, step: 14, label: 'day' },
    { maxDays: 200, step: 30, label: 'month' },
    { maxDays: 400, step: 60, label: 'month' }
  ]
})
const LARGE = withSize({
  W: 900, H: 420,
  PAD: { top: 18, right: 74, bottom: 34, left: 56 },
  fs: 15, lw: 2.6, dr: 4, rr: 7, rs: 1.8, ds: 1.4,
  endLabel: true,
  yStepOf: (r, h) => {
    const target = Math.max(4, Math.round(h / 30))
    return [0.5, 1, 2, 4, 5].find(n => n >= r / target) || 10
  },
  xRules: [
    { maxDays: 60,  step: 3,  label: 'day' },
    { maxDays: 120, step: 7,  label: 'day' },
    { maxDays: 200, step: 15, label: 'day' },
    { maxDays: 400, step: 30, label: 'month' }
  ]
})

const mqPortrait = window.matchMedia('(orientation: portrait)')
const isPortrait = ref(mqPortrait.matches)
function onOrientChange(e) { isPortrait.value = e.matches }

const G = computed(() => {
  if (!isFullscreen.value) return COMPACT
  const g = withSize({ ...LARGE, W: fsSize.value.w, H: fsSize.value.h })
  if (isPortrait.value) g.fs = 13
  return g
})

// 浏览器全屏 + 锁定横屏（与持仓页 K 线全屏一致；不支持时静默降级）
function enterFullscreenApi() {
  const el = document.documentElement
  if (!el.requestFullscreen) return
  Promise.resolve(el.requestFullscreen())
    .then(() => {
      if (screen.orientation && screen.orientation.lock) {
        Promise.resolve(screen.orientation.lock('landscape')).catch(() => {})
      }
    })
    .catch(() => {})
}

function exitFullscreenApi() {
  if (screen.orientation && screen.orientation.unlock) {
    Promise.resolve(screen.orientation.unlock()).catch(() => {})
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    Promise.resolve(document.exitFullscreen()).catch(() => {})
  }
}

function openFullscreen() { isFullscreen.value = true; hover.value = null; enterFullscreenApi() }
function closeFullscreen() { isFullscreen.value = false; exitFullscreenApi() }

// ===== 快照 → 金枪不倒每日净值（从横轴第一天开始，基准=7/29 市值 848405，缺失日补齐前日） =====
const chartStart = computed(() => {
  let minDate = null
  for (const code of FUND_CODES) {
    const pts = funds.value[code] || []
    if (pts.length) {
      const d = pts[0].date
      if (!minDate || d < minDate) minDate = d
    }
  }
  if (minDate) return minDate
  if (!snapshots.value.length) return null
  return [...snapshots.value].sort((a, b) => a.date.localeCompare(b.date))[0].date
})

const ownSeries = computed(() => {
  if (!snapshots.value.length || !chartStart.value) return []
  // 只取横轴第一天及以后快照
  const sorted = [...snapshots.value]
    .filter(s => s.date >= chartStart.value)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return []
  // 基准 = 7/29 市值 848405（100%）；7/28 净值 = 818971 / 848405 ≈ 96.53%
  const base = MINE_BASE_ASSET
  const map = new Map()
  for (const s of sorted) map.set(s.date, s.asset)
  const start = new Date(sorted[0].date + 'T00:00:00')
  const end = new Date(sorted[sorted.length - 1].date + 'T00:00:00')
  const res = []
  let last = base
  let cur = new Date(start)
  while (cur <= end) {
    const ds = toStr(cur)
    const a = map.get(ds) ?? last
    last = a
    res.push({ date: ds, ts: cur.getTime(), val: +(a / base * 100).toFixed(2) })
    cur.setDate(cur.getDate() + 1)
  }
  return res
})

// ===== 时间轴范围（所有线合并） =====
const allPoints = computed(() => {
  const list = []
  for (const p of ownSeries.value) list.push(p)
  for (const code of FUND_CODES) {
    const arr = funds.value[code] || []
    for (const p of arr) list.push(p)
  }
  return list
})

const tMin = computed(() => allPoints.value.length ? Math.min(...allPoints.value.map(p => p.ts)) : Date.now())
const tMax = computed(() => allPoints.value.length ? Math.max(...allPoints.value.map(p => p.ts)) : Date.now())

function xOf(ts) {
  const g = G.value
  const span = tMax.value - tMin.value
  if (span <= 0) return g.PAD.left
  return g.PAD.left + ((ts - tMin.value) / span) * g.CW
}

// ===== Y 轴范围 =====
const yMin = computed(() => {
  const vals = allPoints.value.map(p => p.val)
  if (!vals.length) return 95
  const lo = Math.min(...vals, 100)
  return Math.floor((lo - 0.5) / 1) * 1
})
const yMax = computed(() => {
  const vals = allPoints.value.map(p => p.val)
  if (!vals.length) return 105
  const hi = Math.max(...vals, 100)
  return Math.ceil((hi + 0.5) / 1) * 1
})

function yOf(val) {
  const g = G.value
  const r = yMax.value - yMin.value
  if (r <= 0) return g.PAD.top + g.CH / 2
  return g.PAD.top + g.CH - ((val - yMin.value) / r) * g.CH
}

// ===== Y 轴刻度 =====
const yStep = computed(() => G.value.yStepOf(yMax.value - yMin.value, G.value.CH))
const yTicks = computed(() => {
  const ticks = []
  for (let v = yMin.value; v <= yMax.value + 0.001; v += yStep.value) {
    ticks.push({ value: v, y: yOf(v) })
  }
  return ticks
})

// ===== X 轴刻度（自适应：跨度短=每周一格，中=每两周，长=每月，最长=每两月） =====
const xTickRule = computed(() => {
  const rules = G.value.xRules
  if (!allPoints.value.length) return rules[2]
  const spanDays = (tMax.value - tMin.value) / 86400000
  return rules.find(r => spanDays <= r.maxDays) || rules[rules.length - 1]
})

// 额外固定刻度（不随自适应步长变化）：7/29 金枪不倒 100% 基准日
const X_EXTRA_DATES = [MINE_BASE_DATE]

// 生成竖向刻度线（月步长对齐月初；周步长对齐周一；密集步长对齐 100% 基准日）
const xTicks = computed(() => {
  const ticks = []
  if (!allPoints.value.length) return ticks
  const rule = xTickRule.value
  const cur = new Date(tMin.value)
  const end = new Date(tMax.value)

  if (rule.step >= 30) {
    // 月步长：对齐到月初
    cur.setDate(1)
    if (cur < new Date(tMin.value)) cur.setMonth(cur.getMonth() + 1)
    while (cur.getTime() <= end.getTime()) {
      ticks.push({ key: toStr(cur), ts: cur.getTime(), x: xOf(cur.getTime()), label: monthLabel(cur) })
      cur.setMonth(cur.getMonth() + rule.step / 30)
    }
  } else {
    if (rule.step >= 7) {
      // 周步长：对齐到周一
      cur.setDate(cur.getDate() + ((8 - cur.getDay()) % 7))
    } else {
      // 密集步长：对齐到 100% 基准日，保证 7/29 自然成为刻度
      const bd = Date.parse(MINE_BASE_DATE + 'T00:00:00')
      cur.setTime(bd >= tMin.value && bd <= end.getTime() ? bd : tMin.value)
    }
    while (cur.getTime() <= end.getTime()) {
      const isMonthStart = rule.step >= 7 && cur.getDate() <= 7
        && (cur.getTime() - new Date(cur.getFullYear(), cur.getMonth(), 1).getTime()) < 7 * 86400000
      ticks.push({
        key: toStr(cur), ts: cur.getTime(), x: xOf(cur.getTime()),
        label: isMonthStart ? monthLabel(cur) : (cur.getMonth() + 1) + '/' + cur.getDate()
      })
      cur.setDate(cur.getDate() + rule.step)
    }
  }

  // 追加固定基准日刻度（与已有刻度相距 ≤min(3, step) 天时跳过，避免标签重叠）
  for (const d of X_EXTRA_DATES) {
    const ts = Date.parse(d + 'T00:00:00')
    if (ts < tMin.value || ts > tMax.value) continue
    if (ticks.some(t => Math.abs(t.ts - ts) <= Math.min(3, rule.step) * 86400000)) continue
    const e = new Date(ts)
    ticks.push({
      key: 'extra-' + d, ts, x: xOf(ts),
      label: (e.getMonth() + 1) + '/' + e.getDate()
    })
  }
  ticks.sort((a, b) => a.ts - b.ts)
  return ticks
})

function monthLabel(d) {
  return (d.getMonth() + 1) + '月'
}

// ===== 触摸/悬停十字线 + tooltip（仅全屏） =====
const TIP_W = 168
const tipLeft = computed(() => {
  if (!hover.value) return 0
  const g = G.value
  const left = hover.value.x + 14
  return left + TIP_W > g.W - g.PAD.right ? Math.max(g.PAD.left, hover.value.x - 14 - TIP_W) : left
})
const tipTop = computed(() => G.value.PAD.top + 8)

function toVbX(clientX) {
  const el = chartEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return null
  return (clientX - rect.left) * (G.value.W / rect.width)
}

function findNearestDate(vbX) {
  const pts = ownSeries.value
  if (!pts.length) return null
  let lo = 0, hi = pts.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xOf(pts[mid].ts) < vbX) lo = mid
    else hi = mid
  }
  return Math.abs(xOf(pts[lo].ts) - vbX) <= Math.abs(xOf(pts[hi].ts) - vbX) ? pts[lo] : pts[hi]
}

function onPointerMove(e) {
  if (!isFullscreen.value) return
  const x = toVbX(e.clientX)
  if (x === null) return
  const g = G.value
  if (x < g.PAD.left || x > g.W - g.PAD.right) { hover.value = null; return }
  const p = findNearestDate(x)
  if (!p) { hover.value = null; return }
  hover.value = {
    date: p.date, x: xOf(p.ts),
    items: [
      { key: 'mine', name: MINE.name, color: MINE.color, val: p.val },
      ...FUND_CODES.map(code => {
        const hit = (funds.value[code] || []).find(q => q.date === p.date)
        return { key: code, name: FUND_META[code].name, color: FUND_META[code].color, val: hit ? hit.val : null }
      })
    ]
  }
}

function onPointerLeave() { hover.value = null }

// ===== 折线路径 =====
function seriesPath(pts) {
  if (!pts.length) return ''
  return pts.map((p, i) => (i ? 'L' : 'M') + xOf(p.ts).toFixed(1) + ',' + yOf(p.val).toFixed(1)).join(' ')
}

// ===== 三线系列 =====
const chartSeries = computed(() => [
  { key: 'mine', color: MINE.color, path: seriesPath(ownSeries.value) },
  ...FUND_CODES.map(code => ({
    key: code, color: FUND_META[code].color,
    path: seriesPath(funds.value[code] || [])
  }))
])

const hasData = computed(() => allPoints.value.length > 0)

// ===== 基金列表：编号 / 名称 / 净值（1.0000） / 基准说明（发行日与披露次数随抓取自动更新） =====
function lastOf(pts) { return pts.length ? pts[pts.length - 1] : null }

// 说明文字拆成 pre / 带色数字 / post 三段，保留原披露次数的彩色高亮
function mineDescParts(fs) {
  return fs
    ? { pre: `基准 ${MINE_BASE_NOTE}（每日仓位快照）`, num: null, post: '' }
    : { pre: `以 ${MINE_BASE_DATE} 卖出长鑫“转户完成”当天市值 ${MINE_BASE_ASSET.toLocaleString('en-US')} 为 100% 基准，数据来源于每日仓位快照`, num: null, post: '' }
}

function fundDescParts(issueDate, count, fs) {
  return fs
    ? { pre: `基准 ${issueDate.slice(5)} 发行日（`, num: count, post: ' 次 · 东方财富）' }
    : { pre: `以 ${issueDate} 发行日市值作为 100% 基准，至今共披露 `, num: count, post: ' 次市值' }
}

const seriesMeta = computed(() => {
  const fs = isFullscreen.value
  const metas = []
  const mine = lastOf(ownSeries.value)
  metas.push({
    key: 'mine',
    code: MINE.code, shortName: MINE.shortName, color: MINE.color,
    navText: mine ? (mine.val / 100).toFixed(4) : '—',
    latestText: mine ? mine.val.toFixed(2) + '%' : '—',
    descParts: mineDescParts(fs),
    lastX: mine ? xOf(mine.ts) : 0, lastY: mine ? yOf(mine.val) : 0
  })
  for (const code of FUND_CODES) {
    const pts = funds.value[code] || []
    const last = lastOf(pts)
    const meta = FUND_META[code]
    metas.push({
      key: code,
      code: meta.code, shortName: meta.shortName, color: meta.color,
      navText: last ? (last.val / 100).toFixed(4) : '—',
      latestText: last ? last.val.toFixed(2) + '%' : '—',
      descParts: fundDescParts(pts.length ? pts[0].date : '—', pts.length, fs),
      lastX: last ? xOf(last.ts) : 0, lastY: last ? yOf(last.val) : 0
    })
  }
  return metas
})

// ===== 圆点（金枪不倒首尾=实心点，7/29 转户完成日=同心圆；参考基金每个披露点，起点=同心圆） =====
const allDots = computed(() => {
  const dots = []
  const mine = ownSeries.value
  const byDate = new Map(mine.map(p => [p.date, p]))
  if (mine.length) {
    const bp = byDate.get(MINE_BASE_DATE)
    if (bp) dots.push({ dotKey: 'mine-' + MINE_BASE_DATE, color: MINE.color, x: xOf(bp.ts), y: yOf(bp.val), start: true })
    const first = mine[0]
    if (first.date !== MINE_BASE_DATE) {
      dots.push({ dotKey: 'mine-' + first.date, color: MINE.color, x: xOf(first.ts), y: yOf(first.val) })
    }
    if (mine.length > 1) {
      const last = mine[mine.length - 1]
      if (last.date !== MINE_BASE_DATE) {
        dots.push({ dotKey: 'mine-' + last.date, color: MINE.color, x: xOf(last.ts), y: yOf(last.val) })
      }
    }
  }
  for (const code of FUND_CODES) {
    const pts = funds.value[code] || []
    for (let i = 0; i < pts.length; i++) {
      dots.push({
        dotKey: code + '-' + pts[i].date,
        color: FUND_META[code].color,
        x: xOf(pts[i].ts), y: yOf(pts[i].val),
        start: i === 0
      })
    }
  }
  return dots
})

function toStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

// ===== 加载 =====
// [{date, nav}] → 图表点：val = 净值百分比（净值 1.0000 = 100）
function toPoints(list) {
  return list.map(d => ({ date: d.date, ts: Date.parse(d.date + 'T00:00:00'), val: +(d.nav * 100).toFixed(2) }))
}

// 基金数据由 App.vue 每次启动时后台抓取（失败自动回退本地），这里只读缓存/种子，保证图表即时渲染
async function loadAll() {
  try {
    const [snaps, ...fundsRes] = await Promise.all([
      fetchPositionSnapshots(500),
      ...FUND_CODES.map(code => getFundNav(code))
    ])
    console.log('[FundNavChart] snaps', snaps.length, 'funds', fundsRes.map(f => f.data.length).join('/'))
    snapshots.value = snaps
    const map = {}
    FUND_CODES.forEach((code, i) => { map[code] = toPoints(fundsRes[i].data) })
    funds.value = map
  } catch (e) {
    console.error('FundNavChart load error:', e)
  }
}

// 手动刷新：串行抓取两只基金（避免全局变量竞争），全部失败时提示并回退本地数据
async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    let ok = 0
    for (const code of FUND_CODES) {
      const r = await refreshFundNav(code)
      if (r.source === 'network' && r.data.length) ok++
    }
    await loadAll()
    showToast(ok > 0 ? '已更新最新净值' : '抓取失败，已用本地数据')
  } catch (e) {
    console.warn('[FundNavChart] refresh error:', e)
    showToast('抓取失败，已用本地数据')
  } finally {
    refreshing.value = false
  }
}

// 系统手势退出浏览器全屏时同步收掉 CSS 全屏，避免遮罩卡住
function onFsChange() {
  if (!document.fullscreenElement && isFullscreen.value) closeFullscreen()
}

watch(isFullscreen, v => {
  if (ro) { ro.disconnect(); ro = null }
  if (!v) { hover.value = null; return }
  nextTick(() => {
    if (!chartEl.value || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      if (r.width > 0 && r.height > 0) fsSize.value = { w: Math.round(r.width), h: Math.round(r.height) }
    })
    ro.observe(chartEl.value)
  })
})

onMounted(() => {
  mqPortrait.addEventListener('change', onOrientChange)
  document.addEventListener('fullscreenchange', onFsChange)
  loadAll()
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  mqPortrait.removeEventListener('change', onOrientChange)
  document.removeEventListener('fullscreenchange', onFsChange)
  if (isFullscreen.value) exitFullscreenApi()
})
</script>

<style scoped>
/* 外层留白由父级 .section-card 提供，这里不加，否则双重 padding */
.fund-nav { padding: 0; }
.fund-nav--fs { position: fixed; inset: 0; z-index: 10000; background: #12102a; padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; box-sizing: border-box; }
.fund-nav--fs .nav-head { margin-bottom: 10px; flex-shrink: 0; }
.fund-nav--fs .nav-title { font-size: 16px; }
.fund-nav--fs .nav-subtitle { font-size: 12px; margin-left: 6px; }
/* 全屏横版：明细压成三列（每列=编号行+说明行），图表继续占满剩余高度 */
.fund-nav--fs .nav-funds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; padding: 10px 12px; margin-top: 10px; flex-shrink: 0; }
.fund-nav--fs .nf-item { border: 0; padding-top: 0; }
.fund-nav--fs .nf-row { gap: 6px; }
.fund-nav--fs .nf-dot { width: 9px; height: 9px; }
.fund-nav--fs .nf-code { font-size: 11px; }
.fund-nav--fs .nf-name { font-size: 12px; }
.fund-nav--fs .nf-nav { font-size: 14px; }
.fund-nav--fs .nf-desc { padding-left: 14px; font-size: 12px; line-height: 1.7; margin-top: 2px; }
.fund-nav--fs .nav-chart { flex: 1; min-height: 0; touch-action: pan-y; }
.fund-nav--fs .nav-fs-btn { font-size: 12px; padding: 4px 11px; }

@media (orientation: portrait) {
  .fund-nav--fs { padding: 10px 12px; }
  .fund-nav--fs .nav-funds { grid-template-columns: 1fr; }
}

.nav-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.nav-title { font-size: 13px; font-weight: 600; }
.nav-subtitle { font-size: 11px; color: var(--text-muted); font-weight: 400; letter-spacing: .5px; text-transform: uppercase; margin-left: 4px; margin-right: auto; }
.nav-fs-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; font-size: 10px; line-height: 1.2; color: var(--text-secondary); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; cursor: pointer; user-select: none; }
.nav-fs-btn:active { background: rgba(255,255,255,0.13); color: var(--text-primary); }
/* 手动刷新：紧贴全屏胶囊左侧的圆形图标按钮 */
.nav-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}
.nav-refresh:active { background: rgba(255,255,255,0.13); color: var(--text-primary); }
.nav-refresh svg { width: 13px; height: 13px; }
.nav-refresh.is-spinning svg { animation: nav-spin 0.9s linear infinite; }
@keyframes nav-spin { to { transform: rotate(360deg); } }
/* 全屏入口：样式同持仓页 .kline-hint */
.nav-expand { font-family: inherit; font-size: 11px; font-weight: 600; line-height: 1.2; color: #b18cff; background: rgba(111,77,255,0.14); border: 1px solid rgba(177,140,255,0.4); padding: 3px 10px; border-radius: 12px; white-space: nowrap; cursor: pointer; }
.nav-expand:active { background: rgba(111,77,255,0.3); }

/* 基金明细（竖屏：图表下方，每支基金=编号+名称+净值 / 细体说明） */
.nav-funds { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; padding: 8px 10px; background: rgba(255,255,255,0.04); border-radius: 8px; }
.nf-item + .nf-item { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 7px; }
.nf-row { display: flex; align-items: center; gap: 6px; }
.nf-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.nf-code { font-size: 11px; color: var(--text-muted); letter-spacing: .3px; }
.nf-name { font-size: 11.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.nf-nav { margin-left: auto; font-size: 13px; font-weight: 700; color: var(--text-primary); }
.nf-desc { padding-left: 14px; font-size: 10px; color: var(--text-muted); line-height: 1.7; }
.nf-num { font-weight: 700; font-family: var(--font-number); }

/* 图表 */
.nav-chart { position: relative; width: 100%; }
.nav-svg { width: 100%; height: auto; display: block; }
.nav-empty { height: 120px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--text-muted); }

/* 全屏 tooltip */
.fs-tip { position: absolute; width: 168px; box-sizing: border-box; padding: 6px 10px; background: rgba(30,27,58,0.96); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; font-size: 13px; line-height: 1.7; pointer-events: none; z-index: 3; }
.tip-date { color: var(--text-primary); font-weight: 700; margin-bottom: 2px; font-family: var(--font-number); }
.tip-row { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
.tip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tip-name { flex: 1; }
.tip-val { font-family: var(--font-number); font-weight: 700; color: var(--text-primary); }
</style>
