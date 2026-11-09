import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // ตั้งค่า Vite สำหรับระบบจัดตารางผู้คุมสอบ
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@data': resolve(__dirname, 'src/data'),
      '@rules': resolve(__dirname, 'src/rules'),
      '@solver': resolve(__dirname, 'src/solver'),
      '@explain': resolve(__dirname, 'src/explain'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config'),
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
});
