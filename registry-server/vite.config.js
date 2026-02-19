import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    root: '.', // Use current directory as root
    publicDir: 'public', // Serve static assets from public/
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './client'),
        },
    },
    server: {
        proxy: {
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
