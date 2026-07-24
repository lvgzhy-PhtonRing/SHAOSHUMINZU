// src/api/supabase.js
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/utils/crypto'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not set. Using mock mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

/* 密码验证（兼容旧版 Base64，优先 SHA-256） */
export async function verifyPassword(input) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'password_hash')
    .single()
  if (error) return false
  const stored = data.value
  // 新版：SHA-256 哈希
  if (/^[0-9a-f]{64}$/.test(stored)) return stored === await hashPassword(input)
  // 旧版兼容：Base64
  return stored === btoa(input)
}

/* 获取所有子池 */
export async function fetchPools() {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .order('sort_order')
  return error ? [] : data
}

/* 获取持仓 */
export async function fetchHoldings() {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
  return error ? [] : data
}

/* 获取交易记录 */
export async function fetchTransactions(limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return error ? [] : data
}

/* 获取资金变动记录 */
export async function fetchCapitalLogs() {
  const { data, error } = await supabase
    .from('capital_log')
    .select('*, pools(name)')
    .order('created_at', { ascending: false })
  return error ? [] : data
}

/* 查询子池+股票的完整交易记录（用于重算持仓） */
export async function fetchTransactionsByPoolStock(poolId, stockCode) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('pool_id', poolId)
    .eq('stock_code', stockCode)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

/* 录入交易 */
export async function insertTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([tx])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新交易 */
export async function updateTransaction(id, updates) {
  const { error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除交易 */
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 插入资金变动 */
export async function insertCapitalLog(log) {
  const { data, error } = await supabase
    .from('capital_log')
    .insert([log])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新资金记录（capital_log 表无 updated_at 列） */
export async function updateCapitalLog(id, updates) {
  const { error } = await supabase
    .from('capital_log')
    .update(updates)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除资金记录 */
export async function deleteCapitalLog(id) {
  const { error } = await supabase.from('capital_log').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 更新持仓 */
export async function upsertHolding(holding) {
  const { data, error } = await supabase
    .from('holdings')
    .upsert(holding, { onConflict: 'pool_id,stock_code' })
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 删除持仓（清仓时） */
export async function deleteHolding(poolId, stockCode) {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('pool_id', poolId)
    .eq('stock_code', stockCode)
  if (error) throw new Error(error.message)
}

/* 获取行情缓存 */
export async function fetchStockCache() {
  const { data, error } = await supabase.from('stock_cache').select('*')
  return error ? [] : data
}

/* 更新行情缓存 */
export async function upsertStockCache(cache) {
  const { error } = await supabase
    .from('stock_cache')
    .upsert(cache, { onConflict: 'stock_code' })
  if (error) console.error('Cache update error:', error)
}

/* 保存子池分配金额到服务器（跨设备同步） */
export async function savePoolAllocation(amounts) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'pool_amounts', value: JSON.stringify(amounts) })
  if (error) throw new Error(error.message)
}

/* 加载子池分配金额 */
export async function loadPoolAllocation() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'pool_amounts')
    .single()
  if (error || !data) return null
  try { return JSON.parse(data.value) } catch { return null }
}

/* 更新密码（自动 SHA-256 哈希后存入服务器） */
export async function updatePassword(plainPwd) {
  const hashed = await hashPassword(plainPwd)
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'password_hash', value: hashed })
  return !error
}

/* 保存仓位/资产快照（日期去重） */
export async function savePositionSnapshot(date, data) {
  const payload = typeof data === 'object'
    ? data
    : { ratio: data }  // 兼容旧调用方式
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: `pos_snap:${date}`, value: JSON.stringify(payload) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/* 读取最近 N 条快照（含资产 & 资金变动） */
export async function fetchPositionSnapshots(limit = 10) {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .like('key', 'pos_snap:%')
    .order('key', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
    .map(d => {
      const parsed = JSON.parse(d.value)
      return {
        date: d.key.replace('pos_snap:', ''),
        ratio: parsed.ratio,
        asset: parsed.asset,
        capitalChange: parsed.capitalChange || 0,
        updatedAt: parsed.updatedAt || null
      }
    })
    .reverse()
}

/* 校对交易 */
export async function verifyTransaction(id, actualAmount) {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'verified', actual_amount: actualAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
