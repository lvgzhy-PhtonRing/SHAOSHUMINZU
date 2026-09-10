// src/stores/auth.js
import { defineStore } from 'pinia'
import { supabase } from '@/api/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    loginTime: null
  }),
  actions: {
    async checkSession() {
      const { data } = await supabase.auth.getSession()
      this.isAuthenticated = !!data.session
      this.user = data.session?.user || null
      return this.isAuthenticated
    },
    async login(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return false
      this.isAuthenticated = true
      this.user = data.session?.user || null
      this.loginTime = Date.now()
      return true
    },
    async logout() {
      await supabase.auth.signOut()
      this.isAuthenticated = false
      this.user = null
      this.loginTime = null
    }
  }
})
