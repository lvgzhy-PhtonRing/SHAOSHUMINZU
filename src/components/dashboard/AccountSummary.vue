<!-- src/components/dashboard/AccountSummary.vue -->
<template>
  <div class="account-section">
    <div class="account-header">
      <span class="account-label">账号 {{ accountId }}</span>
      <span class="account-status">{{ statusText }}</span>
    </div>
    <div class="total-asset">{{ formatMoney(totalAsset) }}</div>
    <div class="asset-meta">账户资产（元）</div>
    <div class="asset-grid">
      <div class="asset-item">
        <div class="asset-label">总市值</div>
        <div class="asset-value num-mono">{{ formatMoney(marketValue) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">可用资金</div>
        <div class="asset-value num-mono">{{ formatMoney(available) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">仓位</div>
        <div class="asset-value num-mono">{{ positionRatio.toFixed(1) }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  accountId: { type: String, default: '27***87' },
  totalAsset: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  available: { type: Number, default: 0 },
  positionRatio: { type: Number, default: 0 },
  statusText: { type: String, default: '清算中' }
})
</script>

<style scoped>
.account-section {
  padding: 16px;
}
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.account-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.account-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(233,69,96,0.15);
  color: var(--color-fall);
}
.total-asset {
  font-size: 30px;
  font-weight: 700;
  font-family: var(--font-number);
  letter-spacing: -0.5px;
  margin-bottom: 2px;
}
.asset-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.asset-item {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.asset-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.asset-value {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-number);
}
</style>
