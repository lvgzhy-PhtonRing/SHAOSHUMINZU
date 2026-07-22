<template>
  <div class="page settings-page" style="padding:16px">
    <div class="page-header">
      <span class="page-title">设置</span>
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
        <div class="group-title">数据备份</div>
        <div class="settings-item" @click="exportData">
          <div class="item-left"><span class="item-icon">📤</span><span>导出数据</span></div>
          <span class="item-arrow">{{ exporting ? '导出中…' : '↓' }}</span>
        </div>
        <div class="settings-item" @click="triggerImport">
          <div class="item-left"><span class="item-icon">📥</span><span>导入数据</span></div>
          <span class="item-arrow">↑</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelected" />
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
          <span class="item-value">v1.0.0</span>
        </div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">🏛️</span><span>数据存储</span></div>
          <span class="item-value">Supabase</span>
        </div>
      </div>
    </div>

    <div class="logout-section">
      <van-button round block plain hairline color="#e94560" @click="doLogout">退出登录</van-button>
    </div>

    <!-- 密码弹窗 -->
    <van-dialog v-model:show="showPwdDialog" title="修改密码" show-cancel-button @confirm="changePassword">
      <van-form>
        <van-field v-model="oldPwd" label="旧密码" type="password" maxlength="4" placeholder="输入旧密码" :rules="[{ required: true, message: '请输入旧密码' }]" />
        <van-field v-model="newPwd" label="新密码" type="password" maxlength="4" placeholder="4位数字新密码" :rules="[{ required: true, message: '请输入新密码' }, { validator: v => /^\d{4}$/.test(v), message: '必须为4位数字' }]" />
        <van-field v-model="confirmPwd" label="确认密码" type="password" maxlength="4" placeholder="再次输入新密码" :rules="[{ required: true, message: '请确认新密码' }, { validator: v => v === newPwd, message: '两次密码不一致' }]" />
      </van-form>
    </van-dialog>

    <!-- 导入确认弹窗 -->
    <van-dialog v-model:show="showImportConfirm" title="确认导入" message="导入将覆盖现有数据，确认继续？" show-cancel-button @confirm="doImport" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/api/supabase'

const router = useRouter()
const showPwdDialog = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const exporting = ref(false)
const showImportConfirm = ref(false)
const fileInput = ref(null)
let pendingImportData = null

const TABLES = ['pools', 'holdings', 'transactions', 'capital_log', 'stock_cache', 'app_config']

// ========== 导出 ==========
async function exportData() {
  exporting.value = true
  try {
    const backup = { _export_at: new Date().toISOString(), _version: 1 }
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw new Error(`${table}: ${error.message}`)
      backup[table] = data || []
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etf-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export error:', e)
  } finally {
    exporting.value = false
  }
}

// ========== 导入 ==========
function triggerImport() {
  fileInput.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      pendingImportData = JSON.parse(ev.target.result)
      showImportConfirm.value = true
    } catch {
      alert('文件格式错误，请选择正确的备份JSON文件')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function doImport() {
  if (!pendingImportData) return
  try {
    for (const table of TABLES) {
      const rows = pendingImportData[table]
      if (!rows || !rows.length) continue

      // 安全删除所有旧数据
      if (table === 'stock_cache') {
        await supabase.from(table).delete().neq('stock_code', '')
      } else if (table === 'app_config') {
        await supabase.from(table).delete().neq('key', '')
      } else {
        await supabase.from(table).delete().gt('id', 0)
      }

      // 逐条插入（避免主键冲突）
      for (const row of rows) {
        const { id, created_at, updated_at, ...clean } = row
        const { error } = await supabase.from(table).insert(clean)
        if (error) console.warn(`${table} row insert error:`, error.message)
      }
    }
    alert('✅ 数据导入成功！请刷新页面查看')
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
  const currentPwd = localStorage.getItem('pwd') || '1111'
  if (oldPwd.value !== currentPwd) return false
  localStorage.setItem('pwd', newPwd.value)
  return true
}

function doLogout() {
  localStorage.removeItem('auth')
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.page-header { padding: 4px 0 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.settings-section { padding: 0; }
.settings-group { margin-bottom: 20px; }
.group-title { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; padding-left: 4px; }
.settings-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 12px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 2px; cursor: pointer; }
.item-left { display: flex; align-items: center; gap: 10px; }
.item-icon { font-size: 16px; }
.item-arrow { color: var(--text-muted); font-size: 14px; }
.item-value { color: var(--text-secondary); font-size: 13px; }
.item-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.item-status.sync-ok { background: rgba(0,210,161,0.1); color: var(--color-rise); }
.logout-section { padding: 24px 0; }
</style>
