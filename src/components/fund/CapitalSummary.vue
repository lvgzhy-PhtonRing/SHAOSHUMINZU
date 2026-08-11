<template>
  <div class="capital-summary">
    <div class="cs-row">
      <span class="cs-label">初期投入</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalCapital) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">现在资产</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalAsset) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label" :class="pnlClass">{{ pnlLabel }}</span>
      <span class="cs-amount num-mono" :class="pnlClass">{{ pnlText }}</span>
    </div>
    <div class="cs-btns">
      <button class="cs-btn" @click="$emit('open-detail')">资本明细</button>
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
defineEmits(['open-detail'])

// 现在资产 = 持仓首页的账户资产口径 = 总市值 + 总可用资金
const totalAsset = computed(() => props.marketValue + props.totalAvailable)
// 累计盈利 = 现在资产 − 初期投入
const cumPnl = computed(() => totalAsset.value - props.totalCapital)
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
  background: var(--bg-accent); color: #fff;
}
</style>
