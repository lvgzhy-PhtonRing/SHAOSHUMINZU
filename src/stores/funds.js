// src/stores/funds.js
import { defineStore } from 'pinia'
import { fetchCapitalLogs, insertCapitalLog } from '@/api/supabase'

export const useFundStore = defineStore('funds', {
  state: () => ({
    capitalLogs: [],
    loading: false,
    submitting: false,
    error: null
  }),
  actions: {
    async loadCapitalLogs() {
      this.loading = true
      this.error = null
      try {
        this.capitalLogs = await fetchCapitalLogs()
      } catch (e) {
        this.error = e.message
        console.error('Load capital logs error:', e)
      } finally {
        this.loading = false
      }
    },
    async addCapitalLog(log) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertCapitalLog(log)
        this.capitalLogs.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})
