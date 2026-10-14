<template>
    <!-- ============================================================
         区块 1 · 团队人效总览
         一行 5 张指标卡：投手人数 / 发行中心人工成本 / 投手合计经营利润 /
         平均人效比 / 人效比 > 1 人数
    ============================================================ -->
    <section class="tkpi">
        <template v-if="hasPitchers">
            <div class="tkpi__cards">
                <MetricCard
                    label="投手人数"
                    :value="totals.count"
                    format="int"
                    tone="default"
                    :hint="`个人层共 ${levelRowCount} 人（含非投放岗）`"
                />
                <MetricCard
                    label="发行中心人工成本"
                    :value="centerLaborCost"
                    format="moneyAuto"
                    tone="cost"
                    :hint="centerHint"
                />
                <MetricCard
                    label="投手合计经营利润"
                    :value="totals.operatingProfit"
                    format="moneyAuto"
                    tone="operating"
                    colored
                    :hint="profitHint"
                />
                <MetricCard
                    label="平均人效比"
                    :value="totals.avgEfficiency"
                    format="ratio"
                    tone="success"
                    :hint="`合计口径 ${ratio(totals.teamEfficiency)}（利润 ÷ 人力）`"
                />
                <MetricCard
                    label="人效比 > 1 的投手"
                    :value="totals.overOne"
                    format="int"
                    tone="success"
                    badge="已覆盖人力成本"
                    badge-tone="success"
                    :hint="`共 ${totals.count} 人`"
                />
            </div>

            <!-- 口径小字：三个比率的口径必须写清楚，否则数字会被误读 -->
            <p class="tkpi__note">
                <span class="tkpi__note-key">口径</span>
                <b>人效比</b> = 经营利润 ÷ 该投手人力成本（工资 + 医社保 + 个税 + 项目奖金），> 1 表示其创造的经营利润已覆盖自身人力成本；
                <b>累计预估 ROI</b> = 累计预估总回收 ÷ 累计投放消耗（倍数，1.00 = 回本，<i>累计口径、非本期</i>）；
                <b>回收完成度</b> = 累计已回收 ÷ 累计预估总回收。
                本页利润与人效指标<b>固定采用经营利润口径</b>（应确认收入 − 投放消耗 − 人力成本），顶部筛选栏的「利润口径」切换不影响本页；
                累计预估 ROI 会随「预估窗口」与预估曲线参数变化。
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内没有投手（投手只存在于发行中心 · 投放部），请调整筛选范围" />
    </section>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import MetricCard from '@/components/MetricCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { comma, money, percent, ratio } from '@/utils/format';
    import { usePitcherData } from './usePitcherData';

    /** 投手人效页 · 团队人效总览（无 props，自读全局筛选条件） */
    defineOptions({ name: 'PitcherTeamKpi' });

    const { levelRowCount, hasPitchers, totals, issueCenterMetrics } = usePitcherData();

    /** 发行中心人工成本（中心口径，含运营 / 素材等非投放部门） */
    const centerLaborCost = computed(() => issueCenterMetrics.value?.laborCost ?? 0);

    const centerHint = computed(() => {
        const m = issueCenterMetrics.value;
        if (!m) return '当前筛选范围不含发行中心';
        return `中心口径 ${comma(m.headcount)} 人 · 工资+医社保+个税+项目奖金`;
    });

    /** 投手合计经营利润占发行中心的比例，说明投放盘面在中心里的分量 */
    const profitHint = computed(() => {
        const center = issueCenterMetrics.value;
        const mine = totals.value.operatingProfit;
        if (!center || center.operatingProfit === 0) return '应确认收入 − 投放消耗 − 人力成本';
        // 任一方为负时「占比」会失去意义（负 ÷ 负 = 正数），改为直接对比金额
        if (center.operatingProfit < 0 || mine < 0) {
            return `中心合计 ${money(center.operatingProfit)}（含运营 / 素材部人工与管理成本）`;
        }
        return `占发行中心经营利润 ${percent(mine / center.operatingProfit)}（中心 ${money(center.operatingProfit)}）`;
    });
</script>

<style scoped lang="scss">
    .tkpi {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-width: 0;
    }

    .tkpi__cards {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-width: 0;
    }

    .tkpi__note {
        margin: 0;
        padding: 8px 12px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-2);
        }

        i {
            font-style: normal;
            color: var(--oa-warning);
        }
    }

    .tkpi__note-key {
        display: inline-block;
        margin-right: 6px;
        padding: 0 6px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
        font-weight: 600;
    }

    /* 窄屏降列：5 → 3 → 2 → 1 */
    @media (max-width: 1500px) {
        .tkpi__cards {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    @media (max-width: 900px) {
        .tkpi__cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 560px) {
        .tkpi__cards {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
