<template>
  <div class="capital-summary">
    <div class="cs-row">
      <span class="cs-label">资本投入</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalCapital) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">现在市值</span>
      <span class="cs-amount num-mono">{{ formatMoney(marketValue) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label" :class="pnlClass">{{ pnlLabel }}</span>
      <span class="cs-amount num-mono" :class="pnlClass">{{ pnlText }}</span>
    </div>
    <div class="cs-btns">
      <button class="cs-btn change" @click="$emit('open-change')">资本增减</button>
      <button class="cs-btn detail" @click="$emit('open-detail')">变动明细</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  totalCapital: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 }
})
defineEmits(['open-change', 'open-detail'])

// 累计盈利 = 账户资产 − 资本投入 = (现在市值 + 可用资金) − 资本投入
const cumPnl = computed(() => (props.marketValue + props.totalAvailable) - props.totalCapital)
const pnlClass = computed(() => (cumPnl.value >= 0 ? 'rise' : 'fall'))
const pnlLabel = computed(() => (cumPnl.value >= 0 ? '累计盈利' : '累计亏损'))
const pnlText = computed(() => (cumPnl.value >= 0 ? `+${formatMoney(cumPnl.value)}` : formatMoney(cumPnl.value)))
</script>

<style scoped>
.capital-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cs-row { display: flex; justify-content: space-between; align-items: baseline; }
.cs-label { font-size: 13px; color: var(--text-secondary); }
.cs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
.cs-amount.rise { color: var(--color-rise); }
.cs-amount.fall { color: var(--color-fall); }
.cs-label.rise { color: var(--color-rise); }
.cs-label.fall { color: var(--color-fall); }
.cs-btns { display: flex; gap: 10px; }
.cs-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.cs-btn.change { background: var(--bg-accent); color: #fff; }
.cs-btn.detail {
  background: rgba(255,255,255,0.08); color: var(--text-primary);
  border: 1px solid rgba(255,255,255,0.1);
}
</style>
