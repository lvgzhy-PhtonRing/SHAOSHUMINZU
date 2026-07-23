// src/utils/crypto.js
// 密码哈希工具 — 防止明文密码存储在 localStorage
// 使用 Web Crypto API SHA-256

/**
 * 对密码进行 SHA-256 哈希
 * @param {string} pwd - 明文密码
 * @returns {Promise<string>} 64 位十六进制哈希值
 */
export async function hashPassword(pwd) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pwd)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 判断字符串是否已经是 SHA-256 哈希值
 */
export function isHashed(s) {
  return /^[0-9a-f]{64}$/.test(s)
}
