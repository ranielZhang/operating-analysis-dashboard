<template>
    <div class="app">
        <header class="app__top">
            <div class="app__brand">
                <span class="app__logo">经</span>
                <div class="app__brand-text">
                    <strong>经营分析看板</strong>
                    <small>经营利润 · 月度预估 · 逐层下钻</small>
                </div>
            </div>
            <div class="app__meta">
                <span class="app__asof">
                    数据截至 {{ store.currentMonth }}-{{ String(store.daysElapsed).padStart(2, '0') }}（当月剩余
                    {{ store.daysInMonth - store.daysElapsed }} 天）
                </span>
            </div>
        </header>

        <div class="app__main">
            <aside class="app__sider oa-scroll">
                <nav>
                    <template v-for="grp in MENU" :key="grp.title">
                        <p class="app__menu-title">{{ grp.title }}</p>
                        <router-link
                            v-for="item in grp.items"
                            :key="item.path"
                            :to="item.path"
                            class="app__menu-item"
                            :class="{ 'is-active': route.path === item.path }"
                        >
                            <span class="app__menu-dot" />
                            <span class="app__menu-label">{{ item.title }}</span>
                        </router-link>
                    </template>
                </nav>
            </aside>

            <main class="app__content">
                <AnalysisFilterBar />
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
    import { useRoute } from 'vue-router';
    import AnalysisFilterBar from '@/components/AnalysisFilterBar.vue';
    import { store } from '@/domain/store';

    /** 应用外壳：顶栏（口径说明） + 左侧菜单 + 右侧内容（含全局筛选栏） */
    defineOptions({ name: 'AppShell' });

    const route = useRoute();

    /**
     * 菜单按「经营叙事」排序，自上而下回答四个递进的问题：
     *   结果（现在怎么样） → 构成（钱从哪来、花到哪去） → 主体（谁做出来的） → 模型（怎么算出来的）
     */
    const MENU = [
        {
            title: '经营结果',
            items: [
                { path: '/overview', title: '经营总览' },
                { path: '/forecast', title: '月度经营预估' },
            ],
        },
        {
            title: '收入与成本',
            items: [
                { path: '/revenue', title: '收入分析' },
                { path: '/cost', title: '成本分析' },
            ],
        },
        {
            title: '组织与人员',
            items: [
                { path: '/drilldown', title: '逐层下钻' },
                { path: '/pitcher', title: '投手人效' },
            ],
        },
        {
            title: '模型与口径',
            items: [{ path: '/settings', title: '预估参数配置' }],
        },
    ];
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

    .app__brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.25;

        strong {
            font-size: 15px;
            letter-spacing: 0.5px;
        }

        small {
            font-size: 11px;
            opacity: 0.75;
        }
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

    .app__sider {
        width: var(--oa-sider-w);
        flex: 0 0 var(--oa-sider-w);
        background: #fff;
        border-right: 1px solid var(--oa-border);
        padding: 10px 8px 20px;
    }

    .app__menu-title {
        margin: 12px 8px 6px;
        font-size: 11px;
        font-weight: 600;
        color: var(--oa-text-4);
        letter-spacing: 1px;
    }

    .app__menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        margin-bottom: 2px;
        border-radius: 6px;
        text-decoration: none;
        color: var(--oa-text-2);
        transition: background 0.15s ease;

        &:hover {
            background: var(--oa-hover);
        }

        &.is-active {
            background: var(--oa-primary-soft);
            color: var(--oa-primary-deep);

            .app__menu-dot {
                background: var(--oa-primary);
            }
        }
    }

    .app__menu-dot {
        flex: 0 0 auto;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #d5dbe7;
    }

    .app__menu-label {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
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
