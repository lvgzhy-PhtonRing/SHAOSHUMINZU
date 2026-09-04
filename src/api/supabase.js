// src/api/supabase.js
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/utils/crypto'
import { isMockMode, getTable, setTable, getConfigValue, setConfigValue, insertRow, updateRows, deleteRows } from './mockDb'

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
  if (isMockMode()) {
    const stored = getConfigValue('password_hash')
    if (!stored) return false
    if (/^[0-9a-f]{64}$/.test(stored)) return stored === await hashPassword(input)
    return stored === btoa(input)
  }
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'password_hash')
    .single()
  if (error) throw new Error(`verifyPassword: ${error.message}`)
  const stored = data.value
  // 新版：SHA-256 哈希
  if (/^[0-9a-f]{64}$/.test(stored)) return stored === await hashPassword(input)
  // 旧版兼容：Base64
  return stored === btoa(input)
}

/* 获取所有子池 */
export async function fetchPools() {
  if (isMockMode()) {
    return getTable('pools').slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .order('sort_order')
  return error ? [] : data
}

/* 获取持仓 */
export async function fetchHoldings() {
  if (isMockMode()) return getTable('holdings')
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
  return error ? [] : data
}

/* 获取交易记录 */
export async function fetchTransactions(limit = 50) {
  if (isMockMode()) {
    return getTable('transactions')
      .slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, limit)
  }
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return error ? [] : data
}

/* 获取资金变动记录 */
export async function fetchCapitalLogs() {
  if (isMockMode()) {
    const pools = getTable('pools')
    return getTable('capital_log')
      .slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .map(l => ({
        ...l,
        pools: l.pool_id !== null && l.pool_id !== undefined
          ? pools.find(p => p.id === l.pool_id) || null
          : null
      }))
  }
  const { data, error } = await supabase
    .from('capital_log')
    .select('*, pools(name)')
    .order('created_at', { ascending: false })
  return error ? [] : data
}

/* 获取全部交易记录（不限条数，用于清仓盈亏计算） */
export async function fetchAllTransactions() {
  if (isMockMode()) return getTable('transactions')
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)
  return error ? [] : data
}

/* 查询子池+股票的完整交易记录（用于重算持仓） */
export async function fetchTransactionsByPoolStock(poolId, stockCode) {
  if (isMockMode()) {
    return getTable('transactions')
      .filter(t => t.pool_id === poolId && t.stock_code === stockCode)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }
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
  if (isMockMode()) return insertRow('transactions', tx)
  const { data, error } = await supabase
    .from('transactions')
    .insert([tx])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新交易 */
export async function updateTransaction(id, updates) {
  if (isMockMode()) {
    updateRows('transactions', { id }, { ...updates, updated_at: new Date().toISOString() })
    return
  }
  const { error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除交易 */
export async function deleteTransaction(id) {
  if (isMockMode()) {
    deleteRows('transactions', { id })
    return
  }
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 插入资金变动 */
export async function insertCapitalLog(log) {
  if (isMockMode()) return insertRow('capital_log', log)
  const { data, error } = await supabase
    .from('capital_log')
    .insert([log])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新资金记录（capital_log 表无 updated_at 列） */
export async function updateCapitalLog(id, updates) {
  if (isMockMode()) {
    updateRows('capital_log', { id }, updates)
    return
  }
  const { error } = await supabase
    .from('capital_log')
    .update(updates)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除资金记录 */
export async function deleteCapitalLog(id) {
  if (isMockMode()) {
    deleteRows('capital_log', { id })
    return
  }
  const { error } = await supabase.from('capital_log').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 更新持仓 */
export async function upsertHolding(holding) {
  if (isMockMode()) {
    const existing = updateRows('holdings', { pool_id: holding.pool_id, stock_code: holding.stock_code }, holding)
    if (existing) return existing
    return insertRow('holdings', holding)
  }
  const { data, error } = await supabase
    .from('holdings')
    .upsert(holding, { onConflict: 'pool_id,stock_code' })
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 删除持仓（清仓时） */
export async function deleteHolding(poolId, stockCode) {
  if (isMockMode()) {
    deleteRows('holdings', { pool_id: poolId, stock_code: stockCode })
    return
  }
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('pool_id', poolId)
    .eq('stock_code', stockCode)
  if (error) throw new Error(error.message)
}

/* 获取行情缓存 */
export async function fetchStockCache() {
  if (isMockMode()) return getTable('stock_cache')
  const { data, error } = await supabase.from('stock_cache').select('*')
  return error ? [] : data
}

/* 更新行情缓存 */
export async function upsertStockCache(cache) {
  if (isMockMode()) {
    updateRows('stock_cache', { stock_code: cache.stock_code }, cache)
    if (!getTable('stock_cache').some(c => c.stock_code === cache.stock_code)) {
      insertRow('stock_cache', cache)
    }
    return
  }
  const { error } = await supabase
    .from('stock_cache')
    .upsert(cache, { onConflict: 'stock_code' })
  if (error) console.error('Cache update error:', error)
}

/* 保存子池分配金额到服务器（跨设备同步） */
export async function savePoolAllocation(amounts) {
  if (isMockMode()) {
    setConfigValue('pool_amounts', JSON.stringify(amounts))
    return
  }
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'pool_amounts', value: JSON.stringify(amounts) })
  if (error) throw new Error(error.message)
}

/* 加载子池分配金额 */
export async function loadPoolAllocation() {
  if (isMockMode()) {
    const value = getConfigValue('pool_amounts')
    if (!value) return null
    try { return JSON.parse(value) } catch { return null }
  }
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
  if (isMockMode()) {
    setConfigValue('password_hash', hashed)
    return true
  }
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
  if (isMockMode()) {
    setConfigValue(`pos_snap:${date}`, JSON.stringify(payload))
    return
  }
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: `pos_snap:${date}`, value: JSON.stringify(payload) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/* 读取最近 N 条快照（含资产 & 资金变动） */
export async function fetchPositionSnapshots(limit = 10) {
  const parseSnap = (d) => {
    const parsed = JSON.parse(d.value)
    return {
      date: d.key.replace('pos_snap:', ''),
      ratio: parsed.ratio,
      asset: parsed.asset,
      capitalChange: parsed.capitalChange || 0,
      updatedAt: parsed.updatedAt || null
    }
  }
  if (isMockMode()) {
    return getTable('app_config')
      .filter(r => r.key.startsWith('pos_snap:'))
      .map(parseSnap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-limit)
  }
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .like('key', 'pos_snap:%')
    .order('key', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
    .map(parseSnap)
    .reverse()
}

/* 校对交易 */
export async function verifyTransaction(id, actualAmount) {
  if (isMockMode()) {
    updateRows('transactions', { id }, { status: 'verified', actual_amount: actualAmount, updated_at: new Date().toISOString() })
    return true
  }
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'verified', actual_amount: actualAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
