<template>
  <div class="allocation-form">
    <!-- ===== 1. 子池资金分配（万元） ===== -->
    <div class="card">
      <div class="card-title">子池资金分配</div>
      <div class="card-desc">
        总可用资金 <b class="num-mono">{{ formatMoney(totalAvailable) }}</b>
        <span class="unit-hint">单位：万元</span>
        <button class="link-btn" :class="{ linked: isLinked }" @click="toggleLink">
          {{ isLinked ? '🔗' : '🔓' }}
        </button>
      </div>

      <!-- 共有 -->
      <div class="pool-row">
        <div class="pool-left"><span class="dot" style="background:#0f3460"></span>共有</div>
        <button class="adj" @click="adjust('共有', -0.5)">−</button>
        <input type="number" class="pct" :value="wanAmts['共有']" @input="e => onAmt('共有', parseFloat(e.target.value)||0)" step="0.01" />
        <span class="pc">万</span>
        <button class="adj" @click="adjust('共有', 0.5)">+</button>
        <span class="money num-mono">{{ formatMoney(amts['共有']) }}</span>
      </div>

      <!-- 四人 -->
      <div class="user-group" :class="{ linked: isLinked }">
        <div v-if="isLinked" class="hint">四人联动 · 平分剩余资金</div>
        <div v-for="p in users" :key="p.key" class="pool-row">
          <div class="pool-left"><span class="dot" :style="{ background: p.color }"></span>{{ p.name }}</div>
          <button class="adj" @click="adjust(p.key, -0.5)">−</button>
          <input type="number" class="pct" :value="wanAmts[p.key]" @input="e => onAmt(p.key, parseFloat(e.target.value)||0)" step="0.01" />
          <span class="pc">万</span>
          <button class="adj" @click="adjust(p.key, 0.5)">+</button>
          <span class="money num-mono">{{ formatMoney(amts[p.key]) }}</span>
        </div>
      </div>

      <!-- 合计与未分配 -->
      <div class="total-row">
        <span>已分配</span>
        <span class="num-mono">{{ formatMoney(allocTotal) }}</span>
        <span class="sep">/</span>
        <span>未分配</span>
        <span class="num-mono" :class="unalloc >= 0 ? '' : 'fall'">{{ formatMoney(unalloc) }}</span>
      </div>

      <button class="apply-btn" :disabled="unalloc < 0" @click="confirmAlloc">
        确认分配
      </button>
      <div v-if="unalloc < 0" class="err">已分配金额超过总可用资金 {{ formatMoney(unalloc) }}</div>
    </div>

    <!-- ===== 2. 增减资金池 ===== -->
    <div class="card">
      <div class="card-title">增减资金池</div>
      <div class="card-desc">为总资金池增加或减少资金</div>
      <div class="amount-row">
        <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额" class="big-input num-mono" />
      </div>
      <div class="action-row">
        <button class="act-btn add" :disabled="!deltaValid" @click="doCapital('add')">增资 ➕</button>
        <button class="act-btn remove" :disabled="!deltaValid" @click="doCapital('remove')">减资 ➖</button>
      </div>
    </div>

    <!-- ===== 确认弹窗 (增资/减资) ===== -->
    <teleport to="body">
      <div v-if="showCapitalConfirm" class="overlay" @click.self="showCapitalConfirm=false">
        <div class="dialog">
          <div class="dlg-title">{{ capType === 'add' ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-info">{{ capType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(capAmount) }}</b> 元</div>
          <van-field v-model="capNote" label="备注" placeholder="选填" :border="false" style="background:rgba(255,255,255,0.03);border-radius:6px;margin:8px 0;padding:8px 10px" />
          <div class="dlg-btns">
            <button class="d-cancel" @click="showCapitalConfirm=false">取消</button>
            <button :class="capType==='add'?'d-ok add':'d-ok remove'" @click="submitCapital">{{ capType==='add'?'✅ 确认增资':'✅ 确认减资' }}</button>
          </div>
        </div>
      </div>

      <!-- 确认弹窗 (分配) -->
      <div v-if="showAllocConfirm" class="overlay" @click.self="showAllocConfirm=false">
        <div class="dialog">
          <div class="dlg-title">确认资金分配</div>
          <div class="dlg-info">总可用 <b class="num-mono">{{ formatMoney(totalAvailable) }}</b> 元</div>
          <div class="dlg-rows">
            <div v-for="p in allPools" :key="p.key" class="dlg-row">
              <span :style="{color:p.color}">● {{ p.name }}</span>
              <span class="num-mono">{{ wanAmts[p.key] }} 万 → {{ formatMoney(amts[p.key]) }}</span>
            </div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="showAllocConfirm=false">取消</button>
            <button class="d-ok alloc" @click="submitAlloc">✅ 确认分配</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  pools: { type: Array, default: () => [] },
  totalAvailable: { type: Number, default: 0 },
  submitting: { type: Boolean, default: false }
})
const emit = defineEmits(['capital-change', 'alloc-change'])

