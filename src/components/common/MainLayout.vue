<!-- src/components/common/MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar v-model="active" active-color="#0f3460" inactive-color="#888" border>
      <van-tabbar-item icon="chart-trending-o" @click="go('dashboard')">持仓</van-tabbar-item>
      <van-tabbar-item icon="bar-chart-o" @click="go('positions')">仓位</van-tabbar-item>
      <van-tabbar-item icon="exchange" @click="go('trade')">交易</van-tabbar-item>
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资金</van-tabbar-item>
      <van-tabbar-item icon="setting-o" @click="go('settings')">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const routeMap = { dashboard: 0, positions: 1, trade: 2, fund: 3, settings: 4 }
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
</style>
