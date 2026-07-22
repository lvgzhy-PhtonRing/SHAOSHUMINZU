// src/stores/prices.js
import { defineStore } from 'pinia'
import { fetchStockPrices, clearPriceCache } from '@/api/stock'
import { fetchStockCache, upsertStockCache } from '@/api/supabase'

export const usePriceStore = defineStore('prices', {
  state: () => ({
    prices: {},   // { [stock_code]: { price, change_pct, stock_name } }
    loading: false,
    lastUpdated: null,
    error: null
  }),
  actions: {
    async loadPrices(codes) {
      if (!codes.length) return
      this.loading = true
      this.error = null
      try {
        const data = await fetchStockPrices(codes)
        this.prices = { ...this.prices, ...data }
        this.lastUpdated = Date.now()
        for (const code of codes) {
          if (data[code]) {
            try {
              await upsertStockCache({
                stock_code: code,
                stock_name: data[code].stock_name,
                price: data[code].price,
                change_pct: parseFloat(data[code].change_pct),
                updated_at: new Date().toISOString()
              })
            } catch (cacheErr) {
              console.error('Cache write error:', cacheErr)
            }
          }
        }
      } catch (e) {
        this.error = e.message
        console.error('Load prices error:', e)
      } finally {
        this.loading = false
      }
    },
    async loadFromCache() {
      this.error = null
      try {
        const cached = await fetchStockCache()
        for (const item of cached) {
          this.prices[item.stock_code] = {
            price: item.price,
            change_pct: item.change_pct,
            stock_name: item.stock_name
          }
        }
      } catch (e) {
        this.error = e.message
        console.error('Load from cache error:', e)
      }
    },
    forceRefresh(codes) {
      clearPriceCache()
      return this.loadPrices(codes)
    }
  }
})
