import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import './assets/styles/global.css'
import { isMockMode, getDB, loadBackup } from '@/api/mockDb'

// Mock 模式下的启动引导：若本地库为空则尝试从 public/seed-backup.json 载入测试备份
async function bootstrapMockSeed() {
  if (!isMockMode()) return
  const db = getDB()
  if (db.pools && db.pools.length) return
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}seed-backup.json`)
    if (!res.ok) return
    const backup = await res.json()
    loadBackup(backup)
    console.log('[mock] 已从 seed-backup.json 载入测试数据')
  } catch (e) {
    console.warn('[mock] seed 加载失败，将使用空库：', e.message)
  }
}

async function bootstrap() {
  await bootstrapMockSeed()
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(Vant)
  app.mount('#app')
}

bootstrap()
