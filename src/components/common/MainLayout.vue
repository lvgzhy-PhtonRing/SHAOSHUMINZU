<!-- src/components/common/MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="top-bar">
      <button class="menu-btn" @click="showDrawer = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar v-model="active" :border="false">
      <van-tabbar-item icon="diamond-o" @click="go('dashboard')">持仓</van-tabbar-item>
      <van-tabbar-item icon="bar-chart-o" @click="go('positions')">仓位</van-tabbar-item>
      <van-tabbar-item icon="exchange" @click="go('trade')">交易</van-tabbar-item>
      <van-tabbar-item icon="fire-o" @click="go('trends')">榜单</van-tabbar-item>
      <van-tabbar-item icon="chart-trending-o" @click="go('trend')">趋势</van-tabbar-item>
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资本</van-tabbar-item>
    </van-tabbar>

    <van-popup
      v-model:show="showDrawer"
      position="right"
      :style="{ width: '100%', height: '100%', padding: '0' }"
      :close-on-click-overlay="true"
      closeable
      close-icon="cross"
      close-icon-position="top-left"
      :close-icon-color="'#a7a3c8'"
    >
      <SettingsPage :in-drawer="true" @close="showDrawer = false" />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsPage from '@/pages/SettingsPage.vue'
import { ensurePeriodicSnapshot } from '@/utils/positionSnapshot'

const route = useRoute()
const router = useRouter()
const showDrawer = ref(false)

onMounted(() => {
  ensurePeriodicSnapshot().catch(e => console.error('ensurePeriodicSnapshot error:', e))
})

const routeMap = { dashboard: 0, positions: 1, trade: 2, trends: 3, trend: 4, fund: 5 }
const active = ref(routeMap[route.name] || 0)

function go(name) {
  router.push({ name })
}

watch(() => route.name, (name) => {
  if (name && routeMap[name] !== undefined) {
    active.value = routeMap[name]
  }
})
</script>

<style scoped>
.main-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.top-bar {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 10;
}
.menu-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(177,140,255,.16);
  border: 1px solid rgba(177,140,255,.3);
  color: #b18cff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background .2s;
}
.menu-btn svg {
  width: 18px;
  height: 18px;
}
.menu-btn:active {
  background: rgba(177,140,255,.28);
}
.main-layout :deep(.van-popup) {
  background: var(--bg-primary);
}
.main-layout :deep(.van-overlay) {
  background: rgba(0,0,0,.45);
}
/* 玻璃悬浮 dock tab 栏 */
.main-layout :deep(.van-tabbar) {
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 24px);
  height: 54px;
  border-radius: 20px;
  background: rgba(24,22,49,.60);
  border: 1px solid rgba(255,255,255,.14);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
}
.main-layout :deep(.van-tabbar-item) {
  color: var(--text-secondary);
}
.main-layout :deep(.van-tabbar-item--active) {
  color: #b18cff;
  font-weight: 600;
  text-shadow: 0 0 12px rgba(177,140,255,.55);
}
</style>
