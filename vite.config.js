import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/SHAOSHUMINZU/',
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      // main.js 已全量引入 vant/lib/index.css，这里关闭按需样式注入，
      // 避免同一批 Vant 规则被拆进异步 chunk 重复打包，以不同加载顺序产生层叠覆盖
      resolvers: [VantResolver({ importStyle: false })],
      dts: 'src/components.d.ts'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096
  }
})
