<!-- src/components/dashboard/AccountSummary.vue -->
<template>
  <div class="account-section">
    <div class="asset-meta">
      <span>账户资产（元）</span>
      <span class="asset-meta-note">非实时市值</span>
    </div>
    <div class="total-asset">{{ formatMoney(totalAsset) }}</div>
    <div class="asset-grid">
      <div class="asset-item">
        <div class="asset-label">总市值</div>
        <div class="asset-value num-mono">{{ formatMoney(marketValue) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">总可用资金</div>
        <div class="asset-value num-mono">{{ formatMoney(available) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">总仓位</div>
        <div class="asset-value num-mono">{{ positionRatio.toFixed(1) }}%</div>
      </div>
    </div>
    <ProfitCard :float-pnl="floatPnl" :daily-pnl="dailyPnl" />
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'
import ProfitCard from './ProfitCard.vue'

defineProps({
  totalAsset: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  available: { type: Number, default: 0 },
  positionRatio: { type: Number, default: 0 },
  floatPnl: { type: Number, default: 0 },
  dailyPnl: { type: Number, default: 0 },
  priceUpdateTime: { type: String, default: '' }
})
</script>

<style scoped>
.account-section {
  padding: 0 0 8px;
}
.account-header {
  margin-bottom: 2px;
}
.account-status {
  font-size: 10px;
  color: var(--text-muted);
}
.total-asset {
  font-size: 40px;
  font-weight: 700;
  font-family: var(--font-number);
  letter-spacing: -1px;
  line-height: 1.1;
  margin-bottom: 8px;
  /* 霓虹渐变签名：主数字白→淡紫 */
  background: linear-gradient(120deg, #ffffff, #c9b8ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.asset-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.asset-meta-note {
  font-size: 10px;
  color: var(--text-muted);
  opacity: .8;
  white-space: nowrap;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.profit-grid { margin-top: 10px; }
.asset-item {
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: 8px 10px;
}
.asset-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}
.asset-value {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-number);
}
</style>
