# 资金页重构（资本管理）设计

日期：2026-08-11

## 背景

现有资金页结构：`fund-summary（总可用资金+股票总市值）→ 子池资金分配+增减资金池 → 校对核缺 → 资本变动记录`。重构目标：页面聚焦"资本"视角——投入了多少、现在市值、累计盈亏，把低频操作（增资/减资、变动明细）收进弹窗，并把校对核缺改为"输入券商账户资产自动生成差额"。

## 需求决策（用户确认）

| 维度 | 决定 |
|------|------|
| Tab / 题头 | 「资金」tab 改「资本」，题头「资金管理」改「资本管理」 |
| 资本投入 | = 外部资金净额（`totalCapital`），当前云数据 829,658.35 + 22,804.16 = **852,462.51**（已核实） |
| 现在市值 | = 持仓市价×数量，与其他页口径一致 |
| 累计盈利 | = **账户资产 − 资本投入** =（现在市值 + 可用资金）− 852,462.51；盈利→红「累计盈利」，亏损→绿「累计亏损」（涨红跌绿） |
| 资本增减 | 按钮 → 弹窗（现"增减资金池"功能），增资青 / 减资红 |
| 变动明细 | 按钮 → 弹窗（现"资本变动记录"列表，含编辑/删除） |
| 校对核缺输入 | 输入券商「账户资产」（总资产 = 现金+持仓市值），自动算 `差额 = 券商账户资产 − 系统账户资产`，差额≠0 才可保存 |
| 校对核缺时段 | 交易日（周一~周五）9:00–15:30 **禁输入 + 红色强提示**，收盘后可操作 |

## 页面结构（重构后）

```
资本管理（FundPage）
├─ CapitalSummary       资本统计卡：资本投入 / 现在市值 / 累计盈利
│                        + [资本增减] [变动明细] 两个并排按钮
├─ FundAllocationForm   子池资金分配（瘦身：只留分配，删增减资金池卡片）
└─ AdjustmentPanel      校对核缺（改为券商账户资产自动差额 + 独立明细列表）

弹窗（Teleport）：
├─ CapitalChangeDialog  增资/减资（从 FundAllocationForm 抽出）
└─ CapitalDetailDialog  资本变动记录（内嵌 CapitalLogList）
```

## 组件拆分

### 新增 `src/components/fund/CapitalSummary.vue`
- Props：`totalCapital: Number`、`marketValue: Number`、`totalAvailable: Number`
- 计算：`cumPnl = (marketValue + totalAvailable) − totalCapital`
- 展示：
  - 资本投入（`num-mono`，白）
  - 现在市值（`num-mono`，白）
  - 累计盈利：`cumPnl >= 0` → 红 `--color-rise` 文案「累计盈利」+`+金额`；`cumPnl < 0` → 绿 `--color-fall` 文案「累计亏损」+`−金额`
- 按钮：`emit('open-change')`、`emit('open-detail')`
- 样式：复用 `fund-summary` / `fs-row` 卡片风格，三行 + 按钮行（`display:flex; gap:10px`，各占 `flex:1`）

### 新增 `src/components/fund/CapitalChangeDialog.vue`
- 从 FundAllocationForm 61-72 行「增减资金池」card + 确认弹窗逻辑抽出
- 结构：金额输入（`big-input`）+ 「增资 ➕」青 /「减资 ➖」红 → 备注确认弹窗
- Emit：`capital-change`（`{type, amount, note}`）→ FundPage 复用现有 `onCapitalChange`
- 顶部标题「资本增减」+ 关闭按钮

### 新增 `src/components/fund/CapitalDetailDialog.vue`
- Teleport 弹窗，标题「资本变动记录」+ × 关闭
- 内嵌现有 `CapitalLogList :logs="capitalLogs"`，透传 `@delete`/`@edit`

### `src/components/fund/FundAllocationForm.vue` 瘦身
- 删除「增减资金池」card（模板 61-72 行）及其相关 `deltaAmount/doCapital/submitCapital/capType/capAmount/capNote/showCapitalConfirm` 脚本
- 保留「子池资金分配」card + 确认分配弹窗 + `capital-change` emit 移除（FundPage 不再传该监听）

