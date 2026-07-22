// src/api/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not set. Using mock mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

/* 密码验证 */
export async function verifyPassword(input) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'password_hash')
    .single()
  if (error) return false
  return data.value === btoa(input)
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

/* 插入资金变动 */
export async function insertCapitalLog(log) {
  const { data, error } = await supabase
    .from('capital_log')
    .insert([log])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新资金记录 */
export async function updateCapitalLog(id, updates) {
  const { error } = await supabase
    .from('capital_log')
    .update({ ...updates, updated_at: new Date().toISOString() })
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

/* 更新密码 */
export async function updatePassword(newHash) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'password_hash', value: newHash })
  return !error
}

/* 校对交易 */
export async function verifyTransaction(id, actualAmount) {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'verified', actual_amount: actualAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
