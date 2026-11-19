<template>
  <div class="card edge-warn">
    <button
      class="broker-menu-trigger"
      type="button"
      :aria-expanded="showBrokerForm"
      @click="showBrokerForm = !showBrokerForm"
    >
      <span class="broker-menu-title"><span class="title-accent title-accent--warn"></span>ȯ��APPУ��</span>
      <span class="broker-menu-action">{{ showBrokerForm ? '����' : 'չ��У�Ա���' }} <span aria-hidden="true">{{ showBrokerForm ? '?' : '?' }}</span></span>
    </button>

    <div v-if="showBrokerForm" class="broker-form">
      <div class="card-desc">����ȯ��APP��ʾ�ġ��˻��ʲ�����ϵͳ�Զ��������¼��ֻ�������ʽ�/���ʲ������������ʱ�</div>

      <div v-if="tradingLocked" class="lock-banner">
        ? ����ʱ���ڣ������� 9:00�C15:30����ֹУ�Ժ�ȱ������ 15:30 ���̺����
        <div class="lock-note">�����������԰��������жϣ���ȯ��ʵ������Ϊ׼</div>
      </div>

      <div class="amount-row">
        <input
          v-model="brokerAsset"
          type="number"
          inputmode="decimal"
          placeholder="ȯ���˻��ʲ���Ԫ��"
          class="big-input num-mono"
          :disabled="tradingLocked"
        />
      </div>
      <div class="action-row">
        <button class="act-btn gen" :disabled="tradingLocked || !brokerValid || submitting" @click="generate">����У�Ժ�ȱ</button>
      </div>
      <div v-if="brokerValid" class="diff-preview" :class="diff >= 0 ? 'pos' : 'neg'">
        ��� = ȯ���˻��ʲ� ? ϵͳ�˻��ʲ� =
        <b class="num-mono">{{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}</b>
        <span class="hint">ϵͳ�˻��ʲ�����ֵ + �����ʽ�{{ formatMoney(systemAsset) }}</span>
      </div>
    </div>

    <!-- ȷ�ϵ��� -->
    <teleport to="body">
      <div v-if="showDialog" class="overlay" @click.self="closeDialog">
        <div class="dialog adjustment-dialog">
          <div class="dlg-title">ȷ��У�Ժ�ȱ</div>
          <div class="dlg-info">
            <div class="dlg-info-row">
              <span>У�Ժ�ȱ�ܶ�</span>
              <b class="num-mono" :class="expectedCents >= 0 ? 'rise' : 'fall'">{{ formatSignedAmount(expectedCents) }} Ԫ</b>
            </div>
            <div class="dlg-info-row">
              <span>��ǰ����ϼ�</span>
              <b class="num-mono" :class="adjTotal?.cents >= 0 ? 'rise' : 'fall'">{{ adjTotal ? formatSignedAmount(adjTotal.cents) : '��' }} Ԫ</b>
            </div>
          </div>
          <div class="detail-entry-list">
            <div v-for="(row, index) in detailRows" :key="row.id" class="detail-entry">
              <div class="detail-entry-top">
                <select v-model="row.category" class="dlg-input detail-category" aria-label="�������" required>
                  <option value="" disabled>��ѡ��������</option>
                  <option value="stock_dividend">��Ʊ����</option>
                  <option value="reverse_repo">��ع�����</option>
                  <option value="interest">��Ϣ�鱾</option>
                  <option value="dividend_tax">��Ϣ��˰</option>
                  <option value="fee_error">�������</option>
                </select>
                <select v-if="row.category === 'fee_error'" v-model="row.direction" class="dlg-input detail-direction" aria-label="��������">
                  <option value="add">���� +</option>
                  <option value="remove">�ۼ� ?</option>
                </select>
                <button v-if="detailRows.length > 1" class="detail-remove" type="button" @click="removeDetailRow(index)">ɾ��</button>
              </div>
              <input
                v-if="row.category === 'stock_dividend'"
                v-model="row.stockName"
                type="text"
                class="dlg-input detail-name"
                placeholder="��Ʊ����"
                aria-label="��Ʊ����"
                required
              />
              <div class="detail-amount-row">
                <input
                  v-model="row.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  class="dlg-input detail-amount"
                  placeholder="���"
                  aria-label="������"
                  required
                />
                <span v-if="row.category" class="detail-sign num-mono" :class="row.category === 'dividend_tax' || (row.category === 'fee_error' && row.direction === 'remove') ? 'fall' : 'rise'">
                  {{ row.category === 'dividend_tax' || (row.category === 'fee_error' && row.direction === 'remove') ? '-' : '+' }}
                </span>
              </div>
            </div>
          </div>
          <button class="detail-add" type="button" @click="addDetailRow">�� ���ӷ���</button>
          <div class="detail-hint">��������д�����Դ�����з���������У�Ժ�ȱ�ܶ���ȫһ��</div>
          <div v-if="detailError" class="detail-error">{{ detailError }}</div>
          <div class="dlg-field">
            <label class="dlg-label">����</label>
            <input v-model="adjDate" type="date" class="dlg-input" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">��ע</label>
            <input v-model="adjNote" type="text" class="dlg-input" placeholder="ѡ���ֺ졢�����Ѳ��" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="closeDialog">ȡ��</button>
            <button :class="adjTotal?.type==='add'?'d-ok add':'d-ok remove'" :disabled="!adjTotal || !!detailError" @click="submit">? ȷ��</button>
          </div>
        </div>
      </div>

      <!-- ɾ��ȷ�� -->
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="dialog">
          <div class="dlg-title">ȷ��ɾ��</div>
          <div class="dlg-info">ȷ��ɾ������У�Ժ�ȱ��¼��</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>У�Ժ�ȱ</span>
              <span class="num-mono" :class="deleting.type === 'add' ? 'rise' : 'fall'">
                {{ formatSignedAmount((deleting.type === 'add' ? 1 : -1) * Math.round(deleting.amount * 100)) }}
              </span>
            </div>
            <div v-if="parsedLog(deleting).note" class="dlg-row">
              <span>��ע</span>
              <span>{{ parsedLog(deleting).note }}</span>
            </div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deleting = null">ȡ��</button>
            <button class="d-ok del" @click="doDelete">??? ȷ��ɾ��</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- �����б���ϸ����ɾ���� -->
    <div class="adjust-list">
      <div class="log-header">
        <span class="log-title">У�Ժ�ȱ��ϸ</span>
        <span class="swipe-hint">? ��ɾ��</span>
        <span class="log-count" v-if="logs.length">�� {{ logs.length }} ��</span>
      </div>
      <div class="history-summary" aria-label="У�Ժ�ȱ������ʷ����">
        <div class="history-summary-title">
          <span>������ʷ���� <small>������ۼ�</small></span>
          <b class="num-mono" :class="historicalCorrectionCents < 0 ? 'fall' : 'rise'">
            ��ʷ��ȱ�ϼ� {{ formatSignedAmount(historicalCorrectionCents) }} Ԫ
          </b>
        </div>
        <div v-if="historySummary.length" class="history-summary-grid">
          <div v-for="item in historySummary" :key="item.category" class="history-summary-item">
            <span class="history-summary-label">{{ item.label }}</span>
            <b class="num-mono" :class="item.cents < 0 ? 'fall' : 'rise'">�� {{ formatSignedAmount(item.cents) }} Ԫ</b>
          </div>
        </div>
        <div v-else class="history-summary-empty">���޿ɻ��ܵķ����¼</div>
      </div>
      <div v-if="!logs.length" class="list-empty">����У�Ժ�ȱ��¼</div>
      <div v-else class="trade-log-list">
        <van-swipe-cell v-for="log in logs" :key="log.id" :right-width="70">
          <button class="trade-log-item" type="button" @click="toggleExpanded(log.id)">
            <div class="tli-body">
              <div class="tli-header">
                <span class="tli-date">{{ formatDate(log.created_at) }}</span>
                <span class="tli-action">У�Ժ�ȱ</span>
                <span class="tli-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
                  {{ formatSignedAmount((log.type === 'add' ? 1 : -1) * Math.round(log.amount * 100)) }}
                </span>
              </div>
              <div v-if="expandedIds.has(log.id)" class="detail-breakdown">
                <template v-if="parsedLog(log).items.length">
                  <div v-for="(item, index) in parsedLog(log).items" :key="index" class="detail-breakdown-row">
                    <span>
                      {{ CORRECTION_CATEGORY_LABELS[item.category] || item.category }}
                      <span v-if="item.category === 'stock_dividend' && item.stockName" class="detail-stock-name">{{ item.stockName }}</span>
                    </span>
                    <span class="num-mono" :class="item.signedAmount < 0 ? 'fall' : 'rise'">{{ formatSignedAmount(item.signedAmount) }}</span>
                  </div>
                  <div v-if="parsedLog(log).note" class="detail-legacy-note">{{ parsedLog(log).note }}</div>
                </template>
                <div v-else class="detail-legacy-note">�ɼ�¼�޷�����ϸ<span v-if="parsedLog(log).note"> �� {{ parsedLog(log).note }}</span></div>
              </div>
            </div>
            <span class="tli-arrow">{{ expandedIds.has(log.id) ? '?' : '?' }}</span>
          </button>
          <template #right>
            <div class="swipe-actions">
              <button class="swipe-del-btn" @click.stop="deleting = log">ɾ��</button>
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
import {
  CORRECTION_CATEGORY_LABELS,
  normalizeCorrectionItems,
  resolveCorrectionTotal,
  parseCorrectionNote,
  formatSignedAmount
} from '@/utils/correctionDetails'

const props = defineProps({
  logs: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  marketValue: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 }
})
const emit = defineEmits(['add', 'delete'])
const showBrokerForm = ref(false)

