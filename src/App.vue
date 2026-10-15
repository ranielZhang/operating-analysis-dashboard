<template>
    <div class="app">
        <header class="app__top">
            <div class="app__brand">
                <span class="app__logo">经</span>
                <strong>公司经营分析看板</strong>
            </div>
            <div class="app__meta">
                <span class="app__asof">
                    数据截至 {{ store.currentMonth }}-{{ String(store.daysElapsed).padStart(2, '0') }}（当月剩余
                    {{ store.daysInMonth - store.daysElapsed }} 天）
                </span>
            </div>
        </header>

        <div class="app__main">
            <main class="app__content">
                <div class="app__page oa-scroll">
                    <router-view v-slot="{ Component }">
                        <component :is="Component" />
                    </router-view>
                </div>
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { store } from '@/domain/store';

    /** 应用外壳：顶栏 + 经营数据看板。算法说明不在网页展示。 */
    defineOptions({ name: 'AppShell' });
</script>

<style scoped lang="scss">
    .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .app__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        height: var(--oa-header-h);
        padding: 0 16px;
        background: linear-gradient(90deg, #1f3a68 0%, #2f5c9e 55%, #4d94fa 100%);
        color: #fff;
        flex: 0 0 auto;
    }

    .app__brand {
        display: flex;
        align-items: center;
        gap: 10px;

        strong {
            font-size: 15px;
            letter-spacing: 0.5px;
        }
    }

    .app__logo {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.18);
        font-size: 15px;
        font-weight: 700;
    }

    .app__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
    }


    .app__asof {
        opacity: 0.72;
        white-space: nowrap;
    }

    .app__main {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .app__content {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        background: var(--oa-bg-page);
    }

    .app__page {
        flex: 1 1 auto;
        min-height: 0;
    }
</style>
