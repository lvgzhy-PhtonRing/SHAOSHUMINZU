# 净值比较 · 全屏模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为趋势页「净值比较」模块增加全屏横版查看模式，图表更大更清晰、细节更多。

**Architecture:** 单文件改造 `src/components/fund/FundNavChart.vue`。几何参数收敛为一个 `G` computed（compact 内嵌 / large 全屏两套），模板改为读 `G.*`；用 `<Teleport to="body" :disabled="!isFullscreen">` 包裹组件根节点 —— 非全屏时原地渲染（零改动现有卡片），全屏时移到 body 并以 `fixed; inset:0` 覆盖。两套模式共用同一份 SVG 模板与同一批 computed，仅靠 `G` 切换尺寸/字号/刻度密度，全屏分支额外渲染末端数值标签与触摸十字线 tooltip。

**Tech Stack:** Vue 3 `<script setup>`、手写 SVG（无图表库）、`ResizeObserver`、Pointer Events、`window.matchMedia`。无新增依赖。

**规格：** `docs/superpowers/specs/2026-09-10-nav-compare-fullscreen-design.md`

---

## 约定与偏差说明

- **无测试框架**：项目 `package.json` 只有 `dev/build/preview/generate-stocks`，无 vitest/jest。每个任务的验证 = `npm run build`（语法/编译门禁）+ 人工视觉检查。
- **不提交 git**：项目规则「未明确要求不提交」，本计划不含 commit 步骤。
- **人工视觉检查前置**：`npm run dev` 后访问趋势页需先输入 4 位登录密码（未知则向用户索取）。
- **规格偏差 1（Y 步长）**：规格写「固定 0.5」，横版手机图表实际高度约 220px，0.5 步长会产出约 14 条标签互相压字。改为按 `CH` 自适应、最小 0.5。
- **规格偏差 2（7/29 刻度）**：规格写 `X_EXTRA_DATES` 两套模式都生效。横版 step=3 时 7/29 与起点 7/28 标签仅隔约 17px 会重叠；改为**密集刻度网格直接对齐到 7/29**（7/29 自然成为首个刻度），不再依赖额外追加。

---

## Task 1: 几何参数双套化（script + 模板改读 G）

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

紧凑与全屏的几何参数收敛为一个 computed，模板中所有 `W/H/PAD/CW/CH` 与硬编码的字号/线宽/圆点半径改读 `G.*`。本任务完成后 compact 视觉效果必须与改动前完全一致。

- [ ] **Step 1: 替换 script 顶部的几何常量**

删除：

```js
const W = 420
const H = 220
const PAD = { top: 14, right: 14, bottom: 22, left: 42 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom
```

并在 `const loading = ref(true)` 之后、`chartStart` 之前插入：

```js
const isFullscreen = ref(false)
const fsSize = ref({ w: 900, h: 420 })
const hover = ref(null)

// 金枪不倒 100% 基准日的图例摘要（全屏图例行复用）
const MINE_BASE_NOTE = '7/29 转户 848,405'

// ===== 几何参数（compact 内嵌卡片 / large 全屏横版） =====
function withSize(g) {
  return { ...g, CW: g.W - g.PAD.left - g.PAD.right, CH: g.H - g.PAD.top - g.PAD.bottom }
}
const COMPACT = withSize({
  W: 420, H: 220,
  PAD: { top: 14, right: 14, bottom: 22, left: 42 },
  fs: 9, lw: 2, dr: 2.5, rr: 5, rs: 1.5, ds: 1.2,
  endLabel: false, interactive: false,
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
  endLabel: true, interactive: true,
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
```

- [ ] **Step 2: `xOf` / `yOf` 改读 `G`**

```js
function xOf(ts) {
  const g = G.value
  const span = tMax.value - tMin.value
  if (span <= 0) return g.PAD.left
  return g.PAD.left + ((ts - tMin.value) / span) * g.CW
}
```

```js
function yOf(val) {
  const g = G.value
  const r = yMax.value - yMin.value
  if (r <= 0) return g.PAD.top + g.CH / 2
  return g.PAD.top + g.CH - ((val - yMin.value) / r) * g.CH
}
```

