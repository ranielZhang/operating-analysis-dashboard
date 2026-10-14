<template>
    <section class="kpi">
        <header class="kpi__head">
            <h3 class="kpi__title">公司整体经营结果</h3>
            <span class="kpi__period">{{ periodLabel }}</span>
        </header>

        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无经营数据" />

        <template v-else>
            <!-- 第一行：8 张主指标卡（4 × 2） -->
            <div class="kpi__grid">
                <MetricCard
                    :label="revenueLabel"
                    :value="m.revenue"
                    format="moneyAuto"
                    tone="revenue"
                    :compare="mom"
                    compare-label="利润环比"
                    :hint="revenueHint"
                    :badge="basisBadge"
                    badge-tone="default"
                />

                <MetricCard
                    label="营业成本"
                    :value="m.totalCost"
                    format="moneyAuto"
                    tone="cost"
                    :compare="mom"
                    compare-label="成本环比"
                    compare-mode="down-good"
                    :hint="costHint"
                />

                <MetricCard
                    label="账面利润"
                    :value="m.bookProfit"
                    format="moneyAuto"
                    tone="book"
                    colored
                    :compare="mom"
                    compare-label="利润环比"
                    hint="银行流水口径 · 已收已付"
                    :badge="m.bookProfit >= 0 ? '现金为正' : '现金为负'"
                    :badge-tone="m.bookProfit >= 0 ? 'success' : 'danger'"
                />

                <MetricCard
                    label="经营利润"
                    :value="m.operatingProfit"
                    format="moneyAuto"
                    tone="operating"
                    colored
                    :compare="mom"
                    compare-label="利润环比"
                    hint="投资+预估回报口径"
                    :badge="m.operatingProfit >= 0 ? '经营盈利' : '经营亏损'"
                    :badge-tone="m.operatingProfit >= 0 ? 'success' : 'danger'"
                />

                <MetricCard
                    label="经营利润率"
                    :value="m.operatingMargin"
                    format="percent"
                    tone="operating"
                    colored
                    :hint="`经营利润 ÷ ${revenueLabel}`"
                />

                <MetricCard
                    label="累计预估 ROI"
                    :value="m.forecastRoi"
                    format="ratio"
                    tone="default"
                    suffix="倍"
                    :hint="roiHint"
                >
                    <template #extra>
                        <div class="kpi__split">
                            <span class="kpi__split-lab">累计实际 ROI</span>
                            <span class="kpi__split-val oa-num">{{ m.actualRoi.toFixed(2) }} 倍</span>
                        </div>
                        <div class="kpi__split">
                            <span class="kpi__split-lab">预估 − 实际</span>
                            <span class="kpi__split-val oa-num">{{ roiDeltaText }}</span>
                        </div>
                    </template>
                </MetricCard>

                <MetricCard label="现金缺口" :value="m.cashGap" format="moneyAuto" tone="gap" hint="预付余额 + 应收未收（时点）">
                    <template #extra>
                        <div class="kpi__split">
                            <span class="kpi__split-lab">预付余额</span>
                            <span class="kpi__split-val oa-num">{{ money(m.prepayBalance) }}</span>
                        </div>
                        <div class="kpi__split">
                            <span class="kpi__split-lab">应收未收</span>
                            <span class="kpi__split-val oa-num">{{ money(m.receivable) }}</span>
                        </div>
                    </template>
                </MetricCard>

                <MetricCard
                    label="回收完成度"
                    :value="m.recoveryRate"
                    format="percent"
                    tone="gap"
                    :hint="`累计已回收 / 累计预估总回收 · 实际 ROI ${m.actualRoi.toFixed(2)} 倍`"
                    :badge="recoveryBadge.text"
                    :badge-tone="recoveryBadge.tone"
                />
            </div>

            <!-- 第二行：双口径差额与结构速览（5 张 sm 卡） -->
            <div class="kpi__grid-second">
                <MetricCard
                    label="口径差额"
                    :value="m.profitGap"
                    format="moneyAuto"
                    tone="gap"
                    colored
                    :hint="`经营高于账面 ${money(m.profitGap)}，代表已投入未回收（预付余额 ${money(m.prepayBalance)} + 应收未收 ${money(m.receivable)}）`"
                />

                <MetricCard
                    label="投放消耗"
                    :value="m.spend"
                    format="moneyAuto"
                    tone="cost"
                    size="sm"
                    :hint="spendHint"
                />

                <MetricCard
                    label="充值支出"
                    :value="m.prepay"
                    format="moneyAuto"
                    tone="cost"
                    size="sm"
                    :hint="prepayHint"
                />

                <MetricCard
                    label="人工成本"
                    :value="m.laborCost"
                    format="moneyAuto"
                    tone="default"
                    size="sm"
                    :hint="laborHint"
                />

                <MetricCard
                    label="管理费用"
                    :value="m.adminCost"
                    format="moneyAuto"
                    tone="default"
                    size="sm"
                    :hint="`福利费 + 办公费 · 占总成本 ${percent(adminShare)}`"
                />

                <MetricCard
                    label="人效比"
                    :value="m.efficiencyRatio"
                    format="ratio"
                    tone="operating"
                    size="sm"
                    colored
                    suffix="倍"
                    hint="经营利润 / 人工成本"
                />
            </div>

            <!-- 第三行：一句人话结论 -->
            <div class="kpi__insight" :class="`kpi__insight--${insight.tone}`">
                <span class="kpi__insight-tag">{{ insight.tag }}</span>
                <p class="kpi__insight-text">{{ insight.text }}</p>
            </div>
        </template>
    </section>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import MetricCard from '@/components/MetricCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import type { AnalysisFilter, Metrics } from '@/domain/types';
    import { money, percent } from '@/utils/format';

    /**
     * 经营总览 · 核心指标卡行（M2）
     * 无 props：自行读取全局筛选条件，全部指标由 computed 派生，筛选变化自动重算。
     */
    defineOptions({ name: 'OverviewKpiRow' });

    const { filter, periodLabel } = useAnalysisFilter();

    /** metricsOf 理论上恒有值（company 维度）；兜底零值对象，避免 null 分支造数 */
    function zeroMetrics(): Metrics {
        return {
            revenue: 0,
            accrualRevenue: 0,
            cashRevenue: 0,
            revenueByType: { liuliangzhu: 0, adGold: 0, iapShare: 0 },
            businessCost: 0,
            laborCost: 0,
            adminCost: 0,
            totalCost: 0,
            costByType: {
                adSpend: 0,
                prepay: 0,
                salary: 0,
                socialInsurance: 0,
                individualTax: 0,
                projectBonus: 0,
                welfare: 0,
                office: 0,
            },
            profit: 0,
            margin: 0,
            bookProfit: 0,
            operatingProfit: 0,
            profitGap: 0,
            bookMargin: 0,
            operatingMargin: 0,
            spend: 0,
            prepay: 0,
            prepayBalance: 0,
            receivable: 0,
            cashGap: 0,
            forecastRoi: 0,
            actualRoi: 0,
            recoveryRate: 0,
            efficiencyRatio: 0,
            headcount: 0,
            cumSpend: 0,
            cumExp: 0,
            perCapitaProfit: 0,
        };
    }

    const scopeKey = computed(() => JSON.stringify(filter));

    /** 公司整体指标 */
    const m = computed<Metrics>(() => {
        scopeKey.value; // 依赖筛选（含 roiWindow / basis），保证重算
        return store.metricsOf(filter as AnalysisFilter, 'company', 'company') ?? zeroMetrics();
    });

    /** 公司整体行的环比（利润环比，可能为 null） */
    const mom = computed<number | null>(() => {
        scopeKey.value;
        return store.queryRows(filter as AnalysisFilter, 'company')[0]?.mom ?? null;
    });

    const isBook = computed(() => filter.basis === 'book');
    const revenueLabel = computed(() => (isBook.value ? '已到账收入' : '应确认收入'));
    const basisBadge = computed(() => (isBook.value ? '账面口径' : '经营口径'));
    const revenueHint = computed(() =>
        isBook.value ? '银行流水已到账口径 · 按平台结算滞后确认' : '权责发生制应计确认口径 · 含预估回收',
    );
    const costHint = computed(() => (isBook.value ? '账面口径：本期充值支出 + 人工 + 管理' : '经营口径：本期投放消耗 + 人工 + 管理'));

    const roiHint = computed(() => `累计口径 · ${filter.roiWindow}日曲线 · 实际 ROI ${m.value.actualRoi.toFixed(2)} 倍对比`);
    const roiDeltaText = computed(() => {
        const d = m.value.forecastRoi - m.value.actualRoi;
        const abs = Math.abs(d).toFixed(2);
        if (d > 0) return `+${abs} 倍（回收中）`;
        if (d < 0) return `-${abs} 倍（已超预估）`;
        return '与预估持平';
    });

    const recoveryBadge = computed<{ text: string; tone: 'success' | 'warn' | 'danger' }>(() => {
        const r = m.value.recoveryRate;
        if (r >= 0.9) return { text: '接近收尾', tone: 'success' };
        if (r >= 0.7) return { text: '进度正常', tone: 'success' };
        if (r >= 0.5) return { text: '进度偏慢', tone: 'warn' };
        return { text: '回收滞后', tone: 'danger' };
    });

    const adminShare = computed(() => {
        const t = m.value.totalCost;
        return t > 0 ? m.value.adminCost / t : 0;
    });

    const spendHint = computed(() => {
        const diff = m.value.prepay - m.value.spend;
        if (diff > 0) return `媒体后台实际消耗 · 比充值少 ${money(diff)}`;
        if (diff < 0) return `媒体后台实际消耗 · 比充值多 ${money(-diff)}（在消耗历史预付余额）`;
        return '媒体后台实际消耗 · 与本期充值持平';
    });
    const prepayHint = computed(() => {
        const diff = m.value.prepay - m.value.spend;
        if (diff > 0) return `账户实际现金流出 · 比消耗多 ${money(diff)}，差额沉淀为预付余额`;
        if (diff < 0) return `账户实际现金流出 · 比消耗少 ${money(-diff)}`;
        return '账户实际现金流出 · 与消耗持平';
    });

    const laborHint = computed(
        () => `${m.value.headcount} 人 · 人均经营利润 ${money(m.value.perCapitaProfit)}（工资+医社保+个税+项目奖金）`,
    );

    const isEmpty = computed(() => {
        const v = m.value;
        return v.revenue === 0 && v.totalCost === 0 && v.spend === 0 && v.headcount === 0;
    });

    /** 第三行：人话结论（按业务含义分支，优先级：亏损 > 放量投入 > 回收超预期 > 回收落后） */
    const insight = computed<{ tag: string; tone: 'success' | 'warn' | 'danger' | 'primary'; text: string }>(() => {
        const v = m.value;
        const core = `本周期${revenueLabel.value} ${money(v.revenue)}，经营利润 ${money(v.operatingProfit)}（利润率 ${percent(
            v.operatingMargin,
        )}），账面利润 ${money(v.bookProfit)}，口径差额 ${money(v.profitGap)}`;
        const split = `差额来自预付余额 ${money(v.prepayBalance)} 与应收未收 ${money(v.receivable)}`;
        const tail =
            `回款进度：累计回收完成度 ${percent(v.recoveryRate)}，累计预估 ROI ${v.forecastRoi.toFixed(2)} 倍、累计实际 ROI ${v.actualRoi.toFixed(
                2,
            )} 倍；人效比 ${v.efficiencyRatio.toFixed(2)} 倍（${v.headcount} 人、人均经营利润 ${money(v.perCapitaProfit)}）。`;
        const full = (mid: string) => `${core} —— ${mid}，${split}。${tail}`;

        if (v.operatingProfit < 0) {
            return {
                tag: '经营亏损',
                tone: 'danger',
                text: full('经营口径尚未回本，需评估投放节奏与低效组合'),
            };
        }
        if (v.profitGap > 0) {
            return {
                tag: '放量投入期',
                tone: 'warn',
                text: full('经营已盈利但现金尚未回笼，说明当前处于放量投入期，回收尚未体现在银行账户'),
            };
        }
        if (v.bookProfit > v.operatingProfit) {
            return {
                tag: '回收超预期',
                tone: 'success',
                text: full('账面好于经营，回收超预期或存在应付未付，需关注未结算的对外付款'),
            };
        }
        if (v.recoveryRate < 0.7) {
            return {
                tag: '回收落后',
                tone: 'warn',
                text: full('回收进度落后于预估曲线，预估回报存在下修风险，建议复核预估曲线参数'),
            };
        }
        return {
            tag: '经营健康',
            tone: 'success',
            text: full('经营与账面口径方向一致，投入产出匹配，当前回收节奏符合预估曲线'),
        };
    });
