// src/stores/auth.js
import { defineStore } from 'pinia'
import { hashPassword, isHashed } from '@/utils/crypto'
import { verifyPassword } from '@/api/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    loginTime: null
  }),
  actions: {
    async login(password) {
      // 1. 先验证服务器（权威来源）
      let serverOk = false, serverReachable = true
      try {
        serverOk = await verifyPassword(password)
      } catch {
        serverReachable = false
      }
      if (serverOk) {
        localStorage.setItem('pwd', await hashPassword(password))
        this.isAuthenticated = true
        this.loginTime = Date.now()
        return true
      }
      // 2. 服务器不可达时，回退本地缓存
      if (!serverReachable) {
        const storedPwd = localStorage.getItem('pwd') || '1111'
        const localValid = isHashed(storedPwd)
          ? await hashPassword(password) === storedPwd
          : password === storedPwd
        if (localValid) {
          if (!isHashed(storedPwd)) {
            localStorage.setItem('pwd', await hashPassword(password))
          }
          this.isAuthenticated = true
          this.loginTime = Date.now()
          return true
        }
      }
      return false
    },
    logout() {
      this.isAuthenticated = false
      this.loginTime = null
    }
  }
})
