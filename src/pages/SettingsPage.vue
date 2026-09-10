<template>
  <div class="page settings-page" :class="{ 'in-drawer': inDrawer }">
    <div class="page-header" v-if="!inDrawer">
      <span class="page-title">软件设置</span>
    </div>
    <div class="settings-section">
      <div class="settings-group">
        <div class="group-title">安全</div>
        <div class="settings-item" @click="showPwdDialog = true">
          <div class="item-left"><span class="item-icon">🔑</span><span>修改密码</span></div>
          <span class="item-arrow">→</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">自动备份</div>
        <div class="settings-item" @click="triggerAutoBackup">
          <div class="item-left"><span class="item-icon">⏰</span><span>立即备份</span></div>
          <span class="item-arrow">{{ autoBacking ? '备份中…' : '▶' }}</span>
        </div>
        <div class="settings-item" @click="showBackupList = true">
          <div class="item-left"><span class="item-icon">📋</span><span>备份列表</span></div>
          <span class="item-arrow">→</span>
        </div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">🔄</span><span>自动备份</span></div>
          <span class="item-status sync-ok">每日 11:00</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">数据备份</div>
        <div class="settings-item" @click="exportData">
          <div class="item-left"><span class="item-icon">📤</span><span>导出数据</span></div>
          <span class="item-arrow">{{ exporting ? '导出中…' : '↓' }}</span>
        </div>
        <label class="settings-item" for="import-file">
          <div class="item-left"><span class="item-icon">📥</span><span>导入数据</span></div>
          <span class="item-arrow">↑</span>
        </label>
        <input id="import-file" ref="fileInput" type="file" accept=".json,application/json,text/plain,text/json" style="display:none" @change="onFileSelected" />
      </div>

      <div class="settings-group">
        <div class="group-title">状态</div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">📊</span><span>数据同步</span></div>
          <span class="item-status sync-ok">已同步</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">关于</div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">ℹ️</span><span>版本</span></div>
          <span class="item-value">v4.0.8</span>
        </div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">🏛️</span><span>数据存储</span></div>
          <span class="item-value">Supabase</span>
        </div>
      </div>
    </div>

    <div class="logout-section">
      <van-button round block plain hairline color="#ff4d6d" @click="doLogout">退出登录</van-button>
    </div>

    <!-- 密码弹窗 -->
    <van-dialog v-model:show="showPwdDialog" title="修改密码" show-cancel-button @confirm="changePassword" class="pwd-dialog">
      <div class="pwd-dialog-content">
        <div class="pwd-current-email">当前账号：{{ currentEmail }}</div>
        <div class="pwd-input-group">
          <label class="pwd-label">新密码</label>
          <input v-model="newPwd" type="password" class="pwd-input" maxlength="6" placeholder="••••••" inputmode="numeric" pattern="[0-9]*" />
        </div>
        <div class="pwd-input-group">
          <label class="pwd-label">确认密码</label>
          <input v-model="confirmPwd" type="password" class="pwd-input" maxlength="6" placeholder="••••••" inputmode="numeric" pattern="[0-9]*" />
        </div>
        <div class="pwd-error" v-if="pwdError">{{ pwdError }}</div>
        <div class="pwd-hint">密码要求：6位数字</div>
      </div>
    </van-dialog>

    <!-- 导入确认弹窗 -->
    <van-dialog v-model:show="showImportConfirm" :title="exportedBeforeImport ? '确认导入' : '导入前请先导出'" :message="exportedBeforeImport ? '导出完成，确认导入？导入将覆盖现有数据。' : '导入将覆盖现有数据。请先导出当前数据到本地，确认导出成功后再导入。'" show-cancel-button @confirm="doImport">
      <div class="import-dialog-actions" v-if="!exportedBeforeImport">
        <van-button size="small" plain color="#4d9fff" :loading="exporting" @click="exportThenConfirm">📤 先导出当前数据</van-button>
      </div>
      <div class="import-dialog-actions" v-else>
        <span class="import-dialog-hint">✅ 已导出备份文件</span>
      </div>
    </van-dialog>

    <!-- 备份列表弹窗 -->
    <van-popup v-model:show="showBackupList" position="bottom" :style="{ height: '60%' }" round @opened="loadBackupList">
      <div class="backup-list-popup">
        <div class="popup-header">
          <span>自动备份列表</span>
          <span class="popup-close" @click="showBackupList = false">✕</span>
        </div>
        <div v-if="loadingBackups" class="popup-loading">加载中…</div>
        <div v-else-if="!backups.length" class="popup-empty">暂无备份</div>
        <div v-else class="backup-list">
          <div v-for="b in backups" :key="b.filename" class="backup-item">
            <div class="backup-info">
              <div class="backup-date">{{ formatDate(b.created_at) }}</div>
              <div class="backup-size">{{ formatSize(b.size) }}</div>
            </div>
            <van-button size="small" plain color="#4d9fff" :loading="restoring === b.filename" @click="restoreBackup(b.filename)">恢复</van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/api/supabase'
