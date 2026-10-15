import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 文件监听：macOS 上 Cursor / 多进程保存时 FSEvents 常漏事件 → HMR 不触发。
 * 默认开启轻量轮询，保存即热更新。
 */
function buildServerWatch() {
    if (process.env.VITE_POLL_WATCH === '1') {
        return { usePolling: true, interval: 300, binaryInterval: 500 } as const;
    }
    if (process.env.VITE_NO_POLL === '1') {
        return { usePolling: false } as const;
    }
    return { usePolling: true, interval: 500, binaryInterval: 800 } as const;
}

export default defineConfig({
    plugins: [vue()],
    /** 本地开发保持根路径；GitHub Pages 构建时由 CI 传入仓库子路径 */
    base: process.env.VITE_BASE_PATH || '/',
    /** 依赖预构建缓存移出项目目录，规避沙箱 / 同步盘干扰 */
    cacheDir: process.env.VITE_CACHE_DIR || '/tmp/oad-vite-cache',
    server: {
        host: true,
        port: 5180,
        strictPort: true,
        watch: buildServerWatch(),
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
            },
        },
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