- [ ] **Step 3: `yStep` 改用 `G.yStepOf`**

替换现有 `yStep` computed 为：

```js
const yStep = computed(() => G.value.yStepOf(yMax.value - yMin.value, G.value.CH))
```

- [ ] **Step 4: 删除旧的 `X_TICK_RULES`，`xTickRule` 改读 `G.xRules`**

删除第 206-216 行附近的 `X_TICK_RULES` 常量与旧 `xTickRule`，替换为：

```js
const xTickRule = computed(() => {
  const rules = G.value.xRules
  if (!allPoints.value.length) return rules[2]
  const spanDays = (tMax.value - tMin.value) / 86400000
  return rules.find(r => spanDays <= r.maxDays) || rules[rules.length - 1]
})
```

- [ ] **Step 5: 模板 SVG 全部改读 `G`**

逐处替换（只改属性值，不改结构）：

| 原 | 新 |
|----|----|
| `:viewBox="`0 0 ${W} ${H}`"` | `:viewBox="`0 0 ${G.W} ${G.H}`"` |
| `:x1="PAD.left" :x2="W - PAD.right"`（网格线与 100% 基准线共 2 处） | `:x1="G.PAD.left" :x2="G.W - G.PAD.right"` |
| `:x="PAD.left - 5"` | `:x="G.PAD.left - 5"` |
| Y 轴标签 `font-size="9"` | `:font-size="G.fs"` |
| X 刻度线 `:y1="PAD.top" :y2="PAD.top + CH"` | `:y1="G.PAD.top" :y2="G.PAD.top + G.CH"` |
| 折线 `stroke-width="2"` | `:stroke-width="G.lw"` |
| 同心圆 `r="5"` / `stroke-width="1.5"` | `:r="G.rr"` / `:stroke-width="G.rs"` |
| 实心圆 `r="2.5"` / `stroke-width="1.2"` | `:r="G.dr"` / `:stroke-width="G.ds"` |
| X 轴标签 `:y="H - 5"` / `font-size="9"` | `:y="G.H - 6"` / `:font-size="G.fs"` |

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 成功，无 error/warning 关于未定义变量。

- [ ] **Step 7: 视觉回归**

Run: `npm run dev`，打开趋势页（需 4 位密码登录），确认「净值比较」卡片与改动前完全一致：图例、折线、同心圆、刻度标签位置与字号无变化。

---

## Task 2: 密集刻度网格对齐 7/29

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`（`xTicks` computed）

全屏 step=3 时若网格从 `tMin`（7/28）起，追加的 7/29 刻度会与 7/28 标签重叠。改为：step<7 的密集网格直接对齐到 100% 基准日。

- [ ] **Step 1: 替换 `xTicks` computed**

```js
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
      const isMonthStart = cur.getDate() <= 7 && (cur.getTime() - new Date(cur.getFullYear(), cur.getMonth(), 1).getTime()) < 7 * 86400000
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
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 视觉回归（compact 不变）**

打开趋势页确认卡片 X 轴仍为 `7/29`、`8/3`、`8/10` …（周一对齐），7/29 刻度仍在。

---

## Task 3: 入口按钮 `⛶ 全屏`

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`（模板 + CSS）

- [ ] **Step 1: 模板加按钮与开关函数**

`.nav-chart` 容器改为：

```html
<div class="nav-chart" v-if="hasData">
  <span class="nav-fs-btn" v-if="!isFullscreen" @click="openFullscreen">⛶ 全屏</span>
  <svg ...>
