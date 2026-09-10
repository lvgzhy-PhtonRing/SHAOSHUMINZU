# 净值比较 · 全屏模式设计

日期：2026-09-10

## 背景

「净值比较」（`FundNavChart.vue`）在趋势页 `.section-card` 内嵌展示，SVG viewBox 仅 420×220，字号 9px，横坐标每周一格。数据点密集处看不清走势，用户要求提供全屏查看模式。

## 需求决策（用户确认）

| 维度 | 决定 |
|------|------|
| 入口 | 图表区域右上角悬浮 pill 按钮 `⛶ 全屏` |
| 出口 | 全屏顶栏右上角 pill 按钮 `✕ 退出`（与入口同侧对称，单出口） |
| 容器模式 | 沿用持仓页点股票的 K 线模式：`fixed; inset:0` + 实心背景 + `z-index:10000` |
| 屏幕方向 | 不做方向锁定、不做 CSS 旋转；横版布局在横屏/宽屏下自然展开 |
| 布局 | 图例行 + 图表独占全宽 + 底部一行三格说明 |
| 信息保留 | 现有信息（标题 / 图例最新值 / 图表 / 三行说明）全部保留 |
| 细节增强 | 字号线宽放大、刻度更密、末端数值标签、触摸十字线 + tooltip |

## 交互

### 入口

- `.nav-chart` 设 `position: relative`，按钮 `position:absolute; top:2px; right:2px`
- pill 样式：`display:inline-flex; gap:4px; padding:3px 8px; font-size:10px; color:var(--text-secondary); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:999px; z-index:2; user-select:none`；`:active` 加深背景与字色
- 文字 `全屏` + 图标 `⛶`，自带可见提示（手机端无 hover，不依赖 `title`）
- `v-if="hasData"` 才渲染（无数据不显示入口）
- 遮挡校验：按钮（约 52×20px）覆盖 SVG 顶部 y≈2-23 区域（越过 `PAD.top=14` 约 9px 进入绘图区）；三条线末端 y≈70+，该区域内只有顶部网格线，无折线/数据点，`PAD` 无需调整
- 点击置 `isFullscreen = true`

### 出口

- 全屏顶栏右侧 pill 按钮 `✕ 退出`，样式同入口按钮
- 点击置 `isFullscreen = false`
- 不做点遮罩关闭（实心背景无遮罩）、不做 ESC 键（项目内零先例）

## 容器

```html
<Teleport to="body">
  <div class="nav-fs" v-if="isFullscreen">
    <div class="fs-head">…标题 + ↻ + ✕ 退出…</div>
    <div class="fs-legend">…图例行…</div>
    <div class="fs-chart">…SVG…</div>
    <div class="fs-desc">…底部一行三格说明…</div>
  </div>
</Teleport>
```

- `.nav-fs { position:fixed; inset:0; background:#12102a; z-index:10000; display:flex; flex-direction:column; padding:12px 16px; padding-bottom:calc(12px + env(safe-area-inset-bottom, 0px)); }`
- 顶栏：`title-accent--accent` + 「净值比较」+ `NAV Compare` + `margin-right:auto` + `↻`（沿用 `manualRefresh`，`spinning` 动画复用）+ `✕ 退出`
- 图表容器 `flex:1; min-height:0; position:relative`（承载 SVG 与 tooltip 覆盖层）
- Teleport 到 body 避免受 `.section-card` 的 padding / border-radius 约束

## 布局（横版为主，竖屏降级）

| 行 | 内容 | 布局 |
|----|------|------|
| 1 | 顶栏 | flex，标题左、按钮右 |
| 2 | 图例行 | 三项横排 `flex-wrap:wrap`，每项：色点 + 名称 + 基准摘要 + 最新值（等宽字体加粗） |
| 3 | 图表 | `flex:1; min-height:0`，SVG 填满容器 |
| 4 | 说明 | `display:grid; grid-template-columns:repeat(3,1fr); gap:8px`，每格：加粗名称 + 基准说明 |

数据来源：图例行的最新值取 `seriesMeta`，基准摘要取 `fundStats`（参考基金用 `issueDate` + `count`）；金枪不倒无 `issueDate`，基准摘要用固定文案「7/29 转户 848,405」。底部说明三格复用现有三行文案（金枪不倒基准说明 / 027730 / 027317），仅排版由竖排改横排三格。

竖屏降级：

```css
@media (orientation: portrait) {
  .fs-desc { grid-template-columns: 1fr; }
}
```

