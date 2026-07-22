// src/utils/calculators.js

/**
 * 计算盈亏 = (现价 - 成本价) × 持仓数量
 */
export function calcProfit(currentPrice, costPrice, quantity) {
  if (!currentPrice || !costPrice || !quantity) return 0
  return (currentPrice - costPrice) * quantity
}

/**
 * 计算涨跌幅% = (现价 - 昨收) / 昨收 × 100
 */
export function calcChangePct(currentPrice, prevClose) {
  if (!currentPrice || !prevClose || prevClose === 0) return 0
  return ((currentPrice - prevClose) / prevClose) * 100
}

/**
 * 计算仓位比例 = 总市值 / 总资产 × 100
 */
export function calcPositionRatio(totalMarketValue, totalAsset) {
  if (!totalMarketValue || !totalAsset || totalAsset === 0) return 0
  return (totalMarketValue / totalAsset) * 100
}

/**
 * 计算持仓成本均价 = 总投入金额 / 总持仓数量
 * 买入时：新均价 = (原持仓金额 + 买入金额) / (原数量 + 买入数量)
 * 卖出时：均价不变，减少数量
 */
export function calcNewCostPrice(buyAmount, buyQuantity, currentQuantity, currentCostPrice) {
  const totalCost = (currentCostPrice || 0) * (currentQuantity || 0) + buyAmount
  const totalQty = (currentQuantity || 0) + buyQuantity
  return totalQty > 0 ? totalCost / totalQty : 0
}
