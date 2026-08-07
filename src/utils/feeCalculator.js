// src/utils/feeCalculator.js
// 手续费自动计算：成交金额 × 0.0845%，最低 5 元

const FEE_RATE = 0.000845
const MIN_FEE = 5

/** 计算单笔交易手续费 */
export function calcFee(amount) {
  const fee = Math.round(amount * FEE_RATE * 100) / 100
  return Math.max(fee, MIN_FEE)
}

/** 计算含手续费的实际金额和成本价 */
export function calcActualAmount(amount) {
  const fee = calcFee(amount)
  return { fee, actualAmount: parseFloat((amount + fee).toFixed(2)) }
}

/** 计算含手续费的每股成本 */
export function calcCostPrice(amount, quantity) {
  if (!quantity || quantity <= 0) return 0
  const { actualAmount } = calcActualAmount(amount)
  return parseFloat((actualAmount / quantity).toFixed(3))
}