// ===== ����ʱ���ж��������� 9:00�C15:30 ��ֹ������ 540�C930�� =====
const tradingLocked = computed(() => {
  const d = new Date()
  const day = d.getDay() // 0=���� 6=����
  if (day === 0 || day === 6) return false
  const minutes = d.getHours() * 60 + d.getMinutes()
  return minutes >= 540 && minutes < 930
})

// ===== ȯ���˻��ʲ� �� ��� =====
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

// ===== ȷ�ϵ��� =====
const showDialog = ref(false)
const adjDate = ref(todayStr())
const adjNote = ref('')
let nextDetailId = 1
const detailRows = ref([createDetailRow()])
const expectedCents = ref(0)
const expandedIds = ref(new Set())
const historySummary = computed(() => {
  const totals = new Map()
  for (const log of props.logs) {
    for (const item of parseCorrectionNote(log?.note).items) {
      if (!CORRECTION_CATEGORY_LABELS[item.category] || !Number.isInteger(item.signedAmount)) continue
      totals.set(item.category, (totals.get(item.category) || 0) + item.signedAmount)
    }
  }
  return Object.entries(CORRECTION_CATEGORY_LABELS)
    .filter(([category]) => totals.has(category))
    .map(([category, label]) => ({ category, label, cents: totals.get(category) }))
})
const historicalCorrectionCents = computed(() => props.logs.reduce((total, log) => {
  const amount = Number(log?.amount)
  if (!Number.isFinite(amount)) return total
  const sign = log.type === 'remove' ? -1 : 1
  return total + sign * Math.round((amount + Number.EPSILON) * 100)
}, 0))
const normalizedItems = computed(() => {
  try {
    return normalizeCorrectionItems(detailRows.value)
  } catch {
    return null
  }
})
const adjTotal = computed(() => normalizedItems.value ? resolveCorrectionTotal(normalizedItems.value) : null)
const detailError = computed(() => {
  if (!detailRows.value.length) return '����������һ�������ϸ'
  for (const row of detailRows.value) {
    if (!row.category) return '��ѡ��ÿһ��ķ������'
    if (row.category === 'stock_dividend' && !String(row.stockName || '').trim()) return '��Ʊ��������д��Ʊ����'
    if (!String(row.amount ?? '').trim() || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) return '����дÿһ�����Ч���'
    if (row.category === 'fee_error' && !['add', 'remove'].includes(row.direction)) return '��ѡ���������'
  }
  if (!normalizedItems.value) {
    return '����д��Ч�ķ������ȷ�Ϸ�������'
  }
  if (!adjTotal.value) return '�����Ϊ�㣬�����������'
  if (adjTotal.value.cents !== expectedCents.value) {
    return `����ϼ� ${formatSignedAmount(adjTotal.value.cents)}��ӦΪ ${formatSignedAmount(expectedCents.value)}`
  }
  return ''
})

