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
        <div class="group-title">数据</div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">📊</span><span>数据同步状态</span></div>
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
    <van-dialog v-model:show="showPwdDialog" title="修改密码" show-cancel-button @confirm="changePassword">
      <van-form>
        <van-field v-model="oldPwd" label="旧密码" type="password" maxlength="4" placeholder="输入旧密码" :rules="[{ required: true, message: '请输入旧密码' }]" />
        <van-field v-model="newPwd" label="新密码" type="password" maxlength="4" placeholder="4位数字新密码" :rules="[{ required: true, message: '请输入新密码' }, { validator: v => /^\d{4}$/.test(v), message: '必须为4位数字' }]" />
        <van-field v-model="confirmPwd" label="确认密码" type="password" maxlength="4" placeholder="再次输入新密码" :rules="[{ required: true, message: '请确认新密码' }, { validator: v => v === newPwd, message: '两次密码不一致' }]" />
      </van-form>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
const showPwdDialog = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
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
