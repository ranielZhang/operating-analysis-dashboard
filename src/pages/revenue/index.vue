<template>
    <div class="rv">
        <!-- 页面标题区：口径说明（本页固定用应确认 / 已到账两个收入口径，不随顶部利润口径切换） -->
        <header class="rv__head">
            <h2 class="rv__title">收入分析</h2>
            <p class="rv__sub">
                把应确认收入拆成 <b>流量主收入 / 广告金 / 分成收入</b> 三科目，回答「收入从哪来、结构稳不稳、什么时候能到账」。
                <span class="rv__sep">·</span>分析期间 {{ periodLabel }}
                <span class="rv__sep">·</span>范围：{{ scopeText }}
                <span class="rv__sep">·</span>口径：应确认收入 = 权责发生制，已到账收入 = 银行流水
            </p>
        </header>

        <!-- ① 收入总览指标卡 -->
        <section class="rv__row">
            <RevenueKpiRow />
        </section>

        <!-- ② 三科目月度趋势（2/3） + ③ 收入结构（1/3） -->
        <section class="rv__grid rv__grid--trend">
            <RevenueTrendPanel />
            <RevenueStructurePanel />
        </section>

        <!-- ④ 分平台收入对比 -->
        <section class="rv__row">
            <PlatformRevenuePanel />
        </section>

        <!-- ⑤ 分游戏收入 Top / Bottom（宽） + ⑥ 收入质量洞察（窄） -->
        <section class="rv__grid rv__grid--quality">
            <GameRevenuePanel />
            <RevenueInsightPanel />
        </section>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAME_MAP, ORG_MAP, PLATFORM_MAP, PROJECT_MAP } from '@/domain/dimensions';

    // 兄弟组件（均无 props，各自读取全局筛选条件）
    import RevenueKpiRow from './components/RevenueKpiRow.vue';
    import RevenueTrendPanel from './components/RevenueTrendPanel.vue';
    import RevenueStructurePanel from './components/RevenueStructurePanel.vue';
    import PlatformRevenuePanel from './components/PlatformRevenuePanel.vue';
    import GameRevenuePanel from './components/GameRevenuePanel.vue';
    import RevenueInsightPanel from './components/RevenueInsightPanel.vue';

    /** 收入分析页：只做布局组装与范围描述，取数全部在子组件内 */
    defineOptions({ name: 'RevenuePage' });

    const { filter, periodLabel, hasFilter } = useAnalysisFilter();

    /** 当前范围摘要（无筛选 = 全公司），避免误读为「全公司口径」 */
    const scopeText = computed(() => {
        if (!hasFilter.value) return '全公司';

        const parts: string[] = [];
        const push = (label: string, ids: string[], nameOf: (id: string) => string | undefined) => {
            if (!ids.length) return;
            const names = ids.map((id) => nameOf(id) ?? id);
            parts.push(
                `${label}：${names.length > 2 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 项` : names.join('、')}`,
            );
        };

        push('组织', [...filter.centerIds, ...filter.departmentIds, ...filter.groupIds, ...filter.pitcherIds], (id) =>
            ORG_MAP.get(id)?.name,
        );
        push('平台', filter.platformIds, (id) => PLATFORM_MAP.get(id)?.name);
        push('项目', filter.projectIds, (id) => PROJECT_MAP.get(id)?.name);
        push('游戏', filter.gameIds, (id) => GAME_MAP.get(id)?.name);

        return parts.join('；') || '全公司';
    });
</script>

<style scoped lang="scss">
    .rv {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    .rv__head {
        min-width: 0;
    }

    .rv__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .rv__sub {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        line-height: 1.7;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
            font-weight: 600;
        }
    }

    .rv__sep {
        margin: 0 2px;
        color: var(--oa-text-4);
    }

    .rv__row {
        min-width: 0;
        min-height: 0;
    }

    /* 所有栅格：display:grid + gap，格子必须可收缩，否则内部图表/表格会溢出 */
    .rv__grid {
        display: grid;
        gap: var(--oa-gap);
        align-items: stretch;
        min-width: 0;
    }

    .rv__grid--trend {
        grid-template-columns: 1.7fr 1fr;
    }

    .rv__grid--quality {
        grid-template-columns: 1.6fr 1fr;
    }

    .rv__grid > * {
        min-width: 0;
        min-height: 0;
    }

    /* 窄屏：全部降为单列 */
    @media (max-width: 1400px) {
        .rv__grid--trend,
        .rv__grid--quality {
            grid-template-columns: 1fr;
        }
    }
</style>
