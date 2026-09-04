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
        // 实时行情缺失/失败的股票 → 从缓存兜底（无网络时用导入的 stock_cache 价格）
        const missing = codes.filter(c => !data[c]?.price)
        if (missing.length) {
          await this.loadFromCache(missing)
        }
        // 合并时仅采用 data 中的有效价格，避免 null 覆盖兜底值
        const validData = {}
        for (const c of codes) {
          if (data[c] && data[c].price != null) validData[c] = data[c]
        }
        this.prices = { ...this.prices, ...validData }
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
    async loadFromCache(codes) {
      this.error = null
      try {
        const cached = await fetchStockCache()
        for (const item of cached) {
          if (codes && !codes.includes(item.stock_code)) continue
          this.prices[item.stock_code] = {
            price: item.price,
            change_pct: item.change_pct,
            stock_name: item.stock_name
          }
        }
        this.lastUpdated = Date.now()
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
