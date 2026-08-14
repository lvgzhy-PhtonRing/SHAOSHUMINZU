<template>
  <div class="capital-log-list">
    <div class="log-header">
      <span class="log-title">资本变动记录</span>
      <span class="swipe-hint">◀ 左滑编辑</span>
      <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
    </div>
    <div v-if="!logs.length"><EmptyState icon="💰" text="暂无资金变动记录" /></div>
    <div v-else class="trade-log-list">
      <van-swipe-cell v-for="log in logs" :key="log.id" :right-width="140">
        <div class="trade-log-item">
          <div class="tli-body">
            <div class="tli-header">
              <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">
                {{ log.pool_id ? (log.type === 'add' ? '卖出' : '买入') : (log.type === 'add' ? '增资' : '减资') }}
              </span>
              <span class="tli-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
                {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
              </span>
            </div>
            <div v-if="log.note" class="tli-note">{{ log.note }}</div>
            <div class="tli-meta">
              <span>{{ formatDateString(log.created_at) }}</span>
            </div>
          </div>
          <span class="tli-arrow">›</span>
        </div>
        <template #right>
          <div class="swipe-actions">
            <button class="swipe-edit-btn" @click.stop="startEdit(log)">编辑</button>
            <button class="swipe-del-btn" @click.stop="confirmDelete(log)">删除</button>
          </div>
        </template>
      </van-swipe-cell>
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
          <template v-if="editing.pool_id">
            <div class="dlg-field">
              <label class="dlg-label">股票</label>
              <span class="dlg-value">{{ editStockCode || '—' }}</span>
            </div>
            <div class="dlg-field">
              <label class="dlg-label">成交数量（股）</label>
              <input v-model="editQuantity" type="number" inputmode="numeric" class="dlg-input num-mono" placeholder="0" />
            </div>
          </template>
          <div class="dlg-field">
            <label class="dlg-label">金额（元）</label>
            <input v-model="editAmount" type="number" inputmode="decimal" class="dlg-input num-mono" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">日期</label>
            <input v-model="editDate" type="date" class="dlg-input" />
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

      <!-- 删除确认弹窗 -->
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="dialog">
          <div class="dlg-title">确认删除</div>
          <div class="dlg-info">确定删除此条记录？</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>{{ deleting.pool_id ? (deleting.type === 'add' ? '卖出' : '买入') : (deleting.type === 'add' ? '增资' : '减资') }}</span>
              <span class="num-mono">{{ formatMoney(deleting.amount) }}</span>
            </div>
            <div v-if="deleting.note" class="dlg-row">
              <span>备注</span>
              <span>{{ deleting.note }}</span>
            </div>
            <div class="dlg-warn">
              ⚠️ 删除后将联动更新持仓和资产数据
            </div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deleting = null">取消</button>
            <button class="d-ok del" @click="doDelete">🗑️ 确认删除</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { formatMoney } from '@/utils/formatters'
import { fetchTransactionsByPoolStock } from '@/api/supabase'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps({ logs: { type: Array, default: () => [] } })
const emit = defineEmits(['delete', 'edit'])

// 编辑
const editing = ref(null)
const editAmount = ref('')
const editNote = ref('')
const editDate = ref('')
const editQuantity = ref('')
const editStockCode = ref('')

// 删除
const deleting = ref(null)

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function parseStockCode(note) {
  if (!note) return ''
  const parts = note.split(' ')
  return parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
}

// ===== 编辑 =====
async function startEdit(log) {
  editing.value = log
  editAmount.value = String(log.amount)
  editNote.value = log.note || ''
  editDate.value = (log.created_at || '').slice(0, 10)
  editQuantity.value = ''
  editStockCode.value = ''

  if (log.pool_id) {
    const code = parseStockCode(log.note || '')
    editStockCode.value = code
    if (code) {
      try {
        const txs = await fetchTransactionsByPoolStock(log.pool_id, code)
        const match = txs.find(t => Math.abs(t.amount - log.amount) < 0.01)
        if (match) editQuantity.value = String(match.quantity)
      } catch (e) { console.error('Fetch tx for edit:', e) }
    }
  }
}

function saveEdit() {
  if (!editing.value) return
  const amount = parseFloat(editAmount.value)
  if (!amount || amount <= 0) return
  const payload = { id: editing.value.id, amount, note: editNote.value, date: editDate.value, origAmount: editing.value.amount }
  if (editing.value.pool_id) {
    payload.quantity = parseInt(editQuantity.value) || 0
    payload.stock_code = editStockCode.value
    payload.pool_id = editing.value.pool_id
    payload.type = editing.value.type
  }
  emit('edit', payload)
  editing.value = null
}

// ===== 删除 =====
function confirmDelete(log) {
  deleting.value = log
}

function doDelete() {
  if (!deleting.value) return
  emit('delete', deleting.value)  // 传完整 log 对象
  deleting.value = null
}
</script>

<style scoped>
.log-header { display: flex; align-items: center; gap: 8px; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, var(--color-rise), #ff8a9a);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.log-count { font-size: 12px; color: var(--text-secondary); margin-left: auto; }

/* 列表明细（参考交易明细样式） */
.trade-log-list { display: flex; flex-direction: column; gap: 2px; }
.trade-log-item { padding: 12px 14px; background: var(--bg-hover); display: flex; gap: 8px; align-items: center; border-radius: var(--radius-md); }
.tli-body { flex: 1; min-width: 0; }
.tli-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.tli-action { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-amount { font-size: 14px; font-weight: 700; font-family: var(--font-number); }
.tli-amount.rise { color: var(--color-rise); }
.tli-amount.fall { color: var(--color-fall); }
.tli-note { font-size: 13px; color: var(--text-primary); font-weight: 500; margin-bottom: 4px; }
.tli-meta { font-size: 11px; color: var(--text-muted); }
.tli-arrow { font-size: 16px; color: var(--text-muted); opacity: 0.3; flex-shrink: 0; }
.swipe-actions { display: flex; height: 100%; }
.swipe-edit-btn { width: 70px; border: none; background: var(--bg-accent); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }
.swipe-del-btn { width: 70px; border: none; background: var(--color-fall); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }

/* 弹窗共用 */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-solid); border-radius: var(--radius-lg); padding: 20px;
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
.d-ok.del { background: var(--color-fall); }

.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.dlg-warn { font-size: 11px; color: var(--color-warn); padding: 6px 0; text-align: center; }
</style>