import { isMockMode } from '@/api/mockDb'

const props = defineProps({
  inDrawer: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const router = useRouter()
const showPwdDialog = ref(false)
const newPwd = ref('')
const confirmPwd = ref('')
const exporting = ref(false)
const showImportConfirm = ref(false)
const exportedBeforeImport = ref(false)
const showBackupList = ref(false)
const autoBacking = ref(false)
const loadingBackups = ref(false)
const backups = ref([])
const restoring = ref(null)
let pendingImportData = null

const TABLES = ['pools', 'holdings', 'transactions', 'capital_log', 'stock_cache', 'app_config']

// ========== 导出 ==========
async function exportData() {
  exporting.value = true
  try {
    const backup = { _export_at: new Date().toISOString(), _version: 1 }
    if (isMockMode()) {
      const { getTable } = await import('@/api/mockDb')
      for (const table of TABLES) backup[table] = getTable(table)
    } else {
      for (const table of TABLES) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw new Error(`${table}: ${error.message}`)
        backup[table] = data || []
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etf-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch (e) {
    console.error('Export error:', e)
    return false
  } finally {
    exporting.value = false
  }
}

// ========== 自动备份（Edge Function） ==========
async function triggerAutoBackup() {
  if (isMockMode()) { alert('测试版不支持自动备份'); return }
  autoBacking.value = true
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      }
    })
    const data = await res.json()
    if (data.success) {
      alert(`✅ 备份成功\n文件: ${data.filename}\n清理旧备份: ${data.deleted_old} 个`)
    } else {
      alert('❌ 备份失败: ' + (data.error || '未知错误'))
    }
  } catch (e) {
    alert('❌ 备份失败: ' + e.message)
  } finally {
    autoBacking.value = false
  }
}