// ====== 增资/减资 ======
const deltaAmount = ref('')
const showCapitalConfirm = ref(false)
const capType = ref('add')
const capAmount = ref(0)
const capNote = ref('')

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)

function doCapital(type) {
  capType.value = type
  capAmount.value = parseFloat(deltaAmount.value)
  showCapitalConfirm.value = true
}

function submitCapital() {
  emit('capital-change', {
    type: capType.value,
    amount: capAmount.value,
    note: capNote.value
  })
  showCapitalConfirm.value = false
  deltaAmount.value = ''
  capNote.value = ''
}

// ====== 子池分配（金额·万元制） ======
const isLinked = ref(true)

const users = [
  { key: '春', name: '春', color: '#e94560' },
  { key: '维', name: '维', color: '#00d2a1' },
  { key: '队', name: '队', color: '#ffc107' },
  { key: '回', name: '回', color: '#7c4dff' },
]
const allPools = [
  { key: '共有', name: '共有', color: '#0f3460' },
  ...users
]

// 加载保存值：优先 poolAmounts（元），兼容旧 poolPercents（百分比）
function loadSavedAmts() {
  const raw = localStorage.getItem('poolAmounts')
  if (raw) {
    const parsed = JSON.parse(raw)
    // 检查是否为百分比旧数据（值在0-100之间且合计≈100）
    const vals = Object.values(parsed)
    const sum = vals.reduce((s, v) => s + v, 0)
    if (vals.every(v => v <= 100) && Math.abs(sum - 100) < 1) {
      // 旧百分比 → 按当前总可用换算为金额
      const amt = {}
      for (const k of Object.keys(parsed)) {
        amt[k] = Math.round(props.totalAvailable * parsed[k] / 100)
      }
      return amt
    }
    return parsed  // 已经是金额
  }
  // 无保存值：默认平分
  const each = Math.floor(props.totalAvailable / allPools.length / 10000) * 10000
  const amt = {}
  for (const p of allPools) amt[p.key] = each
  return amt
}

const amts = reactive(loadSavedAmts())

onMounted(() => {
  // 页面重访时恢复
  const raw = localStorage.getItem('poolAmounts')
  if (raw) {
    try {
      const saved = JSON.parse(raw)
      for (const k of Object.keys(saved)) {
        if (allPools.some(p => p.key === k)) amts[k] = saved[k]
      }
    } catch (e) {}
  }
})

// 万元显示值（取整到2位小数）
const wanAmts = computed(() => {
  const w = {}
  for (const p of allPools) w[p.key] = (amts[p.key] / 10000).toFixed(2)
  return w
})

// 已分配总额（元）
const allocTotal = computed(() => allPools.reduce((s, p) => s + amts[p.key], 0))

// 未分配（元），可为负数（超分配）
const unalloc = computed(() => props.totalAvailable - allocTotal.value)

