<template>
    <section class="ck">
        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无成本数据" />

        <div v-else class="ck__grid">
            <!-- ① 总成本：当前口径合计（业务成本按口径取消耗或充值） -->
            <MetricCard
                label="总成本"
                :value="m.totalCost"
                format="moneyAuto"
                tone="cost"
                :compare="cmp.totalCost"
                compare-label="较上一等长期间"
                compare-mode="down-good"
                hint="业务成本 + 人工成本 + 管理费用"
            />

            <!-- ② 业务成本：口径敏感项，展开显示两个子科目，便于对照 -->
            <MetricCard
                label="业务成本"
                :value="m.businessCost"
                format="moneyAuto"
                tone="cost"
                :compare="cmp.businessCost"
                compare-label="较上一等长期间"
                compare-mode="down-good"
                :hint="businessHint"
            >
                <template #extra>
                    <div class="ck__split">
                        <span class="ck__split-lab">投放消耗</span>
                        <span class="ck__split-val oa-num" :class="{ 'ck__split-val--on': filter.basis === 'operating' }">
                            {{ money(cb.adSpend) }}
                        </span>
                    </div>
                    <div class="ck__split">
                        <span class="ck__split-lab">预付成本</span>
                        <span class="ck__split-val oa-num" :class="{ 'ck__split-val--on': filter.basis === 'book' }">
                            {{ money(cb.prepay) }}
                        </span>
                    </div>
                </template>
            </MetricCard>

            <!-- ③ 人工成本：蓝色（与结构树人工成本同色） -->
            <MetricCard
                label="人工成本"
                :value="m.laborCost"
                format="moneyAuto"
                tone="book"
                :compare="cmp.laborCost"
                compare-label="较上一等长期间"
                compare-mode="down-good"
                :hint="`人数 ${comma(m.headcount)} 人 · 期间人均 ${money(perCapitaLabor)}`"
            />

            <!-- ④ 管理费用 -->
            <MetricCard
                label="管理费用"
                :value="m.adminCost"
                format="moneyAuto"
                tone="default"
                :compare="cmp.adminCost"
                compare-label="较上一等长期间"
                compare-mode="down-good"
                :hint="`福利费 ${money(cb.welfare)} · 办公费 ${money(cb.office)}`"
            />

            <!-- ⑤ 成本收入比：分母固定用应确认收入（不随口径切换）；收入为 0 时不可计算，显示 —— -->
            <MetricCard
                label="成本收入比"
                :value="costIncomeRatio"
                format="percent"
                tone="warn"
                :compare="cmp.ratio"
                compare-label="较上一等长期间"
                compare-mode="down-good"
                :hint="ratioHint"
            />
        </div>
    </section>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import MetricCard from '@/components/MetricCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter, monthSpan } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import type { Metrics } from '@/domain/types';
    import { comma, money } from '@/utils/format';
    import { EMPTY_METRICS, growth, isEmptyMetrics, shiftMonth } from './costModel';

    /**
     * 区块 1 · 成本总览指标卡
     * 组件无 props：自读全局筛选条件 → store 取数 → 渲染。
     */
    defineOptions({ name: 'CostKpiRow' });

    const { filter } = useAnalysisFilter();

    /** 公司整体指标（当前口径） */
    const raw = computed<Metrics | null>(() => store.metricsOf(filter, 'company', 'company'));
    const m = computed<Metrics>(() => raw.value ?? EMPTY_METRICS);
    const cb = computed(() => m.value.costByType);
    const isEmpty = computed(() => !raw.value || isEmptyMetrics(raw.value));

    /**
     * 环比基准：把当前区间整体平移一个「等长期间」再取数。
     * 平移后若超出可分析范围（早于 store.months[0]）则不显示对比值，避免与本期重叠导致失真。
     */
    const prevMetrics = computed<Metrics | null>(() => {
        const span = monthSpan(filter.startMonth, filter.endMonth);
        const prevStart = shiftMonth(filter.startMonth, -span);
        const prevEnd = shiftMonth(filter.endMonth, -span);
        if (prevStart < store.months[0]) return null;
        return store.metricsOf({ ...filter, startMonth: prevStart, endMonth: prevEnd }, 'company', 'company');
    });

    /** 成本收入比：本区间应确认收入为 0 时不可计算，传 NaN 让指标卡显示「--」而不是假的 0% */
    const costIncomeRatio = computed(() =>
        m.value.accrualRevenue > 0 ? m.value.totalCost / m.value.accrualRevenue : Number.NaN,
    );

    const ratioHint = computed(() =>
        m.value.accrualRevenue > 0
            ? `总成本 ÷ 应确认收入 ${money(m.value.accrualRevenue)}`
            : '本区间应确认收入为 0，成本收入比不可计算',
    );

    const perCapitaLabor = computed(() =>
        m.value.headcount > 0 ? m.value.laborCost / m.value.headcount : 0,
    );

    const businessHint = computed(() =>
        filter.basis === 'operating'
            ? '当前口径：投放消耗（媒体后台实际消耗）'
            : '当前口径：充值支出（账面现金流出）',
    );

    const cmp = computed(() => {
        const p = prevMetrics.value;
        if (!p) {
            return { totalCost: null, businessCost: null, laborCost: null, adminCost: null, ratio: null };
        }
        const cur = m.value;
        const curRatio = cur.accrualRevenue > 0 ? cur.totalCost / cur.accrualRevenue : Number.NaN;
        const preRatio = p.accrualRevenue > 0 ? p.totalCost / p.accrualRevenue : Number.NaN;
        return {
            totalCost: growth(cur.totalCost, p.totalCost),
            businessCost: growth(cur.businessCost, p.businessCost),
            laborCost: growth(cur.laborCost, p.laborCost),
            adminCost: growth(cur.adminCost, p.adminCost),
            ratio: growth(curRatio, preRatio),
        };
    });
</script>

<style scoped lang="scss">
    .ck {
        min-width: 0;
        min-height: 0;
    }

    .ck__grid {
        display: grid;
        /* 一行 5 张；窗口变窄时按 210px 下限自动换行，避免 5 张卡被压成竖排单列 */
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: var(--oa-gap);
    }

    .ck__grid > * {
        min-width: 0;
    }

    .ck__split {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .ck__split-val {
        color: var(--oa-text-3);
        font-weight: 600;
    }

    /* 当前口径实际计入的那个科目高亮，避免误读 */
    .ck__split-val--on {
        color: var(--oa-cost);
    }

    /* 窄屏：按契约降单列（auto-fit 已能自适应，这里再兜一层） */
    @media (max-width: 1400px) {
        .ck__grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
    }

    @media (max-width: 720px) {
        .ck__grid {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
