<template>
    <PanelCard
        title="单人投入产出对比"
        subtitle="任选两名投手并排对比：经营利润 / 人效比 / 消耗 / 累计预估 ROI / 负责盘面"
    >
        <template v-if="canCompare">
            <!-- 选人：默认取经营利润 Top2，可自由切换 -->
            <div class="pair__head">
                <el-select v-model="leftId" size="small" filterable class="pair__select">
                    <el-option v-for="opt in selectOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <span class="pair__vs">VS</span>
                <el-select v-model="rightId" size="small" filterable class="pair__select">
                    <el-option v-for="opt in selectOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
            </div>

            <!-- 指标对比条：左侧向右收、右侧向左收，形成对称的投入产出对比 -->
            <div class="pair__rows">
                <div v-for="m in COMPARE_METRICS" :key="m.key" class="pair__row">
                    <div class="pair__side pair__side--left">
                        <span class="pair__val oa-num" :class="valueClass(left, m.key)">{{ metricText(left, m.key) }}</span>
                        <span class="pair__track pair__track--left">
                            <i class="pair__bar" :style="{ width: barWidth(left, m.key), background: SIDE_COLOR_A }" />
                        </span>
                    </div>

                    <div class="pair__label">
                        <el-tooltip :content="m.hint" placement="top">
                            <span class="pair__label-text">{{ m.label }}</span>
                        </el-tooltip>
                    </div>

                    <div class="pair__side pair__side--right">
                        <span class="pair__track">
                            <i class="pair__bar" :style="{ width: barWidth(right, m.key), background: SIDE_COLOR_B }" />
                        </span>
                        <span class="pair__val oa-num" :class="valueClass(right, m.key)">{{ metricText(right, m.key) }}</span>
                    </div>
                </div>

                <!-- 负责游戏：盘面宽度对比 -->
                <div class="pair__row pair__row--list">
                    <div class="pair__side pair__side--left">
                        <span class="pair__tags">
                            <el-tag v-for="g in gameNames(left)" :key="g" size="small" type="info" effect="plain">{{ g }}</el-tag>
                            <span v-if="!gameNames(left).length" class="oa-muted">暂无投放游戏</span>
                        </span>
                    </div>
                    <div class="pair__label">
                        <el-tooltip content="按投放组合配置去重统计的负责游戏（不随期间筛选变化）" placement="top">
                            <span class="pair__label-text">负责游戏</span>
                        </el-tooltip>
                    </div>
                    <div class="pair__side pair__side--right">
                        <span class="pair__tags">
                            <el-tag v-for="g in gameNames(right)" :key="g" size="small" type="info" effect="plain">{{ g }}</el-tag>
                            <span v-if="!gameNames(right).length" class="oa-muted">暂无投放游戏</span>
                        </span>
                    </div>
                </div>

                <!-- 主投平台：当期消耗结构对比 -->
                <div class="pair__row pair__row--list">
                    <div class="pair__side pair__side--left">
                        <span class="pair__plats">
                            <span v-for="p in platformSpends(left)" :key="p.id" class="pair__plat">
                                <i class="pair__plat-dot" :style="{ background: p.color }" />
                                {{ p.name }}
                                <span class="oa-num pair__plat-share">{{ percent(p.share, 0) }}</span>
                            </span>
                            <span v-if="!platformSpends(left).length" class="oa-muted">当期无投放</span>
                        </span>
                    </div>
                    <div class="pair__label">
                        <el-tooltip content="按当期投放消耗拆分到各平台，括号为该平台占本人消耗的比例" placement="top">
                            <span class="pair__label-text">主投平台</span>
                        </el-tooltip>
                    </div>
                    <div class="pair__side pair__side--right">
                        <span class="pair__plats">
                            <span v-for="p in platformSpends(right)" :key="p.id" class="pair__plat">
                                <i class="pair__plat-dot" :style="{ background: p.color }" />
                                {{ p.name }}
                                <span class="oa-num pair__plat-share">{{ percent(p.share, 0) }}</span>
                            </span>
                            <span v-if="!platformSpends(right).length" class="oa-muted">当期无投放</span>
                        </span>
                    </div>
                </div>
            </div>

            <p class="pair__note">
                条形长度按两人该项的较大值归一（仅表示两人相对强弱，不代表绝对值比例）；颜色只区分 A / B 两人，正负仍看数字颜色。
                累计预估 ROI 为<b>累计口径</b>（累计预估总回收 ÷ 累计投放消耗，1.00 = 回本）。
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内不足 2 位投手，无法并排对比" />
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { ORG_MAP } from '@/domain/dimensions';
    import type { MetricRow } from '@/domain/types';
    import { money, percent, ratio, trendClass } from '@/utils/format';
    import { gameNamesOf, platformSpendsOf, usePitcherData, type PlatformSpend } from './usePitcherData';

    /**
     * 区块 5 · 单人投入产出对比
     * 用于绩效沟通与盘面复盘：把两个人的「结果（利润/人效）」与「盘面（游戏/平台）」放在同一屏。
     */
    defineOptions({ name: 'PitcherPairCompare' });

    const { pitcherRows, hasPitchers } = usePitcherData();

    /** A / B 两侧的条形色（只用于区分人，不承载语义；正负由数字颜色表达） */
    const SIDE_COLOR_A = '#4d94fa';
    const SIDE_COLOR_B = '#8b5cf6';

    type CompareKey = 'operatingProfit' | 'efficiencyRatio' | 'spend' | 'forecastRoi';

    const COMPARE_METRICS: Array<{ key: CompareKey; label: string; hint: string }> = [
        { key: 'operatingProfit', label: '经营利润', hint: '应确认收入 − 投放消耗 − 人力成本（当前利润口径）' },
        { key: 'efficiencyRatio', label: '人效比', hint: '经营利润 ÷ 人力成本：> 1 表示创造的经营利润已覆盖自身人力成本' },
        { key: 'spend', label: '投放消耗', hint: '当前筛选期间的媒体后台实际消耗' },
        { key: 'forecastRoi', label: '累计预估 ROI', hint: '累计口径：累计预估总回收 ÷ 累计投放消耗，1.00 = 回本（不是本期 ROI）' },
    ];

    /** 可选投手：默认按经营利润降序，选人时更好找 */
    const ranked = computed<MetricRow[]>(() => [...pitcherRows.value].sort((a, b) => b.operatingProfit - a.operatingProfit));

    const selectOptions = computed(() =>
        ranked.value.map((r) => ({
            value: r.key,
            label: `${r.name}（${r.parentId ? ORG_MAP.get(r.parentId)?.name ?? '—' : '—'} · ${money(r.operatingProfit)}）`,
        })),
    );

    const leftId = ref('');
    const rightId = ref('');

    /** 筛选条件变化后，被筛掉的投手要自动换成当前范围内的前两名，避免出现空对比 */
    watch(
        () => ranked.value.map((r) => r.key).join(','),
        () => {
            const ids = ranked.value.map((r) => r.key);
            if (!ids.includes(leftId.value)) leftId.value = ids[0] ?? '';
            if (!ids.includes(rightId.value) || rightId.value === leftId.value) {
                rightId.value = ids.find((id) => id !== leftId.value) ?? '';
            }
        },
        { immediate: true },
    );

    const canCompare = computed(() => hasPitchers.value && pitcherRows.value.length >= 2);

    const byId = (id: string): MetricRow | null => pitcherRows.value.find((r) => r.key === id) ?? null;
    const left = computed<MetricRow | null>(() => byId(leftId.value));
    const right = computed<MetricRow | null>(() => byId(rightId.value));

    const valueOf = (row: MetricRow | null, key: CompareKey): number => {
        if (!row) return 0;
        switch (key) {
            case 'efficiencyRatio':
                return row.efficiencyRatio;
            case 'spend':
                return row.spend;
            case 'forecastRoi':
                return row.forecastRoi;
            default:
                return row.operatingProfit;
        }
    };

    const metricText = (row: MetricRow | null, key: CompareKey): string => {
        if (!row) return '—';
        const v = valueOf(row, key);
        if (key === 'spend') return money(v);
        if (key === 'efficiencyRatio') return ratio(v);
        if (key === 'forecastRoi') return row.spend > 0 ? ratio(v) : '—';
        return money(v);
    };

    /** 值颜色：利润/人效/ROI 用涨跌色，消耗为中性 */
    const valueClass = (row: MetricRow | null, key: CompareKey): string => {
        if (!row) return '';
        const v = valueOf(row, key);
        if (key === 'spend') return '';
        if (key === 'forecastRoi') return row.spend > 0 ? trendClass(v - 1) : '';
        return trendClass(v);
    };

    /** 条形长度 = |值| ÷ 两人的较大 |值| */
    const barWidth = (row: MetricRow | null, key: CompareKey): string => {
        const a = Math.abs(valueOf(left.value, key));
        const b = Math.abs(valueOf(right.value, key));
        const max = Math.max(a, b);
        if (!row || max === 0) return '0%';
        return `${Math.max(2, (Math.abs(valueOf(row, key)) / max) * 100).toFixed(1)}%`;
    };

    const gameNames = (row: MetricRow | null): string[] => (row ? gameNamesOf(row.key) : []);
    const platformSpends = (row: MetricRow | null): PlatformSpend[] => (row ? platformSpendsOf(row.key) : []);
