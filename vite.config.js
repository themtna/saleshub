import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ════════════════════════════════════════════
// แก้ 'saleshub' ให้ตรงกับชื่อ GitHub repo ของคุณ
// เช่น repo ชื่อ my-sales → base: '/my-sales/'
// ════════════════════════════════════════════
export default defineConfig({
  base: '/saleshub/',
  plugins: [react()],
})
