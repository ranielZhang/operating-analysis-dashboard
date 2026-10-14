<template>
    <PanelCard title="成本结构树" subtitle="总成本 → 3 大类 → 8 科目（真实发生额口径，可逐行加总核对）" plain>
        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无成本数据" />

        <div v-else class="tree">
            <!-- 表头 -->
            <div class="tree__row tree__row--head">
                <span class="tree__name">成本科目</span>
                <span class="tree__amt">金额</span>
                <span class="tree__pct">占比</span>
                <div class="tree__bar-col">占比分布</div>
            </div>

            <!-- 根：结构口径总成本 -->
            <div class="tree__row tree__row--root">
                <span class="tree__name">
                    总成本
                    <em class="tree__tag">结构口径</em>
                    <em class="tree__formula">= 业务成本 + 人工成本 + 管理费用</em>
                </span>
                <span class="tree__amt oa-num">{{ money(structural) }}</span>
                <span class="tree__pct oa-num">{{ percent(1, 0) }}</span>
                <div class="tree__bar-col">
                    <div class="tree__bar" :style="{ width: '100%', background: 'var(--oa-cost)' }" />
                </div>
            </div>

            <!-- 大类 + 细项 -->
            <template v-for="g in groups" :key="g.key">
                <div class="tree__row tree__row--group" :title="g.desc">
                    <span class="tree__name">
                        <i class="tree__chip" :style="{ background: cssVarOf(g.key) }" />
                        {{ g.name }}
                        <em class="tree__formula">{{ g.formula }}</em>
                    </span>
                    <span class="tree__amt oa-num">{{ money(g.amount) }}</span>
                    <span class="tree__pct oa-num">{{ percent(g.share) }}</span>
                    <div class="tree__bar-col">
                        <div class="tree__bar" :style="{ width: barWidth(g.share), background: cssVarOf(g.key) }" />
                    </div>
                </div>

                <div v-for="l in g.leafRows" :key="l.key" class="tree__row tree__row--leaf" :title="l.desc">
                    <span class="tree__name">{{ l.name }}</span>
                    <span class="tree__amt oa-num">{{ money(l.amount) }}</span>
                    <span class="tree__pct oa-num">{{ percent(l.share) }}</span>
                    <div class="tree__bar-col">
                        <div
                            class="tree__bar"
                            :style="{ width: barWidth(l.share), background: cssVarOf(g.key), opacity: l.alpha }"
                        />
                    </div>
                </div>
            </template>

            <!-- 加总校验 + 口径说明 -->
            <div class="tree__foot">
                <p class="tree__check">
                    <span class="tree__check-tag" :class="checkOk ? 'tree__check-tag--ok' : 'tree__check-tag--bad'">
                        {{ checkOk ? '✓ 加总一致' : '⚠ 存在差异' }}
                    </span>
                    3 大类合计 <b class="oa-num">{{ money(groupSum) }}</b>
                    = 8 科目合计 <b class="oa-num">{{ money(leafSum) }}</b>
                    ｜差额 <b class="oa-num">{{ money(checkDiff) }}</b>
                </p>

                <p class="tree__note">
                    口径说明：<code>costByType.adSpend</code> 恒为<b>投放消耗</b>、<code>prepay</code> 恒为<b>充值额</b>，不随筛选口径变化，
                    因此结构合计 {{ money(structural) }} 与指标卡「总成本」{{ money(m.totalCost) }} 相差
                    <b class="oa-num">{{ money(basisDiff) }}</b>，差额正是当前
                    {{ filter.basis === 'operating' ? '经营' : '账面' }}口径未计入的
                    {{ excludedName }}（{{ money(excludedAmount) }}）。
                </p>

                <p class="tree__note">
                    管理费用构成：福利费 = 人工成本 × {{ percent(WELFARE_RATE) }}；办公费 = 人头 ×
                    {{ comma(OFFICE_COST_PER_HEAD) }} 元/人/月（当前 {{ comma(m.headcount) }} 人）。
                </p>
            </div>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { OFFICE_COST_PER_HEAD, WELFARE_RATE } from '@/domain/dimensions';
    import { store } from '@/domain/store';
    import type { CostBreakdown, Metrics } from '@/domain/types';
    import { comma, money, percent } from '@/utils/format';
    import {
        COST_GROUPS,
        EMPTY_METRICS,
        excludedBusinessLeaf,
        groupValue,
        isEmptyMetrics,
        leafMeta,
        leafValue,
        share,
        structTotal,
        type CostGroupKey,
    } from './costModel';

    /**
     * 区块 2 · 成本结构树
     * 自绘树形列表（不用图表）：金额恒等于子项之和，页面底部给出加总校验与口径差额，供财务核对。
     */
    defineOptions({ name: 'CostStructureTree' });

    const { filter } = useAnalysisFilter();

    const raw = computed<Metrics | null>(() => store.metricsOf(filter, 'company', 'company'));
    const m = computed<Metrics>(() => raw.value ?? EMPTY_METRICS);
    const cb = computed<CostBreakdown>(() => m.value.costByType);
    const isEmpty = computed(() => !raw.value || isEmptyMetrics(raw.value));

    /** 结构口径合计（投放消耗 + 充值额 + 人工 + 管理） */
    const structural = computed(() => structTotal(cb.value));

    const barWidth = (ratio: number): string => `${Math.max(0, Math.min(1, ratio)) * 100}%`;

    const cssVarOf = (key: CostGroupKey): string => {
        const g = COST_GROUPS.find((x) => x.key === key);
        return `var(${g?.token ?? '--oa-cost'})`;
    };

    const groups = computed(() =>
        COST_GROUPS.map((g) => {
            const amount = groupValue(cb.value, g.key);
            return {
                key: g.key,
                name: g.name,
                desc: g.desc,
                /** 大类金额 = 细项之和（页面直接展示该公式，便于核对） */
                formula: g.leaves.map((l) => l.name).join(' + '),
                amount,
                share: share(amount, structural.value),
                leafRows: g.leaves.map((l) => ({
                    key: l.key,
                    name: l.name,
                    desc: l.desc,
                    alpha: l.alpha,
                    amount: leafValue(cb.value, l.key),
                    share: share(leafValue(cb.value, l.key), structural.value),
                })),
            };
        }),
    );

    /** 8 科目合计（逐叶子加总，用于校验大类合计） */
    const leafSum = computed(() =>
        COST_GROUPS.reduce(
            (s, g) => s + g.leaves.reduce((s2, l) => s2 + leafValue(cb.value, l.key), 0),
            0,
        ),
    );
    const groupSum = computed(() => groups.value.reduce((s, g) => s + g.amount, 0));
    const checkDiff = computed(() => groupSum.value - leafSum.value);
    /** 浮点容差 1 元内视为一致 */
    const checkOk = computed(() => Math.abs(checkDiff.value) < 1);

    /** 结构合计与当前口径总成本的差额（= 未被计入的那个业务科目） */
    const basisDiff = computed(() => structural.value - m.value.totalCost);
    const excludedKey = computed(() => excludedBusinessLeaf(filter.basis));
    const excludedName = computed(() => leafMeta(excludedKey.value).name);
    const excludedAmount = computed(() => leafValue(cb.value, excludedKey.value));
