<template>
  <div class="allocation-form">
    <!-- ===== 总金额 + 增资/减资 ===== -->
    <div class="amount-card">
      <div class="amount-row">
        <span class="amount-label">总金额</span>
        <input v-model="totalAmount" type="number" inputmode="decimal" placeholder="0" class="amount-input num-mono" @input="recalcAmounts" />
        <span class="amount-unit">元</span>
      </div>
      <div class="action-row">
        <button class="action-btn add-btn" :disabled="!canSubmit" @click="confirmAdd">增资 ➕</button>
        <button class="action-btn remove-btn" :disabled="!canSubmit" @click="confirmRemove">减资 ➖</button>
      </div>
    </div>

    <!-- ===== 子池百分比分配 ===== -->
    <div class="alloc-card">
      <div class="alloc-header">
        <span class="alloc-title">子池分配 ({{ totalPercent.toFixed(0) }}%)</span>
        <button class="link-btn" :class="{ linked: isLinked }" @click="toggleLink">
          {{ isLinked ? '🔗 已联动' : '🔓 独立' }}
        </button>
      </div>

      <!-- 共有 -->
      <div class="pool-row">
        <div class="pool-left">
          <span class="pool-dot" style="background:#0f3460"></span>
          <span class="pool-name">共有</span>
        </div>
        <button class="adj-btn" @click="adjustPool('共有', -1)">−</button>
        <input type="number" class="pct-input num-mono" :value="pcts['共有'].toFixed(1)" @input="e => onPoolPct('共有', parseFloat(e.target.value)||0)" />
        <span class="pct-unit">%</span>
        <button class="adj-btn" @click="adjustPool('共有', 1)">+</button>
        <span class="pool-amount num-mono">{{ formatMoney(pcts['共有'] * total / 100) }}</span>
      </div>

      <!-- 四人组 -->
      <div class="user-group" :class="{ linked: isLinked }">
        <div v-if="isLinked" class="link-hint">四人联动 — 调整一人同步全部</div>
        <div v-for="p in userPools" :key="p.key" class="pool-row">
          <div class="pool-left">
            <span class="pool-dot" :style="{ background: p.color }"></span>
            <span class="pool-name">{{ p.name }}</span>
          </div>
          <button class="adj-btn" @click="adjustPool(p.key, -1)">−</button>
          <input type="number" class="pct-input num-mono" :value="pcts[p.key].toFixed(1)" @input="e => onPoolPct(p.key, parseFloat(e.target.value)||0)" />
          <span class="pct-unit">%</span>
          <button class="adj-btn" @click="adjustPool(p.key, 1)">+</button>
          <span class="pool-amount num-mono">{{ formatMoney(pcts[p.key] * total / 100) }}</span>
        </div>
      </div>
    </div>

    <!-- ===== 确认弹窗 ===== -->
    <teleport to="body">
      <div v-if="showConfirm" class="overlay" @click.self="showConfirm=false">
        <div class="confirm-dlg">
          <div class="dlg-title">{{ isAddMode ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-amount">{{ isAddMode ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(total) }}</b> 元</div>
          <div class="dlg-rows">
            <div v-for="p in poolList" :key="p.key" class="dlg-row">
              <span :style="{color:p.color}">● {{ p.name }}</span>
              <span class="num-mono">{{ pcts[p.key].toFixed(1) }}% → {{ formatMoney(pcts[p.key] * total / 100) }}</span>
            </div>
          </div>
          <van-field v-model="confirmNote" label="备注" placeholder="选填" :border="false" style="background:rgba(255,255,255,0.03);border-radius:6px;margin:8px 0" />
          <div class="dlg-actions">
            <button class="dlg-cancel" @click="showConfirm=false">取消</button>
            <button class="dlg-ok add" v-if="isAddMode" @click="doSubmit('add')">✅ 确认增资</button>
            <button class="dlg-ok remove" v-else @click="doSubmit('remove')">✅ 确认减资</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  pools: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
})
const emit = defineEmits(['submit'])

const totalAmount = ref('')
const isLinked = ref(true)
const showConfirm = ref(false)
const isAddMode = ref(true)
const confirmNote = ref('')

const pcts = reactive({ '共有': 40, '春': 15, '维': 15, '队': 15, '回': 15 })

const userPools = [
  { key: '春', name: '春', color: '#e94560' },
  { key: '维', name: '维', color: '#00d2a1' },
  { key: '队', name: '队', color: '#ffc107' },
  { key: '回', name: '回', color: '#7c4dff' },
]
const poolList = [
  { key: '共有', name: '共有', color: '#0f3460' },
  ...userPools
]

