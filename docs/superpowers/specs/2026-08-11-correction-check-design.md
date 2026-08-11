# 校对核缺（账实核对修正）设计

日期：2026-08-11

## 背景

系统计算的可用资金与券商实际余额对不上时（分红、手续费差、中签扣款等未记录资金流动），需要一笔修正记录让系统对上券商。这类记录称为「校对核缺」。

## 需求决策（用户确认）

| 维度 | 决定 |
|------|------|
| 场景 | 对比券商/真实余额，差额记 ± 修正 |
| 数值影响 | 只调可用资金/总资产，**不进总资本** |
| 录入入口 | 资金页新增独立卡片「校对核缺」（+/-按钮 + 金额 + 日期 + 备注） |
| 趋势总览 | 不显示（不触发"!"、不进底部资金变动明细） |
| 列表管理 | 「资金变动记录」改名「资本变动记录」只显示增资/减资/初始；校对核缺有**独立列表明细**，单独管理（类似股票交易明细） |

## 数据模型

`capital_log` 新增 `category` 列：

```sql
ALTER TABLE capital_log
  ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'capital';
```

- `capital`：增资/减资/初始（外部资本变动）
- `adjust`：校对核缺（pool_id=null，type=add/remove，带金额+日期+备注）

现有记录全部默认 `capital`，无需回填。

## 数值计算（funds.js）

- **总资本 totalCapital** = 只算 `pool_id=null AND category='capital'` 的 add−remove
- **可用资金 totalAvailable** = 总资本 + 校对核缺净额（`category='adjust'` 的 add−remove）+ 卖出到账 − 买入支出
- **总资产** = 持仓市值 + 可用资金（自动含校对核缺）

## 全局过滤

| 位置 | 改动 |
|------|------|
| `positionSnapshot.js` capitalChange | 排除 `category='adjust'` |
| `TrendsPage.vue` capitalDetailList | 排除 `category='adjust'` |
| `FundPage.vue` capitalLogs | 过滤 `category !== 'adjust'` 给资本变动记录列表 |

## 界面

### FundPage 新卡片「校对核缺」
- 金额输入 + 「校对核缺+」/「校对核缺-」按钮
- 确认弹窗：金额 + 日期（默认今天）+ 备注
- 独立列表明细（日期+类型+备注+金额，可编辑/删除）
- 保存后刷新当日快照资产

### 资本变动记录列表
- 标题由「资金变动记录」改为「资本变动记录」
- 只显示 增资/减资/初始（过滤掉 adjust）

## 不做

- 不改股票交易流程
- 不改 TrendPage / TradePage
- 校对核缺不进趋势总览
- 不自动校验差额（自由录入）
