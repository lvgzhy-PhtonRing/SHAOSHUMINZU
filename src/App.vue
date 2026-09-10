<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { FUND_CODES, refreshFundNav } from '@/api/fundNav'
import { seedFromBackup } from '@/api/mockDb'

// 测试版：无 Supabase 凭据时，用 json/ 里的正式备份填充本地数据库
seedFromBackup()

// 每次打开软件后台抓取参考基金净值；抓不到自动回退本地数据，用户无需手动刷新
onMounted(() => {
  for (const code of FUND_CODES) {
    refreshFundNav(code).catch(e => console.warn('[fundNav] 启动抓取失败，使用本地数据：', e))
  }
})
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
}
</style>
