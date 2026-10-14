<template>
    <MetricCard
        :label="label"
        :value="value"
        :format="format"
        :tone="tone"
        :suffix="suffix"
        :colored="colored"
        :hint="hint"
        :badge="badge"
        :badge-tone="badgeTone"
    >
        <template #extra>
            <div class="kpi__cmp">
                <span class="kpi__cmp-line">
                    <i class="kpi__dot kpi__dot--base" />
                    <span class="kpi__cmp-lab">基线</span>
                    <b class="kpi__cmp-val oa-num">{{ baseText }}</b>
                    <span class="kpi__arrow">→</span>
                    <i class="kpi__dot kpi__dot--sim" />
                    <span class="kpi__cmp-lab">推演</span>
                    <b class="kpi__cmp-val oa-num">{{ simText }}</b>
                </span>
                <span class="kpi__cmp-rate" :class="rateClass">
                    {{ trendArrow(delta) }} {{ changeText(delta) }}
                    <em class="kpi__cmp-note">vs 基线情景</em>
                </span>
            </div>
        </template>
    </MetricCard>
</template>

<script setup lang="ts">
    import MetricCard from '@/components/MetricCard.vue';
    import { changeText, money, percent, ratio, trendArrow, trendClass } from '@/utils/format';
    import { computed } from 'vue';

    /** 推演对比指标卡：同时在卡片内展示「基线值 → 推演值 → 变化率」 */
    defineOptions({ name: 'ScenarioKpiCard' });

    const props = withDefaults(
        defineProps<{
            label: string;
            /** 推演情景值 */
            value: number;
            /** 基线情景值 */
            base: number;
            format?: 'moneyAuto' | 'percent' | 'ratio' | 'int';
            tone?: 'default' | 'book' | 'operating' | 'revenue' | 'cost' | 'gap' | 'warn' | 'success';
            suffix?: string;
            colored?: boolean;
            hint?: string;
            badge?: string;
            badgeTone?: 'default' | 'warn' | 'danger' | 'success';
        }>(),
        {
            format: 'moneyAuto',
            tone: 'default',
            suffix: '',
            colored: false,
            hint: '',
            badge: '',
            badgeTone: 'default',
        },
    );

    function render(v: number): string {
        if (!Number.isFinite(v)) return '-';
        if (props.format === 'percent') return percent(v);
        if (props.format === 'ratio') return ratio(v);
        if (props.format === 'int') return v.toFixed(0);
        return money(v);
    }

    const baseText = computed(() => render(props.base));
    const simText = computed(() => render(props.value));

    /** 变化率：基线为 0 或缺失时返回 null（避免除零 → Infinity） */
    const delta = computed<number>(() => {
        const b = props.base;
        if (!Number.isFinite(b) || b === 0) return 0;
        return (props.value - b) / Math.abs(b);
    });

    /** 利润率/ROI 这类「比值型」指标，变化用差值（百分点）表达更准确 */
    const rateClass = computed(() => trendClass(props.value - props.base));
</script>

<style scoped lang="scss">
    .kpi__cmp {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-top: 4px;
        border-top: 1px dashed var(--oa-border-light);
    }

    .kpi__cmp-line {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--oa-text-3);
        white-space: nowrap;
    }

    .kpi__cmp-lab {
        color: var(--oa-text-4);
    }

    .kpi__cmp-val {
        color: var(--oa-text-2);
        font-weight: 600;
    }

    .kpi__dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: 0 0 auto;

        &--base {
            background: var(--oa-text-4);
        }

        &--sim {
            background: var(--oa-primary);
        }
    }

    .kpi__arrow {
        color: var(--oa-text-4);
    }

    .kpi__cmp-rate {
        font-size: 11px;
        font-weight: 600;
    }

    .kpi__cmp-note {
        font-style: normal;
        font-weight: 400;
        color: var(--oa-text-4);
    }
</style>