const total = computed(() => parseFloat(totalAmount.value) || 0)
const totalPercent = computed(() => {
  let s = 0
  for (const p of poolList) s += pcts[p.key] || 0
  return s
})
const canSubmit = computed(() => total.value > 0 && Math.abs(totalPercent.value - 100) < 0.5)

// ====== 联动 ======
function onPoolPct(key, val) {
  val = Math.max(0, Math.min(100, val))
  if (isLinked.value) {
    if (key === '共有') {
      pcts['共有'] = val
      const each = (100 - val) / 4
      for (const p of userPools) pcts[p.key] = each
    } else {
      const each = val
      for (const p of userPools) pcts[p.key] = each
      pcts['共有'] = Math.max(0, 100 - each * 4)
    }
  } else {
    pcts[key] = val
  }
}

function adjustPool(key, d) {
  const cur = pcts[key] || 0
  onPoolPct(key, Math.round((cur + d) * 10) / 10)
}

function toggleLink() {
  isLinked.value = !isLinked.value
  if (isLinked.value) {
    const avg = userPools.reduce((s, p) => s + pcts[p.key], 0) / 4
    onPoolPct('春', avg)
  }
}

function recalcAmounts() {}

function confirmAdd() { isAddMode.value = true; showConfirm.value = true }
function confirmRemove() { isAddMode.value = false; showConfirm.value = true }

function doSubmit(type) {
  const t = total.value
  emit('submit', {
    type,
    totalAmount: t,
    allocations: poolList.map(p => ({
      pool_id: props.pools.find(pl => pl.name === p.name)?.id,
      pool_name: p.name,
      amount: pcts[p.key] * t / 100,
      percent: pcts[p.key]
    })),
    note: confirmNote.value
  })
  showConfirm.value = false
  totalAmount.value = ''
  confirmNote.value = ''
}
</script>

<style scoped>
/* ===== 总金额 ===== */
.amount-card {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px;
}
.amount-row { display: flex; align-items: center; gap: 8px; }
.amount-label { font-size: 14px; font-weight: 600; }
.amount-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 10px 12px;
  text-align: right; outline: none; font-family: var(--font-number);
}
.amount-input:focus { border-color: var(--bg-accent); }
.amount-unit { font-size: 13px; color: var(--text-secondary); }
.action-row { display: flex; gap: 10px; margin-top: 12px; }
.action-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.add-btn { background: #00d2a1; color: #1a1a2e; }
.remove-btn { background: #e94560; color: #fff; }

/* ===== 子池 ===== */
.alloc-card {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px;
}
.alloc-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}
.alloc-title { font-size: 14px; font-weight: 600; }
.link-btn {
  padding: 4px 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-round); background: transparent;
  color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.link-btn.linked { color: #00d2a1; border-color: #00d2a1; }

.pool-row {
  display: flex; align-items: center; gap: 6px; padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.pool-row:last-child { border-bottom: none; }
.pool-left { display: flex; align-items: center; gap: 8px; min-width: 50px; }
.pool-dot { width: 8px; height: 8px; border-radius: 50%; }
.pool-name { font-size: 13px; font-weight: 500; }
.adj-btn {
  width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%; background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  line-height: 1;
}
.adj-btn:active { background: var(--bg-accent); color: #fff; }
.pct-input {
  width: 52px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px; color: #fff; font-size: 14px; padding: 5px 6px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.pct-unit { font-size: 12px; color: var(--text-secondary); }
.pool-amount {
  margin-left: auto; font-size: 13px; font-weight: 600; color: var(--text-secondary);
  font-family: var(--font-number); min-width: 70px; text-align: right;
}

.user-group { margin-top: 8px; padding: 4px 0; }
.user-group.linked {
  border: 1px dashed rgba(0,210,161,0.12); border-radius: var(--radius-md); padding: 6px 8px;
}
.link-hint { font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 2px; }

/* ===== 弹窗 ===== */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.confirm-dlg {
  background: var(--bg-card); border-radius: var(--radius-lg);
  padding: 20px; width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.dlg-amount { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-amount b { color: #fff; }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.dlg-actions { display: flex; gap: 10px; margin-top: 12px; }
.dlg-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.dlg-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer; color: #fff;
}
.dlg-ok.add { background: #00d2a1; color: #1a1a2e; }
.dlg-ok.remove { background: #e94560; }
</style>
