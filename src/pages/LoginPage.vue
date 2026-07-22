<!-- src/pages/LoginPage.vue -->
<template>
  <div class="login-page">
    <div class="login-header">
      <div class="app-logo">📊</div>
      <h1 class="app-title">结构化动态仓位<br>配置亏损计划</h1>
      <p class="app-subtitle">合伙股票账户管理系统</p>
    </div>

    <div class="login-form">
      <div class="password-display">
        <span v-for="(d, i) in 4" :key="i" class="pwd-dot" :class="{ filled: input.length > i }">
          {{ input.length > i ? '●' : '○' }}
        </span>
      </div>

      <div v-if="error" class="error-msg shake">密码错误，请重试</div>

      <div class="numpad">
        <button v-for="n in 9" :key="n" class="num-btn" @click="press(n)">{{ n }}</button>
        <button class="num-btn empty" disabled></button>
        <button class="num-btn" @click="press(0)">0</button>
        <button class="num-btn delete-btn" @click="deleteChar">⌫</button>
      </div>

      <button class="login-btn" :class="{ ready: input.length === 4 }" :disabled="input.length !== 4" @click="doLogin">
        进入系统
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const input = ref('')
const error = ref(false)

function press(n) {
  if (input.value.length >= 4) return
  error.value = false
  input.value += String(n)
}

function deleteChar() {
  input.value = input.value.slice(0, -1)
  error.value = false
}

async function doLogin() {
  if (input.value.length !== 4) return
  const storedPwd = localStorage.getItem('pwd') || '1111'
  if (input.value === storedPwd) {
    localStorage.setItem('auth', 'true')
    router.replace({ name: 'dashboard' })
  } else {
    error.value = true
    input.value = ''
    setTimeout(() => { error.value = false }, 1500)
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
.password-display {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}
.pwd-dot {
  font-size: 28px;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.pwd-dot.filled {
  color: var(--text-primary);
}
.error-msg {
  text-align: center;
  color: var(--color-fall);
  font-size: 13px;
  margin-bottom: 16px;
}
.shake {
  animation: shake 0.4s ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 280px;
  margin: 0 auto;
}
.num-btn {
  width: 72px;
  height: 56px;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 22px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.num-btn:active {
  background: var(--bg-accent);
}
.num-btn.empty {
  background: transparent;
  cursor: default;
}
.delete-btn {
  font-size: 18px;
}
.login-btn {
  width: 100%;
  max-width: 280px;
  margin-top: 24px;
  padding: 14px;
  background: rgba(15,52,96,0.3);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.login-btn.ready {
  background: var(--bg-accent);
  color: #fff;
}
.login-btn:disabled {
  cursor: not-allowed;
}
</style>
