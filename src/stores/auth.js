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
      const storedPwd = localStorage.getItem('pwd') || '1111'
      // 1. 验证本地缓存
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
      // 2. 本地失败，尝试服务器
      const serverValid = await verifyPassword(password)
      if (serverValid) {
        localStorage.setItem('pwd', await hashPassword(password))
        this.isAuthenticated = true
        this.loginTime = Date.now()
        return true
      }
      return false
    },
    logout() {
      this.isAuthenticated = false
      this.loginTime = null
    }
  }
})
