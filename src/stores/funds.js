// src/stores/funds.js
import { defineStore } from 'pinia'
import { fetchCapitalLogs, insertCapitalLog, updateCapitalLog } from '@/api/supabase'

export const useFundStore = defineStore('funds', {
  state: () => ({
    capitalLogs: [],
    loading: false,
    submitting: false,
    error: null
  }),
  getters: {
    totalCapital: (state) => {
      // 只计外部资金变动（pool_id IS NULL），股票买卖不影响总资金池
      return state.capitalLogs
        .filter(l => l.pool_id === null)
        .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
    }
  },
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
    },
    async editCapitalLog(id, updates) {
      this.submitting = true
      this.error = null
      try {
        await updateCapitalLog(id, updates)
        const idx = this.capitalLogs.findIndex(l => l.id === id)
        if (idx !== -1) Object.assign(this.capitalLogs[idx], updates)
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})
