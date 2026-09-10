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
// 串行抓取：东方财富 pingzhongdata 共用 window.Data_netWorthTrend 全局变量，
// 并发会导致两只基金互相覆盖读到空数据
onMounted(async () => {
  for (const code of FUND_CODES) {
    try {
      await refreshFundNav(code)
    } catch (e) {
      console.warn('[fundNav] 启动抓取失败，使用本地数据：', e)
    }
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
