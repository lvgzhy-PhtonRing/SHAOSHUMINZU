<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="$emit('update:show', false)">
      <div class="dialog">
        <div class="dlg-head">
          <span class="dlg-title">变动明细</span>
          <button class="dlg-close" @click="$emit('update:show', false)">✕</button>
        </div>
        <div class="dlg-list">
          <CapitalLogList :logs="logs" @delete="$emit('delete', $event)" @edit="$emit('edit', $event)" />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import CapitalLogList from './CapitalLogList.vue'

defineProps({
  show: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] }
})
defineEmits(['update:show', 'delete', 'edit'])
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
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }
.dlg-list { overflow-y: auto; max-height: 60vh; }
</style>
