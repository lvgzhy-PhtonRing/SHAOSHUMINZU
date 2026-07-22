// src/stores/transactions.js
import { defineStore } from 'pinia'
import { fetchTransactions, insertTransaction, verifyTransaction } from '@/api/supabase'

export const useTransactionStore = defineStore('transactions', {
  state: () => ({
    transactions: [],
    loading: false,
    submitting: false,
    error: null
  }),
  actions: {
    async loadTransactions() {
      this.loading = true
      this.error = null
      try {
        this.transactions = await fetchTransactions()
      } catch (e) {
        this.error = e.message
        console.error('Load transactions error:', e)
      } finally {
        this.loading = false
      }
    },
    async addTransaction(tx) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertTransaction(tx)
        this.transactions.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    },
    async verify(id, actualAmount) {
      this.error = null
      try {
        const ok = await verifyTransaction(id, actualAmount)
        if (ok) {
          const tx = this.transactions.find(t => t.id === id)
          if (tx) {
            tx.status = 'verified'
            tx.actual_amount = actualAmount
          }
        }
        return ok
      } catch (e) {
        this.error = e.message
        console.error('Verify error:', e)
        return false
      }
    }
  }
})
