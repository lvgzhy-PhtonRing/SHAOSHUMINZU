<!-- src/pages/LoginPage.vue -->
<template>
  <div class="login-page">
    <div class="login-header">
      <div class="app-logo">📊</div>
      <h1 class="app-title">结构化动态仓位<br>配置亏损计划</h1>
      <p class="app-subtitle">我和少数民族们</p>
    </div>

    <div class="login-form">
      <div class="form-group" :class="{ error: error }">
        <input
          v-model="email"
          type="email"
          class="form-input"
          placeholder="邮箱"
          autocomplete="email"
          @input="error = false"
          @keyup.enter="doLogin"
        />
      </div>
      <div class="form-group" :class="{ error: error }">
        <input
          v-model="password"
          type="password"
          class="form-input"
          placeholder="密码"
          autocomplete="current-password"
          @input="error = false"
          @keyup.enter="doLogin"
        />
      </div>

      <div v-if="error" class="error-msg">
        <span>{{ errorMsg }}</span>
      </div>

      <button class="login-btn" :class="{ loading: loading }" :disabled="loading || !email || !password" @click="doLogin">
        {{ loading ? '登录中…' : '进入系统' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/api/supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref(false)
const errorMsg = ref('')

// 开发模式自动登录（仅本地测试）
import.meta.env.DEV && (async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    router.replace({ name: 'dashboard' })
  }
})()

async function doLogin() {
  if (!email.value || !password.value) return
  loading.value = true
  error.value = false
  errorMsg.value = ''

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    })

    if (error) {
      errorMsg.value = '邮箱或密码错误'
      error.value = true
      return
    }

    if (data.session) {
      router.replace({ name: 'dashboard' })
    }
  } catch (e) {
    errorMsg.value = '网络连接失败，请检查网络'
    error.value = true
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-primary);
}
.login-header {
  text-align: center;
  margin-bottom: 40px;
}
.app-logo {
  font-size: 56px;
  margin-bottom: 16px;
}
.app-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 8px;
}
.app-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}
.login-form {
  width: 100%;
  max-width: 320px;
}
.form-group {
  margin-bottom: 12px;
}
.form-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--bg-accent);
}
.form-group.error .form-input {
  border-color: var(--color-rise);
}
.form-input::placeholder {
  color: var(--text-muted);
}
.error-msg {
  text-align: center;
  color: var(--color-rise);
  font-size: 13px;
  margin-bottom: 16px;
  animation: shake 0.4s ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
.login-btn {
  width: 100%;
  margin-top: 8px;
  padding: 14px;
  background: var(--bg-accent);
  border: none;
  border-radius: var(--radius-lg);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
}
.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.login-btn.loading {
  opacity: 0.7;
}
</style>