### `src/components/fund/AdjustmentPanel.vue` 改造
- 删除手动差额输入 + 「校对核缺 +/−」按钮
- 改为：
  - 输入「券商账户资产（元）」（`big-input`）
  - 计算 `diff = brokerAsset − systemAsset`（`systemAsset = marketValue + totalAvailable`，由 FundPage 传入 Props）
  - 「生成校对核缺」按钮：`diff === 0` → 提示「系统与券商一致，无需校对」；`diff !== 0` → 确认弹窗显示「校对核缺 +X / −X」+ 日期 + 备注，保存 `type = diff>0?'add':'remove'`, `amount = |diff|`
- **交易时段强锁**：
  - `const blocked = isWeekday && h>=9 && h<15:30`（`new Date().getDay()∈[1,5]`，`hour*60+minute ∈ [540, 930)`）
  - blocked → 输入 `disabled` + 顶部红色横幅「⛔ 交易时段内禁止校对核缺，请在 15:30 收盘后操作」
  - 注：法定节假日系统仍按工作日判断，提示文案补充「如遇法定休市日以券商为准」不额外实现节假日日历（YAGNI）
- 保留下方独立列表明细 + ✏️编辑/✕删除（编辑仍直接改金额/备注/日期，语义不变）

### `src/pages/FundPage.vue`
- 题头「资金管理」→「资本管理」
- 替换顶部 `fund-summary` 为 `<CapitalSummary :total-capital total-market-value :total-available @open-change @open-detail />`
- 挂载 `CapitalChangeDialog` / `CapitalDetailDialog`，用 `ref` 控制显示
- `AdjustmentPanel` 新增 Props：`marketValue`、`totalAvailable`（算系统账户资产）
- `onCapitalChange`/`onEditLog`/`onDeleteLog`/`onAdjustChange`/`onAdjustEdit` 不变

### Tab / 标题
- `MainLayout.vue:12`「资金」→「资本」
- `router/index.js:44` `meta.title: '资金'` → `'资本'`
- 路由 `name: 'fund'` 不变（routeMap 依赖）

## 数据 / 语义（不变）

- `totalCapital` getter 不变（排除 `category='adjust'`）
- `totalAvailable` getter 不变（含校对核缺净额）
- 校对核缺仍不进资本变动记录、不进趋势 capitalChange 快照、不进趋势资本明细（`category='adjust'` 过滤已就绪）
- 资本投入 = `totalCapital` = 852,462.51（现有 getter 直接复用，无需新增）

## 边界情况

| 场景 | 处理 |
|------|------|
| 差额 = 0 | 阻止保存，提示无需校对 |
| 交易时段内 | 输入禁用 + 红色强提示，无法打开确认弹窗 |
| 校对核缺已有多条 | 系统账户资产已含历史 adjust，差额 = 剩余差异（增量对账），语义正确 |
| 股价 60 分钟缓存 | 允许输入时段为非交易时段（收盘后），价格取最新收盘，误差可接受 |
| 无 adjust 记录（当前） | 系统账户资产 = 市值 + 可用资金，差额即首次对账差异 |

## 不做

- 不新增节假日日历（以星期判断交易日 + 文案提示）
- 不增加"手动录入差额"的并行入口（账户资产输入已覆盖；已有 adjust 记录仍可编辑）
- 不改 `totalCapital`/`totalAvailable`/`positionSnapshot`/`TrendsPage` 现有逻辑
- 不重排其它 tab（持仓/仓位/交易/榜单/设置不动）

## 验证

```bash
npm run build   # 构建通过
npm run dev     # 手动验证：
# 1. 底部 tab 显示「资本」，题头「资本管理」
# 2. 顶部三行：资本投入 852,462.51 / 现在市值 / 累计盈利(账户资产−资本投入，红/绿)
# 3. 「资本增减」弹窗可增资/减资，保存后数据正确
# 4. 「变动明细」弹窗显示资本变动记录，编辑/删除正常
# 5. 校对核缺输入券商账户资产 → 自动算差额 → 确认保存；差额0被拦截
# 6. 交易日 9:00–15:30 输入禁用+红色强提示（可临时改系统时间验证）
```
