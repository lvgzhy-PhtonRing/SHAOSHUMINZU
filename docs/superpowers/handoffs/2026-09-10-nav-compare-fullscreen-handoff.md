# 交接 · 净值比较全屏横版模式

> 日期 2026-09-10｜任务：趋势页「净值比较」模块全屏模式｜状态：**代码完成，未人工验证，未升版，未提交**

---

## 1. 今天做了什么

单文件改造 `src/components/fund/FundNavChart.vue`，432 → 650 行。`npm run build` 通过。

### 核心架构
- `G = computed(...)` 双套几何：`COMPACT`（内嵌卡片）/ `LARGE`（全屏横版）。模板所有 `W/H/PAD/CW/CH` 与字号/线宽/半径改读 `G.*`。两套模式共用同一份 SVG 模板与同一批 computed。
- `<Teleport to="body" :disabled="!isFullscreen">`：非全屏原地渲染（卡片零改动），全屏移到 body 并 `fixed; inset:0; z-index:10000; background:#12102a`。
- 全屏尺寸实测：`ResizeObserver` 挂 `.nav-chart` → `fsSize` → viewBox 等于容器实际像素（字号才是真实 px）。

### 全屏入口 / 出口（用户确认的单出口设计）
- 入口：图表右上角悬浮 pill `⛶ 全屏`，`v-if="hasData && !isFullscreen"`
- 出口：顶栏右上角 pill `✕ 退出`（与入口同侧对称）。不做点遮罩关闭、不做 ESC。

### 全屏「细节更多」（用户勾选 4 项）
1. 字号/线宽/圆点整体放大：fs 15 / lw 2.6 / dr 4 / rr 7
2. X 刻度更密：step 3 / 7 / 15 / 30
3. 末端数值标签：三线末端右侧同色数值，`PAD.right=74` 留白防裁切
4. 触摸十字线 + tooltip：竖虚线 + 命中圆点 + HTML 卡片（右缘自动翻转到左侧，`TIP_W=168`）

### 全屏其余
- 图例行加基准摘要 `baseNote`（如 `08-25 起 · 8 次`），`v-if="s.baseNote && isFullscreen"`，卡片内不出现
- 说明文字双版本：全屏精简版 + 横向三格 grid；卡片保持原文案与彩色次数数字
- `@media (orientation: portrait)` 降级：说明降单列、字号 13

---

## 2. 横屏：用户追加要求「和持仓页 K 线全屏一样」

参考 `src/components/kline/KLineOverlay.vue:231-257`，照搬同款：

```js
function enterFullscreenApi() {
  const el = document.documentElement
  if (!el.requestFullscreen) return
  el.requestFullscreen()
    .then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {})
      }
    })
    .catch(() => {})
}

function exitFullscreenApi() {
  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock().catch(() => {})
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {})
  }
}
```

另加 `onFsChange()` 监听 `fullscreenchange`：系统手势（安卓 back、下拉）退出浏览器全屏时同步收掉 CSS 全屏，**否则遮罩会卡住、方向锁不释放**。

`onBeforeUnmount`：`ro.disconnect()` + 移除 `mqPortrait` / `fullscreenchange` 监听 + 仍在全屏时 `exitFullscreenApi()`。

**已知设备行为**
- Android Chrome：点全屏 → 真横屏
- iPhone Safari：不支持 `screen.orientation.lock`，静默保持竖屏 → 走 `@media (orientation: portrait)` 降级（字号 13、说明单列）

---

## 3. 对已确认规格的 4 处偏离（均为修 bug 或清理，非擅自改需求）

1. **删掉 `interactive` 字段** —— 计划里写了但无人读取（Task 10 Step 4 清理项）
2. **`isMonthStart` 加 `rule.step >= 7` 门槛** —— 计划原代码会让 step=3 密集刻度在 8/1、8/4、8/7 连刷三个「8月」
3. **删掉 hover 对象里未被模板读取的 `ts`** —— 零死代码
4. **补 `touch-action: pan-y` + `@pointercancel`** —— 手机横滑才能触发十字线；触摸取消时清理 hover

以及最初计划里记录的两处规格偏差（已在计划文档写明）：
- Y 步长不固定 0.5，改为按 `CH` 自适应、最小 0.5（0.5 固定在 220px 高的横版手机图表上会产出约 14 条重叠标签）
- 7/29 刻度改为「密集刻度网格直接对齐 7/29」（step=3 时与起点 7/28 标签仅隔约 17px 会重叠）

---

## 4. 明天要做的事

### 必须：人工验证（repo 无 playwright/puppeteer，我这边无法截图）
`npm run dev`，进趋势页需先输入 **4 位登录密码**（我不知道，需要用户给）。逐条过：

