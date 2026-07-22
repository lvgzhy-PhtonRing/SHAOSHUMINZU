// src/stores/auth.js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    loginTime: null
  }),
  actions: {
    async login(password) {
      const storedPwd = localStorage.getItem('pwd') || '1111'
      if (password === storedPwd) {
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
