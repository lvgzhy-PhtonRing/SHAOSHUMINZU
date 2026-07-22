// src/utils/validators.js

export function isValidStockCode(code) {
  return /^\d{6}$/.test(code)
}

export function isValidQuantity(qty) {
  const n = parseInt(qty)
  return !isNaN(n) && n > 0 && n % 100 === 0  // A股整手交易
}

export function isValidPrice(price) {
  const n = parseFloat(price)
  return !isNaN(n) && n > 0
}

export function isValidAmount(amount) {
  const n = parseFloat(amount)
  return !isNaN(n) && n > 0
}

export function isValidPassword(pwd) {
  return /^\d{4}$/.test(pwd)
}

export function sumEquals(arr, target) {
  const total = arr.reduce((s, v) => s + (parseFloat(v) || 0), 0)
  return Math.abs(total - target) < 0.01
}
