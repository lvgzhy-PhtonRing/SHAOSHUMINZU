// src/api/mockDb.js
// 本地 Mock 数据层：无 Supabase 凭据时用 localStorage 充当数据库，便于测试版导入正式备份数据

const DB_KEY = 'etf_mock_db'
const TABLES = ['pools', 'holdings', 'transactions', 'capital_log', 'stock_cache', 'app_config']

// 无 Supabase 凭据 → mock 模式
export function isMockMode() {
  return !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
}

export function getDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function getTable(name) {
  return getDB()[name] || []
}

export function setTable(name, rows) {
  const db = getDB()
  db[name] = rows
  saveDB(db)
}

export function getConfigValue(key) {
  const row = getTable('app_config').find(r => r.key === key)
  return row ? row.value : null
}

export function setConfigValue(key, value) {
  const rows = getTable('app_config')
  const idx = rows.findIndex(r => r.key === key)
  if (idx >= 0) rows[idx] = { ...rows[idx], value }
  else rows.push({ key, value })
  setTable('app_config', rows)
}

// 生成自增 id（兼容数值主键表）
function nextId(table) {
  const rows = getTable(table)
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
  return max + 1
}

// 导入备份：校验并整体替换本地数据
export function loadBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('备份格式无效')
  const db = {}
  for (const t of TABLES) {
    db[t] = Array.isArray(backup[t]) ? backup[t] : []
  }
  if (!db.pools.length || !db.capital_log.length) {
    throw new Error('备份缺少必要数据（pools / capital_log）')
  }
  saveDB(db)
  return db
}

export function clearDB() {
  localStorage.removeItem(DB_KEY)
}

// ===== 表级增删改查（供 supabase.js mock 分支复用） =====
export function insertRow(table, row) {
  const rows = getTable(table)
  const copy = { ...row }
  if (copy.id === undefined || copy.id === null) copy.id = nextId(table)
  if (!copy.created_at) copy.created_at = new Date().toISOString()
  rows.push(copy)
  setTable(table, rows)
  return copy
}

export function updateRows(table, match, updates) {
  const rows = getTable(table)
  const idx = rows.findIndex(r => {
    return Object.keys(match).every(k => r[k] === match[k])
  })
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...updates, ...match }
    setTable(table, rows)
    return rows[idx]
  }
  return null
}

export function deleteRows(table, match) {
  setTable(table, getTable(table).filter(r => {
    return !Object.keys(match).every(k => r[k] === match[k])
  }))
}
