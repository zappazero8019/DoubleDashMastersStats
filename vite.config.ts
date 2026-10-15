import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuração Vite do painel Double Dash Masters.
// Sem proxies, sem variáveis de ambiente privadas: a API pública é chamada
// diretamente pelo navegador (CORS liberado pelo backend).
//
// `base` é o subdiretório onde o painel será servido. Ele prefixa os caminhos
// dos assets no build e alimenta `import.meta.env.BASE_URL`, usado pelo
// roteador (basename) e pelo caminho do dados.json estático.
export default defineConfig({
  base: '/DoubleDashMastersStats/',
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
