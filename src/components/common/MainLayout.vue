<!-- src/components/common/MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar v-model="active" :border="false">
      <van-tabbar-item icon="diamond-o" @click="go('dashboard')">持仓</van-tabbar-item>
      <van-tabbar-item icon="bar-chart-o" @click="go('positions')">仓位</van-tabbar-item>
      <van-tabbar-item icon="exchange" @click="go('trade')">交易</van-tabbar-item>
      <van-tabbar-item icon="fire-o" @click="go('trends')">榜单</van-tabbar-item>
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资本</van-tabbar-item>
      <van-tabbar-item icon="setting-o" @click="go('settings')">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const routeMap = { dashboard: 0, positions: 1, trade: 2, trends: 3, fund: 4, settings: 5 }
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
}
.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
