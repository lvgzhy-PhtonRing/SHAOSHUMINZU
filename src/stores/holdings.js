// src/stores/holdings.js
import { defineStore } from 'pinia'
import { fetchHoldings } from '@/api/supabase'

export const useHoldingStore = defineStore('holdings', {
  state: () => ({
    holdings: [],
    loading: false,
    error: null
  }),
  getters: {
    holdingsByPool: (state) => {
      const map = {}
      for (const h of state.holdings) {
        if (!map[h.pool_id]) map[h.pool_id] = []
        map[h.pool_id].push(h)
      }
      return map
    },
    stockCodes: (state) => {
      return [...new Set(state.holdings.map(h => h.stock_code))]
    }
  },
  actions: {
    async loadHoldings() {
      this.loading = true
      this.error = null
      try {
        this.holdings = await fetchHoldings()
      } catch (e) {
        this.error = e.message
        console.error('Load holdings error:', e)
      } finally {
        this.loading = false
      }
    }
  }
})
