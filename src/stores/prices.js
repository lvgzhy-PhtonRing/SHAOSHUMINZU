// src/stores/prices.js
import { defineStore } from 'pinia'
import { fetchStockPrices, clearPriceCache } from '@/api/stock'
import { fetchStockCache, upsertStockCache } from '@/api/supabase'

export const usePriceStore = defineStore('prices', {
  state: () => ({
    prices: {},   // { [stock_code]: { price, change_pct, stock_name } }
    loading: false,
    lastUpdated: null
  }),
  actions: {
    async loadPrices(codes) {
      if (!codes.length) return
      this.loading = true
      try {
        const data = await fetchStockPrices(codes)
        this.prices = { ...this.prices, ...data }
        this.lastUpdated = Date.now()
        for (const code of codes) {
          if (data[code]) {
            upsertStockCache({
              stock_code: code,
              stock_name: data[code].stock_name,
              price: data[code].price,
              change_pct: parseFloat(data[code].change_pct),
              updated_at: new Date().toISOString()
            })
          }
        }
      } catch (e) {
        console.error('Load prices error:', e)
      } finally {
        this.loading = false
      }
    },
    async loadFromCache() {
      const cached = await fetchStockCache()
      for (const item of cached) {
        this.prices[item.stock_code] = {
          price: item.price,
          change_pct: item.change_pct,
          stock_name: item.stock_name
        }
      }
    },
    forceRefresh(codes) {
      clearPriceCache()
      return this.loadPrices(codes)
    }
  }
})
