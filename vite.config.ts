import { defineConfig } from 'vite';

// GitHub Pages 项目站点部署在 /tank/ 子路径下，构建时必须设置 base；
// 本地 dev / preview 仍使用根路径。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tank/' : '/',
  build: {
    chunkSizeWarningLimit: 1600, // Phaser 单包体积，正常
  },
}));
