// .github/scripts/backup.mjs
// 每日数据备份脚本 - 读取所有 Supabase 表数据并保存为 JSON
const fs = await import('fs/promises')
const path = await import('path')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const tables = ['pools', 'holdings', 'transactions', 'capital_log', 'stock_cache', 'app_config']
const backupDir = path.join(process.env.GITHUB_WORKSPACE || '.', 'backups')
const dateStr = new Date().toISOString().split('T')[0] // 2026-07-22

async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json'
    }
  })
  if (!res.ok) throw new Error(`${table}: ${res.status} ${res.statusText}`)
  return res.json()
}

async function backup() {
  await fs.mkdir(backupDir, { recursive: true })
  const allData = {}
  for (const table of tables) {
    try {
      allData[table] = await fetchTable(table)
      console.log(`✅ ${table}: ${allData[table].length} rows`)
    } catch (e) {
      console.error(`❌ ${table}: ${e.message}`)
      allData[table] = []
    }
  }
  allData._backup_at = new Date().toISOString()
  allData._version = 1

  const filePath = path.join(backupDir, `backup-${dateStr}.json`)
  await fs.writeFile(filePath, JSON.stringify(allData, null, 2))
  console.log(`\n💾 Backup saved: ${filePath}`)
  console.log(`📦 Total size: ${(JSON.stringify(allData).length / 1024).toFixed(1)} KB`)
}

backup().catch(e => { console.error(e); process.exit(1) })