function createDetailRow() {
  return { id: nextDetailId++, category: '', stockName: '', amount: '', direction: 'add' }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generate() {
  const d = diff.value
  if (Math.abs(d) < 0.005) {
    alert('ϵͳ��ȯ��һ�£�����У��')
    return
  }
  expectedCents.value = Math.round((d + Number.EPSILON) * 100)
  adjDate.value = todayStr()
  adjNote.value = ''
  detailRows.value = [createDetailRow()]
  showDialog.value = true
}

function addDetailRow() {
  detailRows.value.push(createDetailRow())
}

function removeDetailRow(index) {
  detailRows.value.splice(index, 1)
}

function parsedLog(log) {
  return parseCorrectionNote(log?.note)
}

function toggleExpanded(id) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function closeDialog() {
  showDialog.value = false
}

function submit() {
  if (!adjTotal.value || detailError.value) return
  emit('add', {
    type: adjTotal.value.type,
    amount: adjTotal.value.amount,
    details: normalizedItems.value,
    note: adjNote.value,
    date: adjDate.value
  })
  closeDialog()
  brokerAsset.value = ''
}

// ===== ɾ�� =====
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
.card-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.broker-menu-trigger {
  display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.broker-menu-title { display: inline-flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; }
.broker-menu-action { flex-shrink: 0; color: var(--text-muted); font-size: 12px; }
.broker-form { margin-top: 12px; }

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
.act-btn.gen { background: var(--bg-accent); color: #fff; }

.diff-preview {
  font-size: 12px; color: var(--text-secondary); margin-top: 10px;
  padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);
}
.diff-preview b { font-size: 14px; }
.diff-preview.pos b { color: var(--color-rise); }
.diff-preview.neg b { color: var(--color-fall); }
.diff-preview .hint { font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px; }

/* �б���ϸ���ο�������ϸ��ʽ����ɾ���� */
.adjust-list { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
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
.history-summary {
  margin: 0 0 10px; padding: 10px; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.05);
}
.history-summary-title { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 600; }
.history-summary-title > span { color: var(--text-primary); }
.history-summary-title small, .history-summary-empty { color: var(--text-muted); font-size: 10px; font-weight: 400; }
.history-summary-title b { font-size: 11px; white-space: nowrap; }
.history-summary-title b.rise { color: var(--color-rise); }
.history-summary-title b.fall { color: var(--color-fall); }
.history-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 6px; }
.history-summary-item { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 8px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.035); }
.history-summary-label { color: var(--text-secondary); font-size: 11px; }
.history-summary-item b { font-size: 11px; white-space: nowrap; }
.history-summary-item .rise { color: var(--color-rise); }
.history-summary-item .fall { color: var(--color-fall); }
.history-summary-empty { line-height: 1.5; }
.list-empty { font-size: 12px; color: var(--text-muted); padding: 10px 0; text-align: center; }
.trade-log-list { display: flex; flex-direction: column; gap: 2px; }
.trade-log-item { width: 100%; text-align: left; padding: 9px 12px; border: 0; color: inherit; font: inherit; background: var(--bg-hover); display: flex; gap: 8px; align-items: center; border-radius: var(--radius-md); cursor: pointer; }
.tli-body { flex: 1; min-width: 0; }
.tli-header { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
.tli-date { color: var(--text-secondary); font-size: 12px; font-weight: 600; font-family: var(--font-number); }
.tli-action { font-size: 13px; font-weight: 600; }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-amount { font-size: 14px; font-weight: 700; font-family: var(--font-number); }
.tli-amount.rise { color: var(--color-rise); }
.tli-amount.fall { color: var(--color-fall); }
.detail-breakdown { padding: 6px 0 0 16px; display: grid; gap: 3px; }
.detail-breakdown-row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; line-height: 1.35; color: var(--text-muted); }
.detail-stock-name { margin-left: 5px; opacity: .75; }
.detail-legacy-note { font-size: 10px; color: var(--text-muted); line-height: 1.4; }
.detail-breakdown-row .rise, .detail-sign.rise, .dlg-info b.rise { color: var(--color-rise); }
.detail-breakdown-row .fall, .detail-sign.fall, .dlg-info b.fall { color: var(--color-fall); }
.tli-arrow { font-size: 16px; color: var(--text-muted); opacity: 0.3; flex-shrink: 0; }
.swipe-actions { display: flex; height: 100%; }
.swipe-del-btn { width: 70px; border: none; background: var(--color-fall); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }

