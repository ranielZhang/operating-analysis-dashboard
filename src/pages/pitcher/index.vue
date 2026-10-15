<template>
    <div class="pt">
        <!-- ===== 页面标题区：标题 + 动态副标题（期间 / 口径 / 范围 / 人数口径） ===== -->
        <header class="pt__head">
            <div class="pt__head-main">
                <h2 class="pt__title">投手人效</h2>
                <p class="pt__subtitle">
                    回答「哪个投手最能赚钱」：分析期间 {{ periodLabel }}
                    <span class="pt__sep">·</span>
                    人效口径：经营利润 ÷ 人力成本
                    <span class="pt__sep">·</span>
                    预估窗口：{{ filter.roiWindow }} 日
                    <span class="pt__sep">·</span>
                    范围：{{ scopeText }}
                </p>
                <p class="pt__subtitle pt__subtitle--dim">
                    投手人数口径：个人层级共 {{ levelRowCount }} 人，其中投放投手 <b class="oa-num">{{ pitcherCount }}</b> 人
                    （其余为研发 / 中台 / 职能 / 运营 / 素材等非投放岗位，本页已剔除，不参与人效统计）。
                </p>
            </div>

            <div v-if="hasPitchers" class="pt__head-metrics">
                <div class="pt__metric">
                    <span class="pt__metric-label">投手合计经营利润</span>
                    <b class="oa-num" :class="trendClass(totals.operatingProfit)">{{ money(totals.operatingProfit) }}</b>
                </div>
                <div class="pt__metric">
                    <span class="pt__metric-label">团队人效比</span>
                    <b class="oa-num" :class="trendClass(totals.teamEfficiency - 1)">{{ ratio(totals.teamEfficiency) }}</b>
                </div>
            </div>
        </header>

        <template v-if="hasPitchers">
            <!-- ===== ① 团队人效总览（整行 5 张指标卡） ===== -->
            <TeamEfficiencyKpi />

            <!-- ===== ② 人效四象限（核心图表，2/3） + ⑥ 人效洞察（1/3） ===== -->
            <section class="pt__grid pt__grid--main">
                <EfficiencyQuadrant />
                <EfficiencyInsights />
            </section>

            <!-- ===== ③ 投手排行榜（整行表格） ===== -->
            <PitcherRankTable />

            <!-- ===== ④ 小组维度人效对比（整行柱图） ===== -->
            <GroupEfficiencyCompare />

            <!-- ===== ⑤ 单人投入产出对比（整行） ===== -->
            <PitcherPairCompare />
        </template>

        <!-- 整页空态：筛选范围把投手全部排除（例如只选研发中心）时兜底 -->
        <PanelEmptyState v-else text="当前筛选范围内没有投手。投手只存在于「发行中心 · 投放部」，请调整组织 / 平台 / 游戏范围" />
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { GAME_MAP, ORG_MAP, PLATFORM_MAP, PROJECT_MAP } from '@/domain/dimensions';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, ratio, trendClass } from '@/utils/format';

    // 兄弟区块（全部无 props，各自读取全局筛选条件与共享数据层）
    import TeamEfficiencyKpi from './components/TeamEfficiencyKpi.vue';
    import EfficiencyQuadrant from './components/EfficiencyQuadrant.vue';
    import EfficiencyInsights from './components/EfficiencyInsights.vue';
    import PitcherRankTable from './components/PitcherRankTable.vue';
    import GroupEfficiencyCompare from './components/GroupEfficiencyCompare.vue';
    import PitcherPairCompare from './components/PitcherPairCompare.vue';
    import { usePitcherData } from './components/usePitcherData';

    /** 投手人效页：只做布局组装与筛选描述，数据全部来自 store（经共享数据层收口） */
    defineOptions({ name: 'PitcherPage' });

    const { filter, periodLabel } = useAnalysisFilter();
    const { pitcherRows, levelRowCount, hasPitchers, totals } = usePitcherData();

    const pitcherCount = computed(() => pitcherRows.value.length);

    /** 范围摘要：把已选的组织 / 平台 / 项目 / 游戏翻成名称，让副标题自带上下文 */
    const scopeText = computed(() => {
        const orgIds = [...filter.centerIds, ...filter.departmentIds, ...filter.groupIds, ...filter.pitcherIds];
        const names = [
            ...orgIds.map((id) => ORG_MAP.get(id)?.name),
            ...filter.platformIds.map((id) => PLATFORM_MAP.get(id)?.name),
            ...filter.projectIds.map((id) => PROJECT_MAP.get(id)?.name),
            ...filter.gameIds.map((id) => GAME_MAP.get(id)?.name),
        ].filter((n): n is string => Boolean(n));
        if (!names.length) return '全部（发行中心 · 投放部）';
        return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等 ${names.length} 项` : '');
    });
</script>

<style scoped lang="scss">
    .pt {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    /* ---------- 标题区 ---------- */
    .pt__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 10px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
    }

    .pt__head-main {
        min-width: 0;
    }

    .pt__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .pt__subtitle {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-3);
        line-height: 1.6;

        &--dim {
            font-size: var(--oa-fs-xs);
            color: var(--oa-text-4);
        }

        b {
            color: var(--oa-text-2);
        }
    }

    .pt__sep {
        margin: 0 2px;
        color: var(--oa-text-4);
    }

    .pt__head-metrics {
        display: flex;
        gap: 18px;
        flex: 0 0 auto;
    }

    .pt__metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: right;

        b {
            font-size: var(--oa-fs-lg);
            font-weight: 700;
        }
    }

    .pt__metric-label {
        font-size: 11px;
        color: var(--oa-text-4);
    }

    /* ---------- 栅格 ---------- */
    .pt__grid {
        display: grid;
        gap: var(--oa-gap);
        align-items: stretch;
        min-width: 0;
    }

    /* 四象限（主）+ 人效洞察（辅） */
    .pt__grid--main {
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }

    /* 每个格子都要可收缩，否则内部表格会撑破页面 */
    .pt__grid > * {
        min-width: 0;
    }

    @media (max-width: 1280px) {
        .pt__grid--main {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    @media (max-width: 900px) {
        .pt__head {
            flex-direction: column;
        }

        .pt__head-metrics {
            align-self: flex-start;
            text-align: left;
        }

        .pt__metric {
            text-align: left;
        }
    }
</style>
