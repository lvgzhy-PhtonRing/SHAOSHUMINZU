# 子池资金分配模块重建 — 设计文档

> **For agentic workers:** 本设计经用户逐项确认后，转入 writing-plans 生成实现计划。

**日期:** 2026-08-11
**状态:** 已获用户批准（方案 B：拆 Summary + Editor 两个组件；联动 = 一根共享滑杆等额；编辑层 = 全屏弹层）

---

## 1. Goal

重建资金页「子池资金分配」模块，解决当前问题：
1. 分配表单直接铺在页面上，容易误触 → 改为**默认只读结果，编辑进入第二层全屏弹层**；
2. 联动调整以 1.0 万为单位、用**拖动条（滑杆）**而非 ±/数字输入；
3. 强制保证 **5 个子池可用资金恒 > 0**（四人下限 = 持仓成本；公共池 = 剩余也须 > 0）；
4. 顺带统一**仓位分析页**的数据源（当前硬编码每人 11 万）。

## 2. 核心模型（关键前提）

**分配 = 初始金额**（基线配置），存在 `app_config.pool_amounts`，**不写入 capital_log**，因此调整分配**不影响任何历史盈亏**（需求 5、6）。

对每个子池：
```
可用资金 = 初始分配 − 持仓成本         （资金分配/交易页模型）
```
其中 持仓成本 = Σ(cost_price × quantity)，`poolCosts` 以子池名为 key。

**两套模型等价性（已核实）：** 持仓分析页的 `可用 = 初始分配 + 卖出到账 − 买入支出` 与上式数值相等（因持仓成本 = 买入支出 − 卖出到账）。故统一数据源只需把"初始分配"改为读配置，**不动算法**。

## 3. 组件结构（方案 B）

| 文件 | 职责 |
|------|------|
| `src/components/fund/FundAllocationSummary.vue`（新建） | 第一层：只读结果卡。显示总可用 + 五行（公共池 + 春/维/队/回）的 初始分配(万) / 可用资金(元) / 持仓成本；底部「✏️ 调整分配」按钮 |
| `src/components/fund/FundAllocationEditor.vue`（新建） | 第二层：全屏弹层编辑。联动开关 + 滑杆（联动=1根共享，独立=4根）+ 派生值 + 校验 + 保存/取消 |
| `src/pages/FundPage.vue`（修改） | 持有 `allocation` 状态（onMounted 加载：服务器 → localStorage → 默认均分）；组合 Summary + Editor；`onAllocSave` 负责持久化 |
| `src/pages/PositionsPage.vue`（修改） | `poolInitial` 改为读 `pool_amounts` 配置，无配置回退 11 万 |
| `src/components/fund/FundAllocationForm.vue`（删除） | 被上面两个组件取代 |

### 数据流

```
FundPage.allocation (ref, 元)  ──:allocation──▶  Summary（只读渲染）
        ▲                                    │
        │ onAllocSave(config)                │ @edit（打开编辑层）
        │ savePoolAllocation + localStorage  ▼
        └───────────────────────────── FundAllocationEditor
                                        :allocation / :pool-costs / :total-available
                                        @save(config) / @close
```

## 4. 第一层 Summary（只读结果）

- 卡标题「子池资金分配」，副标题显示「总可用资金 ¥X」（X = totalAvailable）。
- 五行子池：公共池排首（wide），后四人。每行：彩色圆点 + 子池名 + **初始分配（万，1位小数）** + **可用资金（元）** + 可选⚠️（可用≤0 时——正常由约束保证不会出现）。
- 底部醒目按钮「✏️ 调整分配」→ emit `edit`。
- Props：`allocation`（{公共池,春,维,队,回}，元）、`poolCosts`、`totalAvailable`。

## 5. 第二层 Editor（全屏弹层）

- 复用现有自定义 `.overlay`（position:fixed; inset:0）+ 全屏 `.dialog`（高度≈100vh，内部可滚动），与校对核缺/资本明细弹窗风格一致。×/取消/遮罩 → emit `close`，**放弃草稿**（编辑器不持久化自身状态，关闭后重开重新从 props 初始化）。

### 5.1 联动开关

