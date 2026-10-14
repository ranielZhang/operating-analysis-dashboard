<template>
    <div class="kpi">
        <!-- 空态：当前筛选条件下没有任何收入 -->
        <PanelCard v-if="!hasData" class="kpi__empty" title="收入总览" subtitle="应确认收入 / 已到账收入 / 收入结构占比">
            <PanelEmptyState text="当前筛选条件下暂无收入数据" />
        </PanelCard>

        <template v-else-if="metrics">
            <MetricCard
                label="应确认收入合计"
                :value="metrics.accrualRevenue"
                format="moneyAuto"
                tone="revenue"
                badge="权责发生制"
                :hint="`投放按预估回收曲线确认 · 覆盖 ${monthCount} 个月`"
            />

            <MetricCard
                label="已到账收入"
                :value="metrics.cashRevenue"
                format="moneyAuto"
                tone="book"
                hint="银行流水口径，滞后于应确认收入"
            />

            <MetricCard
                label="收入确认差"
                :value="gap"
                format="moneyAuto"
                tone="gap"
                :badge="gapBadge"
                :badge-tone="gapBadgeTone"
                :hint="gapHint"
            />

            <MetricCard
                label="流量主收入占比"
                :value="liuliangzhuShare"
                format="percent"
                :hint="`流量主收入 ${money(liuliangzhuValue)}`"
            />

            <MetricCard
                label="支付/分成收入占比"
                :value="iapShare"
                format="percent"
                :hint="`分成收入 ${money(iapShareValue)}`"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import MetricCard from '@/components/MetricCard.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { monthSpan, useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import { money, percent } from '@/utils/format';
    import { hasRevenue, safeRatio, subjectAmount } from './revenueTheme';

    /** 收入总览指标卡行：金额看规模，占比看结构，确认差看到账节奏 */
    defineOptions({ name: 'RevenueKpiRow' });

    const { filter } = useAnalysisFilter();

    /** 公司口径指标（跟随全局筛选） */
    const metrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    const hasData = computed(() => hasRevenue(metrics.value));

    /** 期间月数（用于说明覆盖长度） */
    const monthCount = computed(() => monthSpan(filter.startMonth, filter.endMonth));

    /** 应确认 − 已到账：结算滞后形成的应收未收主要构成（也可能为负：到账领先于确认） */
    const gap = computed(() => {
        const m = metrics.value;
        return m ? m.accrualRevenue - m.cashRevenue : 0;
    });

    /** 缺口方向：正 = 已确认未到账（结算滞后）；负 = 本期到账领先于收入确认 */
    const gapPositive = computed(() => gap.value >= 0);

    const gapBadge = computed(() => {
        const m = metrics.value;
        if (!m || m.accrualRevenue <= 0) return '';
        const rate = Math.abs(safeRatio(gap.value, m.accrualRevenue));
        return gapPositive.value ? `占应确认 ${percent(rate)}` : `到账领先 ${percent(rate)}`;
    });

    const gapBadgeTone = computed<'default' | 'warn'>(() => (gapPositive.value ? 'warn' : 'default'));

    const gapHint = computed(() =>
        gapPositive.value ? '应收未收的主要构成' : '本期到账领先于收入确认（含前期投放的延迟回款）',
    );

    const liuliangzhuValue = computed(() => subjectAmount(metrics.value?.revenueByType, 'liuliangzhu'));
    const iapShareValue = computed(() => subjectAmount(metrics.value?.revenueByType, 'iapShare'));

    const liuliangzhuShare = computed(() => safeRatio(liuliangzhuValue.value, metrics.value?.accrualRevenue ?? 0));
    const iapShare = computed(() => safeRatio(iapShareValue.value, metrics.value?.accrualRevenue ?? 0));
</script>

<style scoped lang="scss">
    .kpi {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-width: 0;
        min-height: 0;
    }

    /* 空态面板横跨整行，避免被压进 1/5 宽的栅格列 */
    .kpi__empty {
        grid-column: 1 / -1;
    }

    @media (max-width: 1400px) {
        .kpi {
            grid-template-columns: 1fr;
        }
    }
</style>
