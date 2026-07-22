// src/stores/auth.js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    loginTime: null
  }),
  actions: {
    async login(password) {
      // TODO: 后续接入 verifyPassword API 从 Supabase 验证
      if (password === '1111') {
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