- 顶部「🔗 四人联动」切换，**默认开**。开 = 四人等额；关 = 四人独立。
- **联动开 → 关**：直接进入四根独立滑杆，各取当前值。
- **联动关 → 开**：`shared = max(四人当前分配)`（不低于任何人当前值），再钳制到合法区间 `[floor_shared, V_max]`。

### 5.2 滑杆（Vant `van-slider`）

- 步进 `STEP = 10000`（1万），值域为元，显示为「X.X 万」。
- **联动开**：一根滑杆「每人初始分配」，四人同步。
- **联动关**：四根滑杆（春/维/队/回），每根下方显示该子池「可用资金」。

### 5.3 约束（严格 >0，用户已确认）

对四人（`poolCosts['春']` 等）：
```
floor_i = Math.ceil((持仓_i + 1) / 10000) * 10000    // 每人可用恒 ≥ 1 元
```
公共池（持仓 = `poolCosts['公共池']`）：
```
cap = totalAvailable − 公共池持仓                       // 四人合计上限（元）
公共池可用 = totalAvailable − Σ四人分配 − 公共池持仓      // 须 > 0
```
- **联动开**：共享值范围 `[floor_shared, V_max]`，其中
  `floor_shared = max(floor_i)`，`V_max = floor((cap − 1) / 4 / 10000) * 10000`。
- **联动关**：每根滑杆范围 `[floor_i, max_i]`，拖动某根时
  `max_i = floor((cap − 1 − Σ其他三人当前值) / 10000) * 10000`（动态收紧，累计不超上限）。
- **不可行兜底**：若 `floor_shared > V_max`（联动）或 `Σ floor_i > cap`（独立）或 `cap ≤ 0` → 红字错误「持仓下限超过可分配上限」，禁用保存。

### 5.4 派生显示与保存

- 实时显示：四人合计、公共池分配（= totalAvailable − Σ四人分配）、公共池可用。
- 「保存分配」→ 组装 `{公共池: 公共池分配, 春, 维, 队, 回}`（元）→ emit `save(config)` → 关闭。
- `FundPage.onAllocSave(config)`：`savePoolAllocation(config)` + `localStorage.setItem('poolAmounts', ...)` + 更新 `allocation` ref。

## 6. 仓位分析页统一（用户已确认顺带做）

- 删除硬编码 `SUB_POOL_INIT = 110000` 用于初始分配的部分。
- `onMounted` 中 `loadPoolAllocation()` 读配置 → `poolInitial[p.id] = config[p.name]`。
- **无配置回退**：四人 = 110000，公共池 = `totalCapital − 110000*4`（即当前行为）。
- `可用 = 初始分配 + 卖出到账 − 买入支出` 的算法**保持不变**（仅基线来源变化）。

## 7. 默认分配（无配置兜底）

`FundPage` 加载分配失败（无服务器数据、无 localStorage）时：
```
每人 = floor(totalAvailable / 5 / 10000) * 10000    // 约均分
公共池 = totalAvailable − 四人合计
```

## 8. 交易页 / 盈亏

- **交易页买入校验不变**：仍读 `pool_amounts`，逻辑不变。
- **盈亏/总资本/总可用计算不变**：分配不写 capital_log，所有 getter 不受影响。

## 9. 版本号

`2.9.81 → 2.9.82`（`package.json` + `src/pages/SettingsPage.vue`），遵守用户"极小递增"约定。

## 10. 不做改动

- 不改 `supabase.js`（`savePoolAllocation` / `loadPoolAllocation` 已存在且够用）。
- 不改交易页任何逻辑。
- 不改 capital_log / funds store。
- 不做"按百分比分配"或"分配资金池联动 P&L 自动调整"等预测性功能（YAGNI）。

## 11. 边界情况清单

| 场景 | 行为 |
|------|------|
| 子池无持仓 | 下限 = 1万（可用恒 ≥ 1 元） |
| 持仓恰为整万 | 下限再 +1万，避免可用=0 |
| 四人持仓下限之和 > cap | 红字错误，禁用保存 |
| 联动开时 floor_shared > V_max | 同上 |
| 公共池持仓 ≥ totalAvailable | cap ≤ 0，同上 |
| 编辑中途关闭 | 放弃草稿，重开读 props 重新初始化 |
| 无任何已存配置 | 默认均分（§7） |
