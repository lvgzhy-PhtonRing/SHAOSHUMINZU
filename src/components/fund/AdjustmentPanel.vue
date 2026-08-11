<template>
  <div class="card">
    <div class="card-title">校对核缺</div>
    <div class="card-desc">系统可用资金与券商实际余额的差额修正。只调可用资金/总资产，不计入总资本</div>

    <div class="amount-row">
      <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入差额金额" class="big-input num-mono" />
    </div>
    <div class="action-row">
      <button class="act-btn add" :disabled="!deltaValid" @click="doAdjust('add')">校对核缺 +</button>
      <button class="act-btn remove" :disabled="!deltaValid" @click="doAdjust('remove')">校对核缺 −</button>
    </div>

    <!-- 新增/编辑确认弹窗 -->
    <teleport to="body">
      <div v-if="showDialog" class="overlay" @click.self="closeDialog">
        <div class="dialog">
          <div class="dlg-title">{{ editingId ? '编辑校对核缺' : '确认校对核缺' }}</div>
          <div class="dlg-info">
            {{ adjType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(adjAmount) }}</b> 元
          </div>
          <div class="dlg-field">
            <label class="dlg-label">日期</label>
            <input v-model="adjDate" type="date" class="dlg-input" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="adjNote" type="text" class="dlg-input" placeholder="选填，如分红、手续费差等" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="closeDialog">取消</button>
            <button :class="adjType==='add'?'d-ok add':'d-ok remove'" @click="submit">✅ 确认</button>
          </div>
        </div>
      </div>

      <!-- 删除确认 -->
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="dialog">
          <div class="dlg-title">确认删除</div>
          <div class="dlg-info">确定删除此条校对核缺记录？</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>{{ deleting.type === 'add' ? '校对核缺+' : '校对核缺−' }}</span>
              <span class="num-mono">{{ formatMoney(deleting.amount) }}</span>
            </div>
            <div v-if="deleting.note" class="dlg-row">
              <span>备注</span>
              <span>{{ deleting.note }}</span>
            </div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deleting = null">取消</button>
            <button class="d-ok del" @click="doDelete">🗑️ 确认删除</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 独立列表明细 -->
    <div class="adjust-list">
      <div class="log-header">
        <span class="log-title">校对核缺明细</span>
        <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
      </div>
      <div v-if="!logs.length" class="list-empty">暂无校对核缺记录</div>
      <div v-else class="log-items">
        <div v-for="log in logs" :key="log.id" class="log-item">
          <div class="log-icon">{{ log.type === 'add' ? '➕' : '➖' }}</div>
          <div class="log-info">
            <div class="log-detail">
              <span class="log-action adjust">{{ log.type === 'add' ? '校对核缺+' : '校对核缺−' }}</span>
              <span class="log-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
                {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
              </span>
            </div>
            <div class="log-meta">
              <span>{{ formatDate(log.created_at) }}</span>
              <span v-if="log.note"> · {{ log.note }}</span>
            </div>
          </div>
          <div class="log-actions">
            <button class="edit-btn" @click="startEdit(log)">✏️</button>
            <button class="del-btn" @click="deleting = log">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  logs: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
})
const emit = defineEmits(['add', 'edit', 'delete'])

// ===== 新增 =====
const deltaAmount = ref('')
const showDialog = ref(false)
const adjType = ref('add')
const adjAmount = ref(0)
const adjDate = ref(todayStr())
const adjNote = ref('')
const editingId = ref(null)

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function doAdjust(type) {
  adjType.value = type
  adjAmount.value = parseFloat(deltaAmount.value)
  editingId.value = null
  adjDate.value = todayStr()
  adjNote.value = ''
  showDialog.value = true
}

function startEdit(log) {
  adjType.value = log.type
  adjAmount.value = log.amount
  editingId.value = log.id
  adjDate.value = (log.created_at || '').slice(0, 10) || todayStr()
  adjNote.value = log.note || ''
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  editingId.value = null
}

function submit() {
  if (!adjAmount.value || adjAmount.value <= 0) return
  if (editingId.value) {
    emit('edit', { id: editingId.value, amount: adjAmount.value, note: adjNote.value, date: adjDate.value, type: adjType.value })
  } else {
    emit('add', { type: adjType.value, amount: adjAmount.value, note: adjNote.value, date: adjDate.value })
  }
  closeDialog()
  deltaAmount.value = ''
}

function doDelete() {
  if (!deleting.value) return
  emit('delete', deleting.value)
  deleting.value = null
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }

.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--color-warn); }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.add { background: #7c4dff; color: #fff; }
.act-btn.remove { background: #ff6b35; color: #fff; }

/* 列表明细 */
.adjust-list { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); }
.list-empty { font-size: 12px; color: var(--text-muted); padding: 10px 0; text-align: center; }
.log-items { display: flex; flex-direction: column; gap: 4px; }
.log-item { display: flex; gap: 10px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); }
.log-icon { font-size: 18px; padding-top: 2px; }
.log-info { flex: 1; min-width: 0; }
.log-detail { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.log-action { font-size: 13px; font-weight: 500; }
.log-action.adjust { color: var(--color-warn); }
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

/* 弹窗 */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--color-warn); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer; color: #fff;
}
.d-ok.add { background: #7c4dff; }
.d-ok.remove { background: #ff6b35; }
.d-ok.del { background: var(--color-fall); }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
</style>
