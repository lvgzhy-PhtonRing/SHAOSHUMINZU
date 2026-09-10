<template>
  <div class="capital-summary edge-accent">
    <div class="cs-header">
      <span class="title-accent title-accent--accent"></span>
      <span class="cs-title">资本总览</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">资本总投入</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalCapital) }}</span>
    </div>
    <div class="cs-desc">2026-06-01 初始转户时市值 + 2026-07-29 长鑫卖出转户完成增资</div>
    <div class="cs-btns">
      <button class="cs-btn" @click="$emit('open-detail')">资本流水明细</button>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  totalCapital: { type: Number, default: 0 }
})
defineEmits(['open-detail'])
</script>

<style scoped>
.capital-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  /* 左缘用全局 edge-accent 类（同券商APP校对的 edge-warn，仅颜色不同），故此处不写 border-left 以免盖掉 */
  border-top: 1px solid var(--bg-glass-border);
  border-right: 1px solid var(--bg-glass-border);
  border-bottom: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cs-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cs-title {
  font-size: 15px;
  font-weight: 700;
}
.cs-row { display: flex; justify-content: space-between; align-items: baseline; }
.cs-label { font-size: 13px; color: var(--text-secondary); }
.cs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
.cs-desc { font-size: 11px; color: var(--text-muted); line-height: 1.6; margin-top: -6px; }
.cs-btns { display: flex; gap: 10px; }
.cs-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
  background: var(--bg-accent); color: #fff;
}
</style>