</script>

<style scoped lang="scss">
    .tree {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .tree__row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 96px 56px 120px;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        border-bottom: 1px solid var(--oa-border-light);
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-2);
    }

    .tree__row--head {
        padding-top: 8px;
        padding-bottom: 8px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        background: var(--oa-hover);
    }

    .tree__row--head .tree__amt,
    .tree__row--head .tree__pct {
        text-align: right;
    }

    .tree__row--root {
        font-weight: 700;
        color: var(--oa-text-1);
        background: var(--oa-primary-soft);
    }

    /* 大类行：加粗 + 浅色底，缩进 0 */
    .tree__row--group {
        padding-left: 0;
        padding-right: 14px;
        font-weight: 600;
        color: var(--oa-text-1);
        background: var(--oa-hover);
    }

    /* 细项行：缩进 24px */
    .tree__row--leaf {
        padding-left: 24px;
        color: var(--oa-text-2);
    }

    .tree__name {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tree__formula {
        font-size: var(--oa-fs-xs);
        font-style: normal;
        font-weight: 400;
        color: var(--oa-text-4);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tree__tag {
        padding: 0 5px;
        border-radius: 8px;
        font-size: 11px;
        font-style: normal;
        font-weight: 500;
        line-height: 16px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        color: var(--oa-primary-deep);
    }

    .tree__chip {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        flex: 0 0 auto;
    }

    .tree__amt {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .tree__pct {
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: var(--oa-text-3);
    }

    .tree__bar-col {
        display: flex;
        align-items: center;
        height: 10px;
    }

    .tree__bar {
        display: block;
        height: 100%;
        min-width: 2px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-cost);
    }

    .tree__foot {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 14px 12px;
        background: var(--oa-hover);
        border-top: 1px solid var(--oa-border);
    }

    .tree__check {
        margin: 0;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
        }
    }

    .tree__check-tag {
        display: inline-block;
        margin-right: 6px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
    }

    .tree__check-tag--ok {
        background: var(--oa-success-soft);
        color: #0e9455;
    }

    .tree__check-tag--bad {
        background: var(--oa-danger-soft);
        color: #d64545;
    }

    .tree__note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-card);
            border: 1px solid var(--oa-border);
            color: var(--oa-primary-deep);
        }
    }

    @media (max-width: 1400px) {
        .tree__row {
            grid-template-columns: minmax(0, 1fr) 88px 52px 96px;
        }
    }
</style>
