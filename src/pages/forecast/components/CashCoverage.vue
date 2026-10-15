<template>
    <PanelCard title="资金支撑">
        <div class="cash">
            <div class="cash__grid">
                <div>
                    <span>可动用现金</span>
                    <b class="oa-num">{{ money(metrics?.availableCash ?? 0) }}</b>
                </div>
                <div>
                    <span>支撑月数</span>
                    <b class="oa-num">{{ runwayText }}</b>
                </div>
                <div>
                    <span>老游戏经营利润</span>
                    <b class="oa-num" :class="trendClass(metrics?.matureProfit ?? 0)">{{ money(metrics?.matureProfit ?? 0) }}</b>
                </div>
                <div>
                    <span>新项目投入</span>
                    <b class="oa-num">{{ money(metrics?.newProjectNeed ?? 0) }}</b>
                </div>
            </div>
            <p class="cash__note">
                覆盖差额 <b class="oa-num" :class="trendClass(coverage)">{{ money(coverage) }}</b>。
                支撑月数 = 可动用现金 / 近 3 个月月均净支出。老游戏覆盖用经营利润近似，不是现金流水账。
            </p>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, trendClass } from '@/utils/format';

    defineOptions({ name: 'ForecastCashCoverage' });

    const { filter } = useAnalysisFilter();
    const metrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    const coverage = computed(() => (metrics.value ? metrics.value.matureProfit - metrics.value.newProjectNeed : 0));
    const runwayText = computed(() => {
        const months = metrics.value?.runwayMonths;
        if (months === null || months === undefined || !Number.isFinite(months)) return '近 3 个月净流入';
        return `${months.toFixed(1)} 个月`;
    });
</script>

<style scoped lang="scss">
    .cash__grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    .cash__grid > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px;
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        background: var(--oa-card);

        span {
            font-size: var(--oa-fs-xs);
            color: var(--oa-text-3);
        }

        b {
            font-size: 18px;
        }
    }

    .cash__note {
        margin: 10px 0 0;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        line-height: 1.6;
    }
</style>