```

`<script setup>` 中 `G` 之后加：

```js
function openFullscreen() { isFullscreen.value = true; hover.value = null }
function closeFullscreen() { isFullscreen.value = false }
```

- [ ] **Step 2: CSS**

`.nav-chart` 加 `position: relative`，并追加：

```css
.nav-fs-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; font-size: 10px; line-height: 1.2; color: var(--text-secondary); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; cursor: pointer; user-select: none; }
.nav-fs-btn:active { background: rgba(255,255,255,0.13); color: var(--text-primary); }
.nav-chart > .nav-fs-btn { position: absolute; top: 2px; right: 2px; z-index: 2; }
```

- [ ] **Step 3: 构建 + 视觉**

Run: `npm run build` → 成功。
打开趋势页：图表右上角出现 `⛶ 全屏` pill 按钮；确认未遮挡折线（按钮覆盖 SVG 顶部 y≈2-23 区域，三条线末端 y≈70+）；无数据时按钮不出现。

---

## Task 4: 全屏容器（Teleport :disabled）+ 退出 + 全屏 CSS

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

用 `Teleport :disabled` 实现「非全屏原地渲染 / 全屏移到 body」，不复制任何模板。

- [ ] **Step 1: 包裹根节点**

模板最外层改为：

```html
<Teleport to="body" :disabled="!isFullscreen">
  <div class="fund-nav" :class="{ 'fund-nav--fs': isFullscreen }">
    ...原有内容...
  </div>
</Teleport>
```

- [ ] **Step 2: 顶栏加退出按钮**

`.nav-head` 内 `↻` 之前插入：

```html
<span class="nav-fs-btn" v-if="isFullscreen" @click="closeFullscreen">✕ 退出</span>
```

- [ ] **Step 3: 全屏 CSS**

```css
.fund-nav--fs { position: fixed; inset: 0; z-index: 10000; background: #12102a; padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; box-sizing: border-box; }
.fund-nav--fs .nav-head { margin-bottom: 10px; flex-shrink: 0; }
.fund-nav--fs .nav-title { font-size: 16px; }
.fund-nav--fs .nav-subtitle { font-size: 12px; margin-left: 6px; }
.fund-nav--fs .nav-legend { padding: 8px 12px; gap: 8px 22px; margin-bottom: 10px; flex-shrink: 0; }
.fund-nav--fs .lg-item { font-size: 12px; }
.fund-nav--fs .lg-dot { width: 10px; height: 10px; }
.fund-nav--fs .lg-val { font-size: 15px; }
.fund-nav--fs .nav-chart { flex: 1; min-height: 0; }
.fund-nav--fs .nav-desc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; margin-top: 10px; flex-shrink: 0; font-size: 12px; line-height: 1.7; }
.fund-nav--fs .nav-fs-btn { font-size: 12px; padding: 4px 11px; }

