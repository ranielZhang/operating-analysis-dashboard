<template>
    <div class="cost">
        <!-- ===== 页面标题区：标题 + 期间 / 口径 / 范围 + 口径说明（一行小字，必须保留） ===== -->
        <header class="cost__head">
            <div class="cost__head-main">
                <h2 class="cost__title">成本分析</h2>
                <p class="cost__subtitle">
                    分析期间 {{ periodLabel }}
                    <span class="cost__sep">·</span>
                    口径：{{ basisText }}
                    <span class="cost__sep">·</span>
                    预估窗口：{{ filter.roiWindow }} 日
                    <span class="cost__sep">·</span>
                    范围：{{ hasFilter ? scopeText : '全公司' }}
                </p>
                <p class="cost__note">
                    口径说明：结构分析中的 <code>costByType.adSpend</code> 恒为<b>投放消耗</b>、<code>prepay</code> 恒为<b>充值额</b>，
                    <b>不随筛选口径变化</b>（结构分析要看真实发生额）；而指标卡的「业务成本」会随口径切换——经营口径取投放消耗、
                    账面口径取充值支出，两者差额即另一个科目的金额。结构树与结构合计均按「投放 + 充值 + 人工 + 管理」列示，故与指标卡「总成本」不等。
                </p>
            </div>
        </header>

        <!-- ===== 区块 1 · 成本总览指标卡 ===== -->
        <CostKpiRow />

        <!-- ===== 区块 2 · 成本结构树（1fr） + 区块 3 · 成本月度趋势（1.5fr） ===== -->
        <section class="cost__grid cost__grid--top">
            <CostStructureTree />
            <CostMonthlyTrend />
        </section>

        <!-- ===== 区块 4 · 人工成本专题 ===== -->
        <LaborCostPanel />

        <!-- ===== 区块 5 · 分组织 / 分业务成本对比 ===== -->
        <OrgBizCostCompare />

        <!-- ===== 区块 6 · 成本分析洞察 ===== -->
        <CostInsights />
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAME_MAP, ORG_MAP, PLATFORM_MAP, PROJECT_MAP } from '@/domain/dimensions';

    // 兄弟组件（均无 props，各自读取全局筛选条件）
    import CostKpiRow from './components/CostKpiRow.vue';
    import CostStructureTree from './components/CostStructureTree.vue';
    import CostMonthlyTrend from './components/CostMonthlyTrend.vue';
    import LaborCostPanel from './components/LaborCostPanel.vue';
    import OrgBizCostCompare from './components/OrgBizCostCompare.vue';
    import CostInsights from './components/CostInsights.vue';

    /** 成本分析页：只做布局组装与筛选描述，取数全部在子组件内 */
    defineOptions({ name: 'CostPage' });

    const { filter, periodLabel, hasFilter } = useAnalysisFilter();

    const basisText = computed(() =>
        filter.basis === 'book' ? '账面（银行流水口径）' : '经营（权责发生制口径）',
    );

    /** 已选范围标签 */
    const scopeTags = computed(() => {
        const tags: Array<{ key: string; label: string }> = [];
        const push = (prefix: string, ids: string[], nameOf: (id: string) => string | undefined) => {
            ids.forEach((id) => tags.push({ key: `${prefix}:${id}`, label: `${prefix}·${nameOf(id) ?? id}` }));
        };
        push('组织', [...filter.centerIds, ...filter.departmentIds, ...filter.groupIds, ...filter.pitcherIds], (id) =>
            ORG_MAP.get(id)?.name,
        );
        push('平台', filter.platformIds, (id) => PLATFORM_MAP.get(id)?.name);
        push('项目', filter.projectIds, (id) => PROJECT_MAP.get(id)?.name);
        push('游戏', filter.gameIds, (id) => GAME_MAP.get(id)?.name);
        return tags;
    });

    const scopeText = computed(() => {
        const tags = scopeTags.value;
        if (!tags.length) return '全公司';
        const head = tags.slice(0, 2).map((t) => t.label.replace('·', ' ')).join('、');
        return tags.length > 2 ? `${head} 等 ${tags.length} 项` : head;
    });
</script>

<style scoped lang="scss">
    .cost {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    /* ---------- 标题区 ---------- */
    .cost__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 10px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
    }

    .cost__head-main {
        min-width: 0;
    }

    .cost__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .cost__subtitle {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-3);
        line-height: 1.6;
    }

    .cost__sep {
        margin: 0 2px;
        color: var(--oa-text-4);
    }

    /* 一行小字：口径差异说明（投放消耗 vs 充值额） */
    .cost__note {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.75;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-hover);
            border: 1px solid var(--oa-border);
            color: var(--oa-primary-deep);
        }
    }

    /* ---------- 栅格 ---------- */
    .cost__grid {
        display: grid;
        gap: var(--oa-gap);
        align-items: stretch;
        min-width: 0;
    }

    .cost__grid--top {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
    }

    /* 每个格子都要可收缩，否则内部表格 / 图表会溢出 */
    .cost__grid > * {
        min-width: 0;
        min-height: 0;
    }

    @media (max-width: 1400px) {
        .cost__grid--top {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