1. 卡片内：图例、折线、同心圆、7/29 刻度、说明文案、彩色次数数字与改动前一致（**零回归**）
2. 入口：图表右上角 `⛶ 全屏`；无数据时不显示
3. 全屏：整屏覆盖含底部 tabbar；顶栏 `✕ 退出`；图例行含摘要；图表占满；底部三格说明
4. 全屏细节：字号/线宽/圆点明显放大；X 刻度密度增加且含 7/29；末端数值标签不被右边缘裁切
5. tooltip：划过/触摸显示当日三线数值；右缘翻转；移出消失；卡片模式无反应
6. 退出：`✕ 退出` 回到卡片；无残留 hover
7. 横竖屏：竖屏底部说明降级为单列、字号 13；横屏三列
8. **横屏锁定**：Android 真横屏；系统 back / 下拉退出后遮罩不卡住、方向锁释放
9. 全屏内点 `↻` 能刷新基金数据并同步更新图表/图例/说明

### 然后：升版 + 提交
项目规则「先升版后推送」，位置：
- `package.json` 的 `version`（当前 `3.7.0`）
- `src/pages/SettingsPage.vue` 页面显示

这是新功能 → 升大版本（`3.8.0`）。

### git 状态注意
`src/components/fund/FundNavChart.vue` 是 **untracked（`??`）** —— 这个组件从创建至今从未提交过。所以：
- 它不会出现在 `git diff` / `git diff --stat` 里，容易误以为没改
- 提交时必须显式 `git add src/components/fund/FundNavChart.vue`
- 本次新增的三个文档同样是 `??`，需一并 add：
  - `docs/superpowers/plans/2026-09-10-nav-compare-fullscreen.md`（实现计划，10 个 Task）
  - `docs/superpowers/specs/2026-09-10-nav-compare-fullscreen-design.md`（已确认设计规格）
  - `docs/superpowers/handoffs/2026-09-10-nav-compare-fullscreen-handoff.md`（本交接文档）

工作区还有本任务之前的未提交改动（`.gitignore`、`src/main.js`、`src/pages/SettingsPage.vue`、`src/pages/TrendsPage.vue` 等 8 个文件），与本任务无关，**不要误提交或误回退**。

---

## 5. 关键代码路径速查

| 需求 | 位置 |
|------|------|
| 全套全屏逻辑 | `src/components/fund/FundNavChart.vue`（唯一改动文件，650 行） |
| 几何双套化 | 同上 `COMPACT` / `LARGE` / `withSize` / `G`，约 147-190 行 |
| 全屏 API | 同上 `enterFullscreenApi` / `exitFullscreenApi`，约 193-216 行 |
| 横屏参考实现 | `src/components/kline/KLineOverlay.vue:231-257` |
| 实现计划（10 Task） | `docs/superpowers/plans/2026-09-10-nav-compare-fullscreen.md` |
| 设计规格（已确认） | `docs/superpowers/specs/2026-09-10-nav-compare-fullscreen-design.md` |

### 图表业务事实（勿改错）
- `MINE = { name: '金枪不倒', color: '#ff4d6d' }`；`FUND_CODES = ['027730', '027317']`
- `MINE_BASE_DATE = '2026-07-29'`、`MINE_BASE_ASSET = 848405`（折线 100% 基准）
- `MINE_BASE_NOTE = '7/29 转户 848,405'`（全屏图例摘要）
- 快照精度：`src/utils/positionSnapshot.js:70` `asset: Math.round(asset)` → 快照资产为整数
- 快照关键值：7/28 = 818971（→96.53%）、7/29 = 848405（→100%）、7/30 = 845775（→99.69%）
- 2026-07-28 是周二，07-29 周三，08-03 周一（compact step=7 周一对齐 → 8/3、8/10；7/29 靠 `X_EXTRA_DATES` 追加）

### 项目环境
- Vue 3 `<script setup>` + Vant 4，**无测试框架**（`package.json` 只有 `dev` / `build` / `preview` / `generate-stocks`）
- 无 lint / typecheck 脚本 → 验证 = `npm run build` + 人工视觉
- z-index 阶梯：2 → 10(tabbar) → 20 → 200 → ~2000(Vant) → 9999(自写弹窗) → 10000(KLine / 本组件全屏)
- 暗色底 `#12102a` / 卡片 `#1e1b3a`；`--font-number` 在 `src/assets/styles/variables.css:45`
- Superpowers 已全局装在 `C:\Users\ll_gg\.agents\skills`（14 个技能，无需再装）
- `.superpowers/brainstorm/` 下有本次 brainstorm 的 mockup 历史；brainstorm 服务器已清理（端口 49671）
- 临时脚本 `C:\Users\ll_gg\AppData\Local\Temp\opencode\brainstorm-run.cmd` 可能还在，无影响
