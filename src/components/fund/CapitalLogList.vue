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
            <span>{{ formatDateString(log.created_at) }}</span>
            <span v-if="log.note"> · {{ log.note }}</span>
          </div>
        </div>
        <button class="del-btn" @click="$emit('delete', log.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps({ logs: { type: Array, default: () => [] } })
defineEmits(['delete'])

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); }
.log-items { display: flex; flex-direction: column; gap: 4px; }
.log-item { display: flex; gap: 10px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); }
.log-icon { font-size: 18px; padding-top: 2px; }
.log-info { flex: 1; min-width: 0; }
.log-detail { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.log-action { font-size: 13px; font-weight: 500; }
.log-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.log-amount.rise { color: var(--color-rise); }
.log-amount.fall { color: var(--color-fall); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.del-btn {
  background: none; border: none; color: var(--text-muted); font-size: 14px;
  cursor: pointer; padding: 0 4px; align-self: flex-start;
}
.del-btn:active { color: var(--color-fall); }
</style>
