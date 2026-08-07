// src/utils/feeCalculator.js
// 买入：券商佣金 0.0854‰，最低 5 元
// 卖出：券商佣金 0.0854‰ + 印花税 0.5‰ + 过户费 0.01‰ = 0.5954‰，最低 5 元

const BROKER_RATE = 0.0000854
const STAMP_RATE = 0.0005     // 印花税（仅卖出）
const TRANSFER_RATE = 0.00001 // 过户费（仅卖出）
const SELL_RATE = BROKER_RATE + STAMP_RATE + TRANSFER_RATE
const MIN_FEE = 5

/** 计算买入手续费 */
export function calcBuyFee(amount) {
  const fee = Math.round(amount * BROKER_RATE * 100) / 100
  return Math.max(fee, MIN_FEE)
}

/** 计算卖出手续费（含佣金+印花税+过户费） */
export function calcSellFee(amount) {
  const fee = Math.round(amount * SELL_RATE * 100) / 100
  return Math.max(fee, MIN_FEE)
}

/** 买入：计算含手续费的实际金额和成本价 */
export function calcBuyActual(amount) {
  const fee = calcBuyFee(amount)
  return { fee, actualAmount: parseFloat((amount + fee).toFixed(2)) }
}

/** 卖出：计算扣除费用后的实际到账金额 */
export function calcSellActual(amount) {
  const fee = calcSellFee(amount)
  return { fee, actualAmount: parseFloat((amount - fee).toFixed(2)) }
}

/** @deprecated 保留兼容，默认按买入计算 */
export function calcFee(amount) {
  return calcBuyFee(amount)
}

/** @deprecated 保留兼容，默认按买入计算 */
export function calcActualAmount(amount) {
  return calcBuyActual(amount)
}

/** 计算含手续费的每股成本 */
export function calcCostPrice(amount, quantity) {
  if (!quantity || quantity <= 0) return 0
  const { actualAmount } = calcBuyActual(amount)
  return parseFloat((actualAmount / quantity).toFixed(3))
}