// 联动：平分剩余资金
function splitRemaining() {
  const gongyou = amts['共有']
  const remaining = Math.max(0, props.totalAvailable - gongyou)
  const each = Math.floor(remaining / 4 / 100) * 100  // 取整到100元
  for (const p of users) amts[p.key] = each
}

// 用户输入金额（万元 → 元）
function onAmt(key, wanVal) {
  const yuan = Math.round(wanVal * 10000)
  amts[key] = Math.max(0, yuan)
  if (isLinked.value) {
    if (key === '共有') {
      splitRemaining()
    } else {
      // 四人等额
      const each = amts[key]
      for (const p of users) amts[p.key] = each
      amts['共有'] = Math.max(0, props.totalAvailable - each * 4)
    }
  }
}

// +/- 按钮（以万元为单位步进）
function adjust(key, stepWan) {
  const curWan = amts[key] / 10000
  const newWan = Math.max(0, curWan + stepWan)
  onAmt(key, Math.round(newWan * 100) / 100)  // 保留2位小数
}

function toggleLink() {
  isLinked.value = !isLinked.value
  if (isLinked.value) {
    splitRemaining()
  }
}

// ====== 提交 ======
const showAllocConfirm = ref(false)
function confirmAlloc() { showAllocConfirm.value = true }

function submitAlloc() {
  // 保存为金额（元）
  const rec = {}
  for (const p of allPools) rec[p.key] = amts[p.key]
  localStorage.setItem('poolAmounts', JSON.stringify(rec))
  // 同时清理旧百分比数据
  localStorage.removeItem('poolPercents')

  emit('alloc-change', {
    total: props.totalAvailable,
    pools: allPools.map(p => ({
      key: p.key,
      pool_id: props.pools.find(pl => pl.name === p.name)?.id,
      amount: amts[p.key],
      percent: props.totalAvailable > 0 ? (amts[p.key] / props.totalAvailable) * 100 : 0
    }))
  })
  showAllocConfirm.value = false
}
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.card-desc b { color: #fff; }
.unit-hint { font-size: 10px; color: var(--text-muted); margin-left: 6px; }

/* 增资/减资 */
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--bg-accent); }
.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.add { background: #00d2a1; color: #1a1a2e; }
.act-btn.remove { background: #e94560; color: #fff; }

/* 子池 */
.link-btn {
  vertical-align: middle; margin-left: 8px; padding: 2px 8px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-round); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.link-btn.linked { color: #00d2a1; border-color: #00d2a1; }

.pool-row { display: flex; align-items: center; gap: 4px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
.pool-row:last-child { border-bottom: none; }
.pool-left { display: flex; align-items: center; gap: 6px; min-width: 44px; font-size: 13px; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.adj {
  width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.1); border-radius: 50%;
  background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; line-height: 1;
}
.pct {
  width: 72px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px; color: #fff; font-size: 13px; padding: 4px; text-align: center;
  outline: none; font-family: var(--font-number);
}
.pc { font-size: 11px; color: var(--text-secondary); }
.money {
  margin-left: auto; font-size: 13px; font-weight: 600; color: var(--text-secondary);
  font-family: var(--font-number); min-width: 72px; text-align: right;
}

.user-group { margin-top: 6px; }
.user-group.linked { border: 1px dashed rgba(0,210,161,0.15); border-radius: var(--radius-md); padding: 4px 8px; }
.hint { font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; }

/* 合计行 */
.total-row {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  padding: 8px 0 4px; font-size: 12px; color: var(--text-secondary);
}
.total-row .num-mono { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.total-row .num-mono.fall { color: var(--color-fall); }
.total-row .sep { color: var(--text-muted); }

.apply-btn {
  width: 100%; margin-top: 8px; padding: 12px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
}
.apply-btn:disabled { opacity: 0.3; }
.err { font-size: 11px; color: var(--color-fall); text-align: center; margin-top: 4px; }

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
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.dlg-btns { display: flex; gap: 10px; margin-top: 12px; }
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
.d-ok.alloc { background: var(--bg-accent); }
</style>