@media (orientation: portrait) {
  .fund-nav--fs { padding: 10px 12px; }
  .fund-nav--fs .nav-desc { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: 构建 + 视觉**

Run: `npm run build` → 成功。
点 `⛶ 全屏`：整屏被 `#12102a` 覆盖（在底部 tabbar 之上），顶栏「净值比较 / NAV Compare / ✕ 退出」，图例行，图表占满中间，底部说明三格。点 `✕ 退出` 回到卡片。横竖屏各切一次确认降级生效。

---

## Task 5: 全屏尺寸实测（ResizeObserver + 方向）

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

全屏 SVG 的 viewBox 必须等于容器实际像素，字号才是真实 px、不随缩放失真。

- [ ] **Step 1: import 补充**

```js
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
```

- [ ] **Step 2: 图表容器加 ref**

`.nav-chart` 加 `ref="chartEl"`。script 中 `hover` 之后加：

```js
const chartEl = ref(null)
let ro = null
```

- [ ] **Step 3: 全屏时建立/销毁 ResizeObserver**

```js
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
```

- [ ] **Step 4: 生命周期**

`onMounted` 合并为：

```js
onMounted(() => {
  mqPortrait.addEventListener('change', onOrientChange)
  loadAll()
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  mqPortrait.removeEventListener('change', onOrientChange)
})
```

- [ ] **Step 5: 构建 + 视觉**

Run: `npm run build` → 成功。
进入全屏，拖拽浏览器窗口宽度（或手机旋转）：图表随容器伸缩，坐标轴标签始终清晰、不拉伸变形；`fsSize` 生效后可在 console 验证 `G.W` 接近容器宽度。

---

## Task 6: 全屏图例行基准摘要

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

- [ ] **Step 1: `seriesMeta` 加 `baseNote`**

```js
const seriesMeta = computed(() => {
  const metas = []
  const mine = lastOf(ownSeries.value)
  metas.push({
    key: 'mine', name: MINE.name, color: MINE.color,
    latestText: mine ? mine.val.toFixed(2) + '%' : '—',
    baseNote: MINE_BASE_NOTE,
    lastX: mine ? xOf(mine.ts) : 0, lastY: mine ? yOf(mine.val) : 0
  })
  for (const code of FUND_CODES) {
    const pts = funds.value[code] || []
    const last = lastOf(pts)
    metas.push({
      key: code, name: FUND_META[code].name, color: FUND_META[code].color,
      latestText: last ? last.val.toFixed(2) + '%' : '—',
      baseNote: pts.length ? pts[0].date.slice(5) + ' 起 · ' + pts.length + ' 次' : '',
      lastX: last ? xOf(last.ts) : 0, lastY: last ? yOf(last.val) : 0
    })
  }
  return metas
})
```

- [ ] **Step 2: 图例模板加摘要 span**

```html
<span class="lg-base" v-if="s.baseNote && isFullscreen">{{ s.baseNote }}</span>
```

放在 `.lg-name` 与 `.lg-val` 之间。CSS：

```css
.lg-base { color: var(--text-muted); font-size: 10px; }
```

- [ ] **Step 3: 构建 + 视觉**

Run: `npm run build` → 成功。
全屏图例行每项显示：色点 + 名称 + 摘要（如 `08-25 起 · 8 次`）+ 最新值；卡片内图例不出现摘要，与改动前一致。

---

## Task 7: 说明文字双版本

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

全屏横向三格空间有限，长文案换行过多；全屏用精简版，卡片保持原文案与彩色次数数字。

- [ ] **Step 1: 替换 `.nav-desc` 模板**

```html
<div class="nav-desc">
  <div>
    <span class="dc-dot" :style="{ background: MINE.color }"></span><span class="dc-name">{{ MINE.name }}</span>
    <template v-if="isFullscreen"> 基准 {{ MINE_BASE_NOTE }}（每日仓位快照）</template>
    <template v-else> 以 2026-07-29 卖出长鑫“转户完成”当天市值 848,405 为 100% 基准，数据来源于每日仓位快照</template>
  </div>
  <div v-for="f in fundStats" :key="f.code">
    <span class="dc-dot" :style="{ background: f.color }"></span><span class="dc-name">{{ f.name }}</span>
    <template v-if="isFullscreen"> 基准 {{ f.issueDate.slice(5) }} 发行日（<span class="dc-num" :style="{ color: f.color }">{{ f.count }}</span> 次 · 东方财富）</template>
    <template v-else> 以 {{ f.issueDate }} 发行日市值作为 100% 基准，至今共披露 <span class="dc-num" :style="{ color: f.color }">{{ f.count }}</span> 次市值</template>
  </div>
</div>
```

- [ ] **Step 2: 构建 + 视觉**

Run: `npm run build` → 成功。
卡片：三行说明文案与彩色次数数字与改动前一致。全屏：三格精简文案，次数数字仍为对应线颜色。

---

## Task 8: 末端数值标签

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

复用 `seriesMeta` 已有的 `lastX/lastY`。

- [ ] **Step 1: SVG 内加标签**

放在圆点 `<template>` 之后、X 轴标签之前：

```html
<!-- 末端数值标签（仅全屏） -->
<text v-if="G.endLabel" v-for="s in seriesMeta" :key="'el' + s.key"
  :x="s.lastX + 8" :y="s.lastY + G.fs * 0.35"
  text-anchor="start" :font-size="G.fs"
  :fill="s.color" font-weight="700"
  font-family="var(--font-number)">{{ s.latestText }}</text>
```

- [ ] **Step 2: 构建 + 视觉**

Run: `npm run build` → 成功。
全屏：三条线末端右侧各有一个同色数值（如 `100.80%`），不被右边缘裁切（`PAD.right=74` 留白）；卡片内无标签。

---

## Task 9: 触摸十字线 + tooltip

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`

- [ ] **Step 1: 图表容器绑定 pointer 事件**

```html
<div class="nav-chart" v-if="hasData" ref="chartEl"
  @pointermove="onPointerMove" @pointerdown="onPointerMove" @pointerleave="onPointerLeave">
```

- [ ] **Step 2: script 加交互逻辑**

放在 `onPointerLeave` 相关位置（`G` 定义之后、`seriesPath` 之前均可）：

```js
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
    ts: p.ts, date: p.date, x: xOf(p.ts),
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
```

- [ ] **Step 3: SVG 内加十字线与命中圆点**

放在折线 `<path>` 之后：

```html
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
```

- [ ] **Step 4: tooltip HTML 覆盖层**

`.nav-chart` 内、`</svg>` 之后：

```html
<div class="fs-tip" v-if="hover" :style="{ left: tipLeft + 'px', top: tipTop + 'px' }">
  <div class="tip-date">{{ hover.date }}</div>
  <div class="tip-row" v-for="it in hover.items" :key="'tip' + it.key">
    <span class="tip-dot" :style="{ background: it.color }"></span>
    <span class="tip-name">{{ it.name }}</span>
    <span class="tip-val">{{ it.val === null ? '—' : it.val.toFixed(2) + '%' }}</span>
  </div>
</div>
```

- [ ] **Step 5: CSS**

```css
.fs-tip { position: absolute; width: 168px; box-sizing: border-box; padding: 6px 10px; background: rgba(30,27,58,0.96); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; font-size: 13px; line-height: 1.7; pointer-events: none; z-index: 3; }
.tip-date { color: var(--text-primary); font-weight: 700; margin-bottom: 2px; font-family: var(--font-number); }
.tip-row { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
.tip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tip-name { flex: 1; }
.tip-val { font-family: var(--font-number); font-weight: 700; color: var(--text-primary); }
```

- [ ] **Step 6: 构建 + 视觉**

Run: `npm run build` → 成功。
全屏下鼠标划过/手指拖动图表：出现竖虚线 + 当日三条线数值卡片；指到图右侧边缘时卡片翻转到左侧不被裁切；移出图表卡片消失；指到参考基金无数据的日期该线显示 `—`。卡片（非全屏）模式下划过图表无任何反应。

---

## Task 10: 全量校验与回归

**Files:**
- Modify: `src/components/fund/FundNavChart.vue`（如需微调）

- [ ] **Step 1: 构建**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 2: 死代码检查**

Run: `rg "initialCapital|initial-capital|formatMoney|W = 420|X_TICK_RULES|CW|CH" src/components/fund/FundNavChart.vue src/pages/TrendsPage.vue`
Expected: 无残留（`CW`/`CH` 仅作为 `G` 内的对象属性出现，不作为顶层变量）。

- [ ] **Step 3: 校验清单（人工）**

逐条确认：

1. 卡片内：图例、折线、同心圆、7/29 刻度、说明文案、彩色次数数字与改动前一致
2. 入口：图表右上角 `⛶ 全屏`；无数据时不显示
3. 全屏：整屏覆盖含底部 tabbar；顶栏 `✕ 退出`；图例行含摘要；图表占满；底部三格说明
4. 全屏细节：字号/线宽/圆点明显放大；X 刻度密度增加且含 7/29；末端数值标签不裁切
5. tooltip：划过/触摸显示当日三线数值；右缘翻转；移出消失；卡片模式无反应
6. 退出：`✕ 退出` 回到卡片；状态正确复位（无残留 hover）
7. 横竖屏：竖屏底部说明降级为单列、图表字号 13；横屏三列
8. 数据刷新：全屏内点 `↻` 能刷新基金数据并同步更新图表/图例/说明

- [ ] **Step 4: 清理（如需）**

如 `G` 分支有未使用字段（如 `interactive` 未被任何模板/逻辑读取），删除该字段及其使用处，保持零死代码。
