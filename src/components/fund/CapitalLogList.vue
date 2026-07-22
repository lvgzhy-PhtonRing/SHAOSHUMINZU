<template>
  <div class="capital-log-list">
    <div class="log-header">
      <span class="log-title">资金变动记录</span>
      <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
    </div>
    <div v-if="!logs.length"><EmptyState icon="💰" text="暂无资金变动记录" /></div>
    <div v-else class="log-items">
      <div v-for="log in logs" :key="log.id" class="log-item">
        <div class="log-icon">{{ log.type === 'add' ? '➕' : '➖' }}</div>
        <div class="log-info">
          <div class="log-detail">
            <span class="log-action">{{ log.type === 'add' ? '增资' : '减资' }}</span>
            <span class="log-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
              {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
            </span>
          </div>
          <div class="log-meta">
            <span v-if="log.pools?.name">分配至：{{ log.pools.name }} · </span>
            <span>{{ formatDateString(log.created_at) }}</span>
            <span v-if="log.created_by"> · {{ log.created_by }}</span>
          </div>
          <div v-if="log.note" class="log-note">{{ log.note }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  logs: { type: Array, default: () => [] }
})

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.log-list { margin-top: 16px; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); }
.log-items { display: flex; flex-direction: column; gap: 6px; }
.log-item { display: flex; gap: 10px; padding: 10px; background: var(--bg-card); border-radius: var(--radius-md); }
.log-icon { font-size: 18px; padding-top: 2px; }
.log-info { flex: 1; min-width: 0; }
.log-detail { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.log-action { font-size: 13px; font-weight: 500; }
.log-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.log-amount.rise { color: var(--color-rise); }
.log-amount.fall { color: var(--color-fall); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.log-note { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
</style>