</script>

<style scoped lang="scss">
    .pair__head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr);
        align-items: center;
        gap: var(--oa-gap);
        margin-bottom: 10px;
    }

    .pair__select {
        width: 100%;
    }

    .pair__vs {
        justify-self: center;
        font-size: var(--oa-fs-xs);
        font-weight: 700;
        color: var(--oa-text-4);
        letter-spacing: 1px;
    }

    .pair__rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .pair__row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr);
        align-items: center;
        gap: var(--oa-gap);
        padding: 7px 0;
        border-bottom: 1px dashed var(--oa-border-light);

        &--list {
            align-items: start;
        }
    }

    .pair__side {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;

        &--left {
            justify-content: flex-end;
            text-align: right;
        }

        &--right {
            justify-content: flex-start;
        }
    }

    .pair__val {
        flex: 0 0 auto;
        min-width: 62px;
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .pair__track {
        flex: 1 1 auto;
        display: flex;
        min-width: 0;
        height: 10px;
        border-radius: 6px;
        background: var(--oa-hover);

        /* 左侧条形贴中心线向右收 */
        &--left {
            justify-content: flex-end;
        }
    }

    .pair__bar {
        display: block;
        height: 100%;
        border-radius: 6px;
        transition: width 0.2s ease;
    }

    .pair__label {
        justify-self: center;
        text-align: center;
    }

    .pair__label-text {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        border-bottom: 1px dashed var(--oa-text-4);
        cursor: help;
        white-space: nowrap;
    }

    .pair__tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        min-width: 0;
    }

    .pair__side--left .pair__tags {
        justify-content: flex-end;
    }

    .pair__plats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        min-width: 0;
    }

    .pair__side--left .pair__plats {
        justify-content: flex-end;
    }

    .pair__plat {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .pair__plat-dot {
        width: 7px;
        height: 7px;
        border-radius: 2px;
    }

    .pair__plat-share {
        color: var(--oa-text-4);
    }

    .pair__note {
        margin: 10px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }

    /* 窄屏：对比条降为单列堆叠，避免两侧挤成一条线 */
    @media (max-width: 1100px) {
        .pair__head,
        .pair__row {
            grid-template-columns: minmax(0, 1fr);
        }

        .pair__label {
            order: -1;
            justify-self: start;
        }

        .pair__side--left {
            justify-content: flex-start;
        }
    }
</style>