图表在竖屏下仍独占宽度（高度充裕），字号降至 13。

## 几何参数（compact / fullscreen 双套）

几何常量收敛为 `const G = computed(() => isFullscreen.value ? LARGE : COMPACT)`，`xOf / yOf / xTicks / yTicks / seriesPath / allDots` 全部改读 `G.value`。

| 参数 | COMPACT（现状） | LARGE（全屏） |
|------|----------------|----------------|
| W | 420 | 容器实测（ResizeObserver） |
| H | 220 | 容器实测 |
| PAD | `{14,14,22,42}` | `{18,74,34,56}` |
| 轴标签字号 | 9 | 15（竖屏 13） |
| 线宽 | 2 | 2.6 |
| 圆点 r | 2.5 | 4 |
| 同心圆 r / stroke | 5 / 1.5 | 7 / 1.8 |
| 圆点描边 | 1.2 | 1.4 |
| X 刻度步长 | 60/7、120/14、200/30、400/60 | ≤60天 3、≤120天 7、≤200天 15、≤400天 30 |
| Y 步长 | 量程>16→4、>8→2、否则 1 | 固定 0.5 |
| 末端数值标签 | 无 | 有，字号 15，与线同色 |
| 触摸十字线 + tooltip | 无 | 有 |

`X_EXTRA_DATES = [MINE_BASE_DATE]` 在两套模式下都生效（7/29 固定刻度）。

`W/H` 实测：全屏打开后用 `ResizeObserver` 监听 `.fs-chart`，写入 `fsSize = ref({w:900,h:420})`；`G.value.W/H` 在全屏分支读 `fsSize`。viewBox 与实际像素 1:1，字号为真实 px，不随缩放失真。

## 末端数值标签

每条线最后一个点右侧标注 `val.toFixed(2) + '%'`：

- `text-anchor="start"`，`x = 末点x + 8`，`y = 末点y + 字号*0.35`
- `fill` 取该线颜色，`font-family: var(--font-number)`，加粗
- `PAD.right = 74` 保证不裁切

## 触摸十字线 + tooltip（仅全屏）

- 触发：图表容器 `@pointermove` / `@pointerdown` / `@pointerleave`
- 坐标换算：`svg.getBoundingClientRect()` → `vbX = (clientX - rect.left) * (W / rect.width)`；仅当 `vbX ∈ [PAD.left, W - PAD.right]` 时显示
- 命中日期：在 `ownSeries` 的日期序列中找与 `vbX` 距离最小的日期
- 竖虚线：`stroke: rgba(255,255,255,0.3)`，`stroke-dasharray: 4,4`，从 `PAD.top` 到 `PAD.top + CH`
- 命中圆点：三条线在该日期有数据时各画一个 r=5 同色实心点（金枪不倒每日都有；参考基金仅披露日命中）
- tooltip 卡片：HTML `div` 绝对定位（不用 SVG foreignObject）
  - 内容：日期 + 三行（色点 + 名称 + `val%`）；缺数据该日该线显示 `—`
  - 样式：`background: rgba(30,27,58,0.96)`，`border: 1px solid rgba(255,255,255,0.14)`，`border-radius: 8px`，`padding: 6px 10px`，字号 13，宽 168
  - 位置：`left = x + 14`；若 `x + 14 + 168 > W - PAD.right` 则翻转 `left = x - 14 - 168`；`top = PAD.top + 8`
- `pointerleave` 清空状态
- compact 模式不绑定这些事件

## 数据流

- `loadAll` / `manualRefresh` 完全不动；全屏与内嵌共用同一组件实例的 `snapshots` / `funds` / `ownSeries` / `fundStats` / `seriesMeta`
- 全屏内 `↻` 走同一 `manualRefresh`，`loading` 状态与 `spinning` 动画共享

## 不做

- 不锁屏幕方向（`screen.orientation.lock`）、不做 CSS 旋转换向
- 不做 ESC 键退出、不做点遮罩关闭、不做提示条
- 金枪不倒不显示全日数据点（仍只首尾 + 7/29 同心圆）
- 不加 7/29 基准日竖向高亮带
- 不做面积渐变填充
- 不改数据加载与 API 层
- 不动 compact 模式现有视觉效果（除新增入口按钮）

## 影响范围

- 仅 `src/components/fund/FundNavChart.vue`（432 → 约 600 行）
- `TrendsPage.vue` 不改（`<FundNavChart />` 无 props）
- 无新增文件、无新增依赖、无数据库改动
