<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="dialog">
        <div class="dlg-head">
          <span class="dlg-title">资本明细</span>
          <button class="dlg-close" @click="close">✕</button>
        </div>

        <!-- 增资/减资 确认视图 -->
        <template v-if="confirming">
          <div class="dlg-title sub">{{ capType === 'add' ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-info"><b class="num-mono">{{ formatMoney(capAmount) }}</b> 元</div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="capNote" type="text" class="dlg-input" placeholder="选填" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="confirming = false">返回</button>
            <button :class="capType === 'add' ? 'd-ok add' : 'd-ok remove'" @click="submit">{{ capType === 'add' ? '✅ 确认增资' : '✅ 确认减资' }}</button>
          </div>
        </template>

        <!-- 主视图：增资/减资 + 变动明细 -->
        <template v-else>
          <div class="amount-row">
            <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额（元）" class="big-input num-mono" />
          </div>
          <div class="action-row">
            <button class="act-btn add" :disabled="!deltaValid" @click="doCapital('add')">增资</button>
            <button class="act-btn remove" :disabled="!deltaValid" @click="doCapital('remove')">减资</button>
          </div>

          <div class="divider"></div>
          <div class="dlg-list">
            <CapitalLogList :logs="logs" @delete="$emit('delete', $event)" @edit="$emit('edit', $event)" />
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'
import CapitalLogList from './CapitalLogList.vue'

defineProps({
  show: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:show', 'capital-change', 'delete', 'edit'])

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
  // 留在弹窗内，展示更新后的明细
  confirming.value = false
  deltaAmount.value = ''
  capNote.value = ''
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column;
}
.dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.dlg-title { font-size: 17px; font-weight: 700; }
.dlg-title.sub { margin-bottom: 8px; }
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }

/* 资本增减 */
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.amount-row { display: flex; align-items: center; margin-bottom: 10px; }
.big-input {
  flex: 1; min-width: 0; width: 100%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 18px; padding: 10px 12px;
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

.divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0 12px; }

/* 变动明细列表 */
.dlg-list { flex: 1; overflow-y: auto; min-height: 0; }

/* 确认视图 */
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
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
