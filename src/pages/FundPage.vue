<template>
  <div class="page fund-page" style="padding:16px">
    <div class="page-header">
      <span class="page-title">资金池管理</span>
    </div>

    <div class="total-pool-card">
      <div class="tpc-label">总资金池</div>
      <div class="tpc-amount num-mono">{{ formatMoney(totalAsset) }}</div>
      <div class="tpc-grid">
        <div class="tpc-item">
          <span class="tpc-item-label">总市值</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalMarketValue) }}</span>
        </div>
        <div class="tpc-item">
          <span class="tpc-item-label">总可用</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalAvailable) }}</span>
        </div>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />
    <template v-else>
      <FundAllocationForm :pools="poolStore.pools" :submitting="fundStore.submitting" @submit="onFundSubmit" />
      <CapitalLogList :logs="fundStore.capitalLogs" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
import CapitalLogList from '@/components/fund/CapitalLogList.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'

const poolStore = usePoolStore()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const totalAsset = ref(816935.51)
const totalAvailable = ref(604250.51)

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

async function onFundSubmit(data) {
  try {
    await fundStore.addCapitalLog({ pool_id: null, type: data.type, amount: data.totalAmount, note: data.note || '', created_by: 'admin' })
    for (const alloc of data.allocations) {
      if (alloc.amount > 0) {
        await fundStore.addCapitalLog({ pool_id: alloc.pool_id, type: data.type, amount: alloc.amount, note: data.note ? `${data.note}（分配）` : '分配', created_by: 'admin' })
      }
    }
  } catch (e) {
    console.error('Fund submit error:', e)
  }
}

onMounted(async () => {
  try {
    await Promise.all([poolStore.loadPools(), holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Fund page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header { padding: 4px 0 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.total-pool-card {
  margin-bottom: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #0f3460, #1a1a2e);
  border-radius: var(--radius-lg);
}
.tpc-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.tpc-amount { font-size: 28px; font-weight: 700; font-family: var(--font-number); margin-bottom: 12px; }
.tpc-grid { display: flex; gap: 16px; }
.tpc-item { display: flex; flex-direction: column; gap: 2px; }
.tpc-item-label { font-size: 11px; color: var(--text-muted); }
.tpc-item-value { font-size: 14px; font-weight: 500; font-family: var(--font-number); }
</style>
