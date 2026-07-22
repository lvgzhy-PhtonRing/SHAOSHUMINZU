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
            <span class="log-action" :class="log.pool_id ? 'trade' : ''">
              {{ log.pool_id ? (log.type === 'add' ? '卖出' : '买入') : (log.type === 'add' ? '增资' : '减资') }}
            </span>
            <span class="log-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
              {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
            </span>
          </div>
          <div class="log-meta">
            <span>{{ formatDateString(log.created_at) }}</span>
            <span v-if="log.note"> · {{ log.note }}</span>
          </div>
        </div>
        <div class="log-actions">
          <button class="edit-btn" @click="startEdit(log)">✏️</button>
          <button class="del-btn" @click="$emit('delete', log.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <teleport to="body">
      <div v-if="editing" class="overlay" @click.self="editing = null">
        <div class="dialog">
          <div class="dlg-title">编辑记录</div>
          <div class="dlg-field">
            <label class="dlg-label">类型</label>
            <span class="dlg-value">{{ editing.pool_id ? (editing.type === 'add' ? '卖出' : '买入') : (editing.type === 'add' ? '增资' : '减资') }}</span>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">金额（元）</label>
            <input v-model="editAmount" type="number" inputmode="decimal" class="dlg-input num-mono" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="editNote" type="text" class="dlg-input" placeholder="股票代码或备注" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="editing = null">取消</button>
            <button class="d-ok" @click="saveEdit">✅ 保存</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { formatMoney } from '@/utils/formatters'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps({ logs: { type: Array, default: () => [] } })
const emit = defineEmits(['delete', 'edit'])

const editing = ref(null)
const editAmount = ref('')
const editNote = ref('')

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function startEdit(log) {
  editing.value = log
  editAmount.value = String(log.amount)
  editNote.value = log.note || ''
}

function saveEdit() {
  if (!editing.value) return
  const amount = parseFloat(editAmount.value)
  if (!amount || amount <= 0) return
  emit('edit', { id: editing.value.id, amount, note: editNote.value })
  editing.value = null
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
.log-action.trade { color: var(--color-warn); }
.log-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.log-amount.rise { color: var(--color-rise); }
.log-amount.fall { color: var(--color-fall); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.log-actions { display: flex; flex-direction: column; gap: 4px; align-self: flex-start; }
.edit-btn {
  background: none; border: none; font-size: 13px; cursor: pointer; padding: 0 2px; line-height: 1;
  opacity: 0.5; transition: opacity 0.15s;
}
.edit-btn:hover { opacity: 1; }
.del-btn {
  background: none; border: none; color: var(--text-muted); font-size: 13px;
  cursor: pointer; padding: 0 2px; line-height: 1;
}
.del-btn:active { color: var(--color-fall); }

/* 编辑弹窗 */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-value { font-size: 14px; color: var(--text-primary); }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-input.num-mono { font-family: var(--font-number); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
</style>
