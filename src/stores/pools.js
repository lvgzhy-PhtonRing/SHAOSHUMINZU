// src/stores/pools.js
import { defineStore } from 'pinia'
import { fetchPools } from '@/api/supabase'

export const usePoolStore = defineStore('pools', {
  state: () => ({
    pools: [],
    currentPoolId: null, // null = 总账户
    loading: false
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
      this.pools = await fetchPools()
      this.loading = false
    },
    setCurrentPool(poolId) {
      this.currentPoolId = poolId
    }
  }
})
