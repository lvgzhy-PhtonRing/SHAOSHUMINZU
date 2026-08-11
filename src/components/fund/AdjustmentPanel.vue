<template>
  <div class="card">
    <div class="card-title">券商APP校对</div>
    <div class="card-desc">输入券商APP显示的「账户资产」，系统自动计算差额并记录。只调可用资金/总资产，不计入总资本</div>

    <div v-if="tradingLocked" class="lock-banner">
      ⛔ 交易时段内（工作日 9:00–15:30）禁止校对核缺，请在 15:30 收盘后操作
      <div class="lock-note">法定休市日仍按工作日判断，以券商实际休市为准</div>
    </div>

    <div class="amount-row">
      <input
        v-model="brokerAsset"
        type="number"
        inputmode="decimal"
        placeholder="券商账户资产（元）"
        class="big-input num-mono"
        :disabled="tradingLocked"
      />
    </div>
    <div class="action-row">
      <button class="act-btn gen" :disabled="tradingLocked || !brokerValid || submitting" @click="generate">生成校对核缺</button>
    </div>
    <div v-if="brokerValid" class="diff-preview" :class="diff >= 0 ? 'pos' : 'neg'">
      差额 = 券商账户资产 − 系统账户资产 =
      <b class="num-mono">{{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}</b>
      <span class="hint">系统账户资产（市值 + 可用资金）{{ formatMoney(systemAsset) }}</span>
    </div>

    <!-- 确认弹窗 -->
    <teleport to="body">
      <div v-if="showDialog" class="overlay" @click.self="closeDialog">
        <div class="dialog">
          <div class="dlg-title">确认校对核缺</div>
          <div class="dlg-info">
            <b class="num-mono">{{ adjType === 'add' ? '+' : '-' }}{{ formatMoney(adjAmount) }}</b> 元
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

    <!-- 独立列表明细（左滑删除） -->
    <div class="adjust-list">
      <div class="log-header">
        <span class="log-title">校对核缺明细</span>
        <span class="swipe-hint">◀ 左滑删除</span>
        <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
      </div>
      <div v-if="!logs.length" class="list-empty">暂无校对核缺记录</div>
      <div v-else class="trade-log-list">
        <van-swipe-cell v-for="log in logs" :key="log.id" :right-width="70">
          <div class="trade-log-item">
            <div class="tli-body">
              <div class="tli-header">
                <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">
                  {{ log.type === 'add' ? '校对核缺+' : '校对核缺−' }}
                </span>
                <span class="tli-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
                  {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
                </span>
              </div>
              <div v-if="log.note" class="tli-note">{{ log.note }}</div>
              <div class="tli-meta">
                <span>{{ formatDate(log.created_at) }}</span>
              </div>
            </div>
            <span class="tli-arrow">›</span>
          </div>
          <template #right>
            <div class="swipe-actions">
              <button class="swipe-del-btn" @click.stop="deleting = log">删除</button>
            </div>
          </template>
        </van-swipe-cell>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  logs: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  marketValue: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 }
})
const emit = defineEmits(['add', 'delete'])

// ===== 交易时段判定：工作日 9:00–15:30 禁止（分钟 540–930） =====
const tradingLocked = computed(() => {
  const d = new Date()
  const day = d.getDay() // 0=周日 6=周六
  if (day === 0 || day === 6) return false
  const minutes = d.getHours() * 60 + d.getMinutes()
  return minutes >= 540 && minutes < 930
})

// ===== 券商账户资产 → 差额 =====
const brokerAsset = ref('')
const brokerValid = computed(() => {
  const v = parseFloat(brokerAsset.value)
  return !isNaN(v) && v > 0
})
const systemAsset = computed(() => props.marketValue + props.totalAvailable)
const diff = computed(() => {
  if (!brokerValid.value) return 0
  return parseFloat(brokerAsset.value) - systemAsset.value
})

// ===== 确认弹窗 =====
const showDialog = ref(false)
const adjType = ref('add')
const adjAmount = ref(0)
const adjDate = ref(todayStr())
const adjNote = ref('')

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generate() {
  const d = diff.value
  if (Math.abs(d) < 0.005) {
    alert('系统与券商一致，无需校对')
    return
  }
  adjType.value = d > 0 ? 'add' : 'remove'
  adjAmount.value = Math.abs(d)
  adjDate.value = todayStr()
  adjNote.value = ''
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
}

function submit() {
  if (!adjAmount.value || adjAmount.value <= 0) return
  emit('add', { type: adjType.value, amount: adjAmount.value, note: adjNote.value, date: adjDate.value })
  closeDialog()
  brokerAsset.value = ''
}

// ===== 删除 =====
const deleting = ref(null)
function doDelete() {
  if (!deleting.value) return
  emit('delete', deleting.value)
  deleting.value = null
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }

.lock-banner {
  background: rgba(233,69,96,0.12); color: var(--color-rise);
  font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md);
  margin-bottom: 12px; line-height: 1.5;
}
.lock-note { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.big-input {
  flex: 1; min-width: 0; width: 100%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 18px; padding: 10px 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--color-warn); }
.big-input:disabled { opacity: 0.4; cursor: not-allowed; }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.gen { background: #7c4dff; color: #fff; }

.diff-preview {
  font-size: 12px; color: var(--text-secondary); margin-top: 10px;
  padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);
}
.diff-preview b { font-size: 14px; }
.diff-preview.pos b { color: var(--color-rise); }
.diff-preview.neg b { color: var(--color-fall); }
.diff-preview .hint { font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px; }

/* 列表明细（参考交易明细样式，左滑删除） */
.adjust-list { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
.log-header { display: flex; align-items: center; gap: 8px; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.log-count { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
.list-empty { font-size: 12px; color: var(--text-muted); padding: 10px 0; text-align: center; }
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
.swipe-del-btn { width: 70px; border: none; background: var(--color-fall); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }

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
