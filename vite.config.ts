import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // GitHub Pages 프로젝트 경로(/<repo>/)에서도 동작하도록 상대 경로
  build: { outDir: 'dist', sourcemap: true }
});
