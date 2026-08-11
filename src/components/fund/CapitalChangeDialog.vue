<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="dialog">
        <template v-if="!confirming">
          <div class="dlg-head">
            <span class="dlg-title">资本增减</span>
            <button class="dlg-close" @click="close">✕</button>
          </div>
          <div class="dlg-info">为总资金池增加或减少资金</div>
          <div class="amount-row">
            <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额" class="big-input num-mono" />
          </div>
          <div class="action-row">
            <button class="act-btn add" :disabled="!deltaValid" @click="doCapital('add')">增资 ➕</button>
            <button class="act-btn remove" :disabled="!deltaValid" @click="doCapital('remove')">减资 ➖</button>
          </div>
        </template>
        <template v-else>
          <div class="dlg-title">{{ capType === 'add' ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-info">{{ capType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(capAmount) }}</b> 元</div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="capNote" type="text" class="dlg-input" placeholder="选填" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="confirming = false">返回</button>
            <button :class="capType === 'add' ? 'd-ok add' : 'd-ok remove'" @click="submit">{{ capType === 'add' ? '✅ 确认增资' : '✅ 确认减资' }}</button>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['update:show', 'capital-change'])

const deltaAmount = ref('')
const confirming = ref(false)
const capType = ref('add')
const capAmount = ref(0)
const capNote = ref('')

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)

function close() {
  emit('update:show', false)
  confirming.value = false
  deltaAmount.value = ''
  capNote.value = ''
}

function doCapital(type) {
  capType.value = type
  capAmount.value = parseFloat(deltaAmount.value)
  confirming.value = true
}

function submit() {
  emit('capital-change', { type: capType.value, amount: capAmount.value, note: capNote.value })
  close()
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.dlg-title { font-size: 17px; font-weight: 700; }
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }
.dlg-info { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--bg-accent); }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.add { background: #00d2a1; color: #1a1a2e; }
.act-btn.remove { background: #e94560; color: #fff; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--bg-accent); }
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
.d-ok.add { background: #00d2a1; color: #1a1a2e; }
.d-ok.remove { background: #e94560; }
</style>
