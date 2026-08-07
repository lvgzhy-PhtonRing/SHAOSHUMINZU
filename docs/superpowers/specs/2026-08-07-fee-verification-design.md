# 手续费校对系统设计

## Context

当前系统在买入/卖出后有第二步「填入券商实际金额」，但该步骤从未被真正使用（云端 8 笔交易 fee 全为 0，actual_amount = amount）。券商真实成交金额不是实时显示的（需后查询，且多为多位小数），用金额对比的方式不实用。

改为通过**持仓成本价校对**来体现手续费：用户对比软件成本价与券商 APP 成本价，手动修改来校准。

## 设计概览

```
用户买入/卖出 → 交易直接生效 (fee=0)
       ↓
持仓页显示系统成本价
       ↓
用户对比券商APP成本价 → 点击「校对持仓成本」
       ↓
输入券商成本价 → 系统计算差值
       ↓
更新 cost_price + fee + actual_amount + capital_log
```

## 详细设计

### 1. 移除交易校对步骤

**TradePage.vue：**
- 买入：`onBuySubmit` 后直接调用 `confirmBuy` 逻辑，不再进入 `pendingBuy` 状态
- 卖出：`submitSell` 后直接调用 `confirmSell` 逻辑，不再进入 `pendingTrades` 状态
- 删除 `pendingBuy`、`buyActualAmount`、`pendingTrades`、`sellActualAmount` 相关状态和模板
- 交易创建时：`status = 'verified'`，`actual_amount = amount`，`fee = 0`
- `capital_log` 记录 `amount`（预估金额，与交易一致）
- 持仓成本按预估金额计算

**TradeForm.vue：**
- 买入表单的 placeholder 从「含手续费」改为「输入成交总金额」
- 移除 `VerificationCard.vue` 组件（不再使用）

### 2. 持仓成本校对

**HoldingsCard / Dashboard 持仓列表：**

每只持仓股票旁增加按钮，条件：
- 按钮文案：「校对持仓成本」
- 仅买入方向持仓显示（该股票有 `type='buy'` 且 `fee = 0` 的未校对交易时显示）
- 如果全部交易已校对，显示「✓ 已校对」灰色文字

**校对弹窗（新增组件 `FeeVerifyDialog.vue`）：**

```
┌──────────────────────────────────┐
│ 校对手续费                        │
│                                   │
│ 股票：002340 格林美                │
│ 持仓：17000 股                     │
│                                   │
│ 系统成本价    ¥6.466               │
│ 券商成本价    [________] 元/股     │
│                                   │
│ ────────────────────────────────  │
│ 差额 ¥0.084 × 17000 股            │
│ = 手续费 ¥1,428.00                │
│                                   │
│ 备注（可选）[________]             │
│                                   │
│ [取消]  [✅ 确认校对]              │
└──────────────────────────────────┘
```

**确认后操作（按顺序）：**

1. 计算 `totalFee = (券商成本价 - 系统成本价) × 持仓数量`
2. 更新 `holdings.cost_price = 券商成本价`
3. 将该股票所有 `fee = 0` 的买入交易按数量比例分配手续费：
   - 每笔交易 `fee = totalFee × (tx.quantity / totalQuantity)`（保留两位小数）
   - 每笔交易 `amount = amount + fee`（更新为含手续费的总金额）
   - 每笔交易 `actual_amount = amount`（与 amount 同步）
4. 对应更新 `capital_log`（修改原买入记录，将手续费并入）：
   - 每笔买入的 `capital_log.amount = 原金额 + 该笔分配的 fee`
   - 备注追加 ` [已校对]`
5. 刷新持仓 + 交易记录 + 资金记录
6. Toast 提示「✅ 已校对，手续费 ¥xxx」

**不在 capital_log 新建记录。** 手续费直接合并到原买入资金记录中。

### 3. 卖出拦截

**TradePage.vue — 进入卖出页时：**

检查该股票是否有未校对买入交易（`type='buy'` 且 `fee = 0`）。如有，弹出确认框：

```
┌──────────────────────────────┐
│ ⚠️ 持仓成本未校对              │
│                               │
│ 300736 百邦科技 存在未校对     │
│ 的买入交易（共 3 笔）。        │
│ 请先在持仓页面校对成本后再卖出。│
│                               │
│ [知道了]  [去校对]             │
└──────────────────────────────┘
```

- 「知道了」→ 关闭弹窗，停留在交易页（不进入卖出流程）
- 「去校对」→ 跳转到持仓页

**判断逻辑：**
```js
const unverifiedTxs = txStore.transactions.filter(
  t => t.stock_code === stockCode && t.type === 'buy' && (t.fee === 0 || t.fee === null)
)
if (unverifiedTxs.length > 0) { /* 拦截 */ }
```

### 4. 交易记录标识

**TradePage.vue 交易记录列表：**

每笔交易根据 `fee` 显示校对状态：
- `fee !== 0` → 整行背景微变（如左边框绿色），金额旁显示 `(含手续费 ¥xx)` ，名称后显示 `✓已校对`
- `fee === 0` 且是买入 → 正常显示
- 卖出交易 → 不校验（卖出不需要校对成本）

### 5. 资金页面

**FundPage / CapitalLogList：**

校对后原买入资金记录的 `amount` 增加手续费部分，备注追加 `[已校对]`。

例如：买入 300736 1000 股 ¥10,000 → 校对手续费 ¥50 → 记录变为 ¥10,050，备注 `买入 300736 [已校对]`

资金页面不需要额外改动，现有资金记录自动反映更新后的金额。

### 6. 数据变更汇总

| 操作 | holdings | transactions | capital_log |
|---|---|---|---|
| 买入 | cost_price 按预估金额 | amount=预估, fee=0 | remove 预估金额 |
| 卖出 | 减仓 | amount=预估, fee=0 | add 预估金额 |
| 校对成本 | cost_price 更新 | amount+=fee, fee 分配 | 原记录 amount 同步增加，追加 [已校对] |

## 文件修改清单

| 文件 | 改动 |
|---|---|
| `src/pages/TradePage.vue` | 移除校对步骤，买入/卖出直接生效；卖出前拦截检查 |
| `src/components/common/HoldingCard.vue` | 新增「校对持仓成本」按钮 + 已校对标识 |
| `src/components/holdings/FeeVerifyDialog.vue` | **新建**：校对弹窗组件 |
| `src/components/trade/VerificationCard.vue` | 删除（不再使用） |
| `src/pages/DashboardPage.vue` | 传递校对回调，刷新后更新状态 |
| `src/stores/holdings.js` | 新增 `verifyHoldingCost` action |
| `src/api/supabase.js` | 新增 `verifyHoldingCost` API 函数 |

## 边界情况

- 多次买入同一股票：校对时所有未校对交易按数量分配手续费
- 部分卖出后再校对：只校对当前持仓，按当前持仓数量计算总手续费。已卖出的部分不参与计算（卖出前必须已校对，所以正常流程不会出现此情况）
- 已全部卖出（持仓为 0）：不显示校对按钮
- 券商成本价 = 系统成本价：提示「成本价一致，无需校对」
- 券商成本价 < 系统成本价（负手续费，如返佣）：允许，fee 为负数
