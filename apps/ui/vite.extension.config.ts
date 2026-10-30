import {defineConfig}from'vite';import react from'@vitejs/plugin-react';import tailwindcss from'@tailwindcss/vite';import{fileURLToPath}from'node:url';
export default defineConfig({base:'./',plugins:[react(),tailwindcss()],build:{outDir:'../extension/src/console-ui',emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./vault-console.html',import.meta.url))}}});