/* ���� */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-solid); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
.dlg-info-row { display: flex; justify-content: space-between; gap: 12px; }
.dlg-info-row + .dlg-info-row { margin-top: 6px; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--color-warn); }
.adjustment-dialog { max-height: calc(100dvh - 40px); overflow-y: auto; }
.detail-entry-list { display: grid; gap: 8px; max-height: 35vh; overflow-y: auto; }
.detail-entry { padding: 8px; border-radius: var(--radius-md); background: rgba(255,255,255,.035); }
.detail-entry-top, .detail-amount-row { display: flex; align-items: center; gap: 7px; }
.detail-category { flex: 1; min-width: 0; }
.detail-direction { width: 104px; padding-inline: 6px; }
.detail-remove { border: 0; padding: 5px; color: var(--text-muted); background: transparent; }
.detail-name, .detail-amount { margin-top: 6px; }
.detail-amount { flex: 1; min-width: 0; }
.detail-sign { width: 16px; font-size: 15px; font-weight: 700; text-align: center; }
.detail-add { width: 100%; margin: 8px 0 12px; padding: 8px; border: 1px dashed rgba(255,255,255,.14); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); }
.detail-hint { color: var(--text-muted); font-size: 10px; margin: -4px 0 4px; }
.detail-error { color: var(--color-fall); font-size: 11px; margin: -4px 0 10px; }
.d-ok:disabled { opacity: .35; cursor: not-allowed; }
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
.d-ok.add { background: var(--bg-accent); }
.d-ok.remove { background: #ff6b35; }
.d-ok.del { background: var(--color-fall); }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
</style>

