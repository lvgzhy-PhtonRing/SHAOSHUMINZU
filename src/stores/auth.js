// src/stores/auth.js
import { defineStore } from 'pinia'
import { hashPassword, isHashed } from '@/utils/crypto'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    loginTime: null
  }),
  actions: {
    async login(password) {
      const storedPwd = localStorage.getItem('pwd') || '1111'
      const isValid = isHashed(storedPwd)
        ? await hashPassword(password) === storedPwd
        : password === storedPwd
      if (isValid) {
        // 如果是旧版明文密码，升级为哈希存储
        if (!isHashed(storedPwd)) {
          localStorage.setItem('pwd', await hashPassword(password))
        }
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
