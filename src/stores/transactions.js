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
      this.transactions = await fetchTransactions()
      this.loading = false
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
      const ok = await verifyTransaction(id, actualAmount)
      if (ok) {
        const tx = this.transactions.find(t => t.id === id)
        if (tx) {
          tx.status = 'verified'
          tx.actual_amount = actualAmount
        }
      }
      return ok
    }
  }
})