async function loadBackupList() {
  if (isMockMode()) { backups.value = []; return }
  loadingBackups.value = true
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup/list`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      }
    })
    const data = await res.json()
    backups.value = data.backups || []
  } catch (e) {
    console.error('Load backup list error:', e)
    backups.value = []
  } finally {
    loadingBackups.value = false
  }
}

async function restoreBackup(filename) {
  if (isMockMode()) { alert('测试版不支持恢复'); return }
  restoring.value = filename
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup/restore?file=${encodeURIComponent(filename)}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      }
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    pendingImportData = data
    exportedBeforeImport.value = false
    showBackupList.value = false
    showImportConfirm.value = true
  } catch (e) {
    alert('❌ 获取备份失败: ' + e.message)
  } finally {
    restoring.value = null
  }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

// ========== 导入 ==========
function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      pendingImportData = JSON.parse(ev.target.result)
      exportedBeforeImport.value = false
      showImportConfirm.value = true
    } catch {
      alert('文件格式错误，请选择正确的备份JSON文件')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function exportThenConfirm() {
  const ok = await exportData()
  if (ok) {
    exportedBeforeImport.value = true
  } else {
    alert('导出失败，请检查网络后重试。未导出的数据导入后将丢失！')
  }
}

async function doImport() {
  if (!pendingImportData) return
  try {
    if (isMockMode()) {
      // 测试版（无 Supabase 凭据）：导入到本地 mock 数据库
      const { loadBackup } = await import('@/api/mockDb')
      loadBackup(pendingImportData)
      alert('✅ 数据已导入本地测试库！请刷新页面查看')
    } else {
      for (const table of TABLES) {
        const rows = pendingImportData[table]
        // 先查出当前表中所有记录ID，逐条删除
        const { data: current } = await supabase.from(table).select(table === 'stock_cache' ? 'stock_code' : table === 'app_config' ? 'key' : 'id')
        if (current && current.length) {
          for (const item of current) {
            if (table === 'stock_cache') await supabase.from(table).delete().eq('stock_code', item.stock_code)
            else if (table === 'app_config') await supabase.from(table).delete().eq('key', item.key)
            else await supabase.from(table).delete().eq('id', item.id)
          }
        }
        // 插入备份数据（保留原始 ID 以维持外键关联）
        if (rows && rows.length) {
          for (const row of rows) {
            const { updated_at, ...clean } = row
            const { error } = await supabase.from(table).insert(clean)
            if (error) console.warn(`${table} row insert error:`, error.message)
          }
        }
      }
      alert('✅ 数据导入成功！请刷新页面查看')
    }
  } catch (e) {
    console.error('Import error:', e)
    alert('❌ 导入失败：' + e.message)
  } finally {
    pendingImportData = null
    showImportConfirm.value = false
  }
}

// ========== 密码 ==========
async function changePassword() {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPwd.value
    })

    if (error) {
      alert('修改失败：' + error.message)
      return false
    }

    showPwdDialog.value = false
    oldPwd.value = ''
    newPwd.value = ''
    confirmPwd.value = ''
    return true
  } catch (e) {
    console.error('Change password error:', e)
    return false
  }
}

async function doLogout() {
  await supabase.auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.settings-section { padding: 0; }
.settings-group { margin-bottom: 20px; }
.group-title { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; padding-left: 4px; }
.settings-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 12px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 2px; cursor: pointer; }
.item-left { display: flex; align-items: center; gap: 10px; }
.item-icon { font-size: 16px; }
.item-arrow { color: var(--text-muted); font-size: 14px; }
.item-value { color: var(--text-secondary); font-size: 13px; }
.item-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.item-status.sync-ok { background: rgba(0,240,168,0.12); color: var(--color-fall); }
.logout-section { padding: 24px 0; }
.in-drawer { padding: 56px 0 0; }
.in-drawer .logout-section { padding: 12px 0; }
.pwd-dialog { background: var(--bg-card); border-radius: 16px; }
.pwd-dialog-content { padding: 8px 4px; }
.pwd-current-email { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }
.pwd-input-group { margin-bottom: 12px; }
.pwd-label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.pwd-input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-size: 24px; letter-spacing: 8px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.pwd-input:focus { border-color: var(--bg-accent); }
.pwd-input::placeholder { color: rgba(255,255,255,0.3); letter-spacing: 8px; }
.pwd-error { color: var(--color-rise); font-size: 12px; margin-bottom: 8px; padding-left: 4px; }
.pwd-hint { font-size: 12px; color: var(--text-muted); margin-top: 8px; padding-left: 4px; }
.backup-list-popup { padding: 16px; display: flex; flex-direction: column; height: 100%; }
.popup-header { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.popup-close { cursor: pointer; color: var(--text-muted); font-size: 16px; }
.popup-loading, .popup-empty { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px; }
.backup-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.backup-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card); border-radius: var(--radius-md); }
.backup-info { display: flex; flex-direction: column; gap: 2px; }
.backup-date { font-size: 13px; font-weight: 600; }
.backup-size { font-size: 11px; color: var(--text-muted); }
</style>
