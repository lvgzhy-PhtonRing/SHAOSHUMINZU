<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="$emit('close')">
      <div class="dialog">
        <div class="dlg-title">校对手续费</div>

        <div class="fv-info">
          <div class="fv-row">
            <span class="fv-label">股票</span>
            <span>{{ stockName }} <span class="fv-code">{{ stockCode }}</span></span>
          </div>
          <div class="fv-row">
            <span class="fv-label">持仓</span>
            <span class="num-mono">{{ holdingQty }} 股</span>
          </div>
        </div>

        <div class="fv-section">
          <div class="fv-cost-row">
            <span>系统成本价</span>
            <span class="num-mono fv-cost">{{ formatPrice(currentCost) }}</span>
          </div>
          <div class="fv-input-row">
            <span>券商成本价</span>
            <input
              v-model="brokerCost"
              type="number"
              inputmode="decimal"
              step="0.001"
              placeholder="输入券商APP成本价"
              class="fv-input num-mono"
              @input="calcDiff"
            />
            <span>元/股</span>
          </div>
        </div>

        <div v-if="diffPerShare !== 0 && brokerCost" class="fv-result">
          <div class="fv-result-row">
            <span>差额</span>
            <span :class="diffPerShare > 0 ? 'rise' : 'fall'" class="num-mono">
              {{ diffPerShare > 0 ? '+' : '' }}{{ formatPrice(diffPerShare) }} × {{ holdingQty }} 股
            </span>
          </div>
          <div class="fv-result-total">
            = 手续费 <span class="num-mono" :class="totalFee > 0 ? 'rise' : 'fall'">
              {{ totalFee > 0 ? '+' : '' }}{{ formatMoney(totalFee) }}
            </span>
          </div>
        </div>
        <div v-if="brokerCost && diffPerShare === 0" class="fv-no-diff">
          成本价一致，无需校对
        </div>

        <div class="fv-note">
          <input v-model="note" type="text" class="fv-note-input" placeholder="备注（可选）" />
        </div>

        <div class="fv-btns">
          <button class="fv-cancel" @click="$emit('close')">取消</button>
          <button class="fv-ok" :disabled="!canConfirm || submitting" @click="confirm">
            ✅ {{ submitting ? '提交中…' : '确认校对' }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'

const props = defineProps({
  show: Boolean,
  poolId: Number,
  stockCode: String,
  stockName: String,
  holdingQty: Number,
  currentCost: Number,
  transactions: Array  // [{ id, quantity, amount }] 该池该股票的买入交易
})
const emit = defineEmits(['close', 'verified'])

const brokerCost = ref('')
const note = ref('')
const submitting = ref(false)

const diffPerShare = computed(() => {
  if (!brokerCost.value) return 0
  return parseFloat(brokerCost.value) - props.currentCost
})
const totalFee = computed(() => {
  return parseFloat((diffPerShare.value * props.holdingQty).toFixed(2))
})
const canConfirm = computed(() => {
  return brokerCost.value && parseFloat(brokerCost.value) > 0 && diffPerShare.value !== 0
})

function calcDiff() {}

async function confirm() {
  if (!canConfirm.value || submitting.value) return
  submitting.value = true
  const newCost = parseFloat(brokerCost.value)
  const fee = totalFee.value
  const totalOrigQty = props.transactions.reduce((s, t) => s + t.quantity, 0) || 1

  const allocations = []
  let remainingFee = fee
  for (let i = 0; i < props.transactions.length; i++) {
    const t = props.transactions[i]
    if (i === props.transactions.length - 1) {
      allocations.push({ txId: t.id, fee: parseFloat(remainingFee.toFixed(2)), oldAmount: t.amount, newAmount: parseFloat((t.amount + remainingFee).toFixed(2)) })
    } else {
      const share = parseFloat((fee * t.quantity / totalOrigQty).toFixed(2))
      remainingFee -= share
      allocations.push({ txId: t.id, fee: share, oldAmount: t.amount, newAmount: parseFloat((t.amount + share).toFixed(2)) })
    }
  }

  emit('verified', { poolId: props.poolId, stockCode: props.stockCode, newCost, allocations, note: note.value })
  submitting.value = false
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.dialog { background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px; width: 100%; max-width: 380px; }
.dlg-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
.fv-info { margin-bottom: 12px; }
.fv-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.fv-label { color: var(--text-secondary); }
.fv-code { font-size: 11px; color: var(--text-muted); }
.fv-section { margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); }
.fv-cost-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.fv-cost { font-size: 16px; color: var(--text-primary); }
.fv-input-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.fv-input { flex: 1; min-width: 0; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 16px; padding: 8px 10px; text-align: right; outline: none; }
.fv-input:focus { border-color: #00d2a1; }
.fv-result { margin-bottom: 12px; padding: 10px; background: rgba(0,210,161,0.05); border-radius: var(--radius-md); text-align: center; }
.fv-result-row { font-size: 13px; margin-bottom: 4px; }
.fv-result-total { font-size: 15px; font-weight: 600; }
.fv-no-diff { text-align: center; padding: 12px; font-size: 13px; color: var(--text-secondary); }
.fv-note { margin-bottom: 16px; }
.fv-note-input { width: 100%; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; outline: none; box-sizing: border-box; }
.fv-btns { display: flex; gap: 10px; }
.fv-cancel { flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
.fv-ok { flex: 2; padding: 10px; border: none; border-radius: var(--radius-md); background: #00d2a1; color: #1a1a2e; font-size: 14px; font-weight: 600; cursor: pointer; }
.fv-ok:disabled { opacity: 0.3; cursor: not-allowed; }
.rise { color: var(--color-rise); }
.fall { color: var(--color-fall); }
</style>
