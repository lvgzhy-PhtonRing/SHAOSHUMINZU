<template>
  <div class="page netvalue-page">
    <div class="page-header">
      <span class="page-title">净值走势<span class="title-en">NAV Trend</span></span>
    </div>

    <div class="section-card nav-hero">
      <NavOverview />
    </div>

    <div class="section-card edge-accent nav-card">
      <FundNavChart />
    </div>
  </div>
</template>

<script setup>
import NavOverview from '@/components/fund/NavOverview.vue'
import FundNavChart from '@/components/fund/FundNavChart.vue'
</script>

<style scoped>
/* 基金档案：同 Dashboard 首卡渐变底 + 描边，无标题、无左侧色带 */
.nav-hero {
  padding: 12px 16px;
  background: linear-gradient(150deg, rgba(143, 111, 255, .16), rgba(255, 77, 109, .08) 60%, rgba(255, 255, 255, .04));
  border: 1px solid rgba(255, 255, 255, .16);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
}
/* 净值比较：留白对齐趋势页模块（16 / 14 / 18） */
.nav-card {
  padding: 16px 14px 18px;
}
</style>