</script>

<style scoped lang="scss">
    .kpi {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-height: 0;
    }

    .kpi__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--oa-gap);
    }

    .kpi__title {
        margin: 0;
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .kpi__period {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .kpi__grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .kpi__grid-second {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .kpi__split {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        font-size: var(--oa-fs-xs);
        line-height: 18px;
        color: var(--oa-text-3);
    }

    .kpi__split-lab {
        color: var(--oa-text-4);
        white-space: nowrap;
    }

    .kpi__split-val {
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .kpi__insight {
        display: flex;
        align-items: flex-start;
        gap: var(--oa-gap);
        padding: 10px 14px;
        background: var(--oa-primary-soft);
        border: 1px solid var(--oa-border);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius);
        min-height: 0;

        &--warn {
            background: var(--oa-warning-soft);
            border-left-color: var(--oa-warning);
        }
        &--danger {
            background: var(--oa-danger-soft);
            border-left-color: var(--oa-danger);
        }
        &--success {
            background: var(--oa-success-soft);
            border-left-color: var(--oa-success);
        }
    }

    .kpi__insight-tag {
        flex: none;
        padding: 1px 8px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-card);
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        line-height: 18px;
        color: var(--oa-text-1);
    }

    .kpi__insight-text {
        margin: 0;
        font-size: var(--oa-fs-sm);
        line-height: 20px;
        color: var(--oa-text-2);
    }

    @media (max-width: 1280px) {
        .kpi__grid,
        .kpi__grid-second {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
</style>
