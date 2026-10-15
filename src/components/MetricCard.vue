<template>
    <div class="metric" :class="[`metric--${tone}`, { 'metric--sm': size === 'sm' }]">
        <div class="metric__top">
            <span class="metric__label">{{ label }}</span>
            <span v-if="badge" class="metric__badge" :class="`metric__badge--${badgeTone}`">{{ badge }}</span>
        </div>

        <div class="metric__value oa-num" :class="valueClass">
            <span v-if="prefix" class="metric__prefix">{{ prefix }}</span>
            {{ display }}
            <span v-if="suffix" class="metric__suffix">{{ suffix }}</span>
        </div>

        <div v-if="hasFoot" class="metric__foot">
            <template v-if="compare !== undefined && compare !== null">
                <span class="metric__compare-label">{{ compareLabel }}</span>
                <span class="metric__compare oa-num" :class="compareClass">
                    {{ trendArrow(compare) }} {{ changeText(compare) }}
                </span>
            </template>
            <span v-if="hint" class="metric__hint">{{ hint }}</span>
            <slot name="foot" />
        </div>

        <div v-if="$slots.extra" class="metric__extra">
            <slot name="extra" />
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, useSlots } from 'vue';
    import { changeText, money, percent, trendArrow, trendClass } from '@/utils/format';

    /** 核心指标卡：经营分析看板全站统一的 KPI 呈现单元 */
    defineOptions({ name: 'MetricCard' });

    const props = withDefaults(
        defineProps<{
            label: string;
            /** 数值（原始值，用 format 决定展示） */
            value: number;
            /** 展示格式 */
            format?: 'money' | 'moneyAuto' | 'percent' | 'ratio' | 'int';
            /** 语义色调：决定左侧色条与数值色 */
            tone?: 'default' | 'book' | 'operating' | 'revenue' | 'cost' | 'gap' | 'warn' | 'success';
            /** 环比/同比等对比值（小数，如 0.12 = +12%） */
            compare?: number | null;
            compareLabel?: string;
            /** 对比色方向：up-good（正为好，默认） / down-good（负为好，如成本） / neutral */
            compareMode?: 'up-good' | 'down-good' | 'neutral';
            prefix?: string;
            suffix?: string;
            hint?: string;
            badge?: string;
            badgeTone?: 'default' | 'warn' | 'danger' | 'success';
            /** 数值是否按正负自动着色（利润类指标） */
            colored?: boolean;
            size?: 'md' | 'sm';
        }>(),
        {
            format: 'moneyAuto',
            tone: 'default',
            compare: null,
            compareLabel: '环比',
            compareMode: 'up-good',
            prefix: '',
            suffix: '',
            hint: '',
            badge: '',
            badgeTone: 'default',
            colored: false,
            size: 'md',
        },
    );

    const slots = useSlots();
    /** 没有环比、说明或底部插槽时不占那一行空白 */
    const hasFoot = computed(
        () => (props.compare !== undefined && props.compare !== null) || !!props.hint || !!slots.foot,
    );

    const display = computed(() => {
        const v = props.value;
        if (!Number.isFinite(v)) return '—';
        switch (props.format) {
            case 'money':
                return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
            case 'moneyAuto':
                return money(v);
            case 'percent':
                return percent(v);
            case 'ratio':
                return v.toFixed(2);
            case 'int':
                return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
            default:
                return String(v);
        }
    });

    const valueClass = computed(() => {
        if (!props.colored || !Number.isFinite(props.value)) return '';
        return trendClass(props.value);
    });

    const compareClass = computed(() => {
        if (props.compare === null || props.compare === undefined) return 'oa-flat';
        if (props.compareMode === 'neutral') return 'oa-flat';
        if (props.compareMode === 'down-good') return props.compare < 0 ? 'oa-up' : props.compare > 0 ? 'oa-down' : 'oa-flat';
        return trendClass(props.compare);
    });
</script>

<style scoped lang="scss">
    .metric {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px 12px 16px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
        overflow: hidden;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--oa-border);
        }
    }

    .metric--sm {
        padding: 9px 12px 9px 13px;
        gap: 4px;
    }

    .metric--book::before {
        background: var(--oa-book);
    }
    .metric--operating::before {
        background: var(--oa-operating);
    }
    .metric--revenue::before {
        background: var(--oa-revenue);
    }
    .metric--cost::before {
        background: var(--oa-cost);
    }
    .metric--gap::before {
        background: var(--oa-gap-color);
    }
    .metric--warn::before {
        background: var(--oa-warning);
    }
    .metric--success::before {
        background: var(--oa-success);
    }

    .metric__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
    }

    .metric__label {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        white-space: nowrap;
    }

    .metric__badge {
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 11px;
        line-height: 16px;
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);

        &--warn {
            background: var(--oa-warning-soft);
            color: #c96a1c;
        }
        &--danger {
            background: var(--oa-danger-soft);
            color: #d64545;
        }
        &--success {
            background: var(--oa-success-soft);
            color: #0e9455;
        }
    }

    .metric__value {
        display: flex;
        align-items: baseline;
        gap: 2px;
        font-size: var(--oa-fs-num);
        font-weight: 700;
        line-height: 1.15;
        color: var(--oa-text-1);
        white-space: nowrap;
    }

    .metric--sm .metric__value {
        font-size: 20px;
    }

    .metric__prefix {
        font-size: 14px;
        font-weight: 500;
        color: var(--oa-text-3);
    }

    .metric__suffix {
        font-size: 13px;
        font-weight: 500;
        color: var(--oa-text-3);
    }

    .metric__foot {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        min-height: 16px;
    }

    .metric__compare-label {
        color: var(--oa-text-4);
    }

    .metric__compare {
        font-weight: 600;
    }

    .metric__hint {
        color: var(--oa-text-4);
    }

    .metric__extra {
        margin-top: 2px;
    }
</style>
