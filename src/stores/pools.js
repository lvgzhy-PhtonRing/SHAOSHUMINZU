// src/stores/pools.js
import { defineStore } from 'pinia'
import { fetchPools } from '@/api/supabase'

export const usePoolStore = defineStore('pools', {
  state: () => ({
    pools: [],
    currentPoolId: null, // null = 总账户
    loading: false,
    error: null
  }),
  getters: {
    currentPool: (state) => {
      if (state.currentPoolId === null) return null
      return state.pools.find(p => p.id === state.currentPoolId)
    },
    allPools: (state) => state.pools
  },
  actions: {
    async loadPools() {
      this.loading = true
      this.error = null
      try {
        this.pools = await fetchPools()
      } catch (e) {
        this.error = e.message
        console.error('Load pools error:', e)
      } finally {
        this.loading = false
      }
    },
    setCurrentPool(poolId) {
      this.currentPoolId = poolId
    }
  }
})
