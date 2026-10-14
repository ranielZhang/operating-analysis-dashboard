<template>
    <div class="hl">
        <!-- 经营结论：一句话说清本期经营结果，用标准口径表述 -->
        <div class="hl__verdict">
            <el-tag :type="verdict.tag" size="small" effect="dark" class="hl__verdict-tag">{{ verdict.label }}</el-tag>
            <p class="hl__verdict-text">{{ verdict.text }}</p>
        </div>

        <!-- 关键指标：复用全站统一的 MetricCard，保持视觉一致 -->
        <div class="hl__metrics">
            <MetricCard
                label="经营利润"
                :value="m.operatingProfit"
                format="moneyAuto"
                tone="operating"
                colored
                :compare="mom"
                compare-label="环比上期"
                :hint="`利润率 ${percent(m.operatingMargin)}`"
            />
            <MetricCard
                label="账面利润"
                :value="m.bookProfit"
                format="moneyAuto"
                tone="book"
                colored
                hint="银行流水口径 · 已收已付"
            />
            <MetricCard
                label="口径差额"
                :value="m.profitGap"
                format="moneyAuto"
                tone="gap"
                colored
                hint="经营利润 − 账面利润"
            />
            <MetricCard
                label="现金缺口"
                :value="m.cashGap"
                format="moneyAuto"
                tone="warn"
            >
                <template #extra>
                    <div class="hl__split">
                        <span>应收未收 {{ money(m.receivable) }}</span>
                        <span>预付余额 {{ money(m.prepayBalance) }}</span>
                    </div>
                </template>
            </MetricCard>
            <MetricCard
                label="累计预估 ROI"
                :value="m.forecastRoi"
                format="ratio"
                suffix="倍"
                :hint="`累计口径 · ${filter.roiWindow} 日曲线 · 实际 ROI ${ratio(m.actualRoi)}`"
            />
            <MetricCard
                label="亏损游戏"
                :value="lossCount"
                format="int"
                :tone="lossCount > 0 ? 'warn' : 'default'"
                :hint="`共 ${gameRows.length} 个游戏在投`"
            />
        </div>

        <!-- 月度经营利润趋势 -->
        <PanelCard title="月度经营利润" :subtitle="`按${basisText}口径 · 单位：万元`" plain body-class="hl__chart-body">
            <EChart v-if="series.length" :option="trendOption" style="height: 168px" />
            <PanelEmptyState v-else text="当前筛选条件下暂无月度数据" />
        </PanelCard>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import MetricCard from '@/components/MetricCard.vue';
    import { store } from '@/domain/store';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, percent, ratio, toWan } from '@/utils/format';

    /**
     * 经营总览首屏：经营结论 + 关键指标 + 月度趋势。
     *
     * 口径说明：
     *   - 文案一律使用财务通用术语（经营利润 / 账面利润 / 口径差额 / 现金缺口），
     *     不出现口语化改写；术语的业务含义在右上角「口径说明」里集中解释。
     *   - 指标卡复用全站统一的 MetricCard，不另做一套视觉。
     */
    defineOptions({ name: 'OverviewHeadline' });

    const { filter } = useAnalysisFilter();

    /** 全零兜底，避免无数据时模板判空 */
    const ZERO = {
        revenue: 0, accrualRevenue: 0, cashRevenue: 0,
        revenueByType: { liuliangzhu: 0, adGold: 0, iapShare: 0 },
        businessCost: 0, laborCost: 0, adminCost: 0, totalCost: 0,
        costByType: {
            adSpend: 0, prepay: 0, salary: 0, socialInsurance: 0,
            individualTax: 0, projectBonus: 0, welfare: 0, office: 0,
        },
        profit: 0, margin: 0, bookProfit: 0, operatingProfit: 0, profitGap: 0,
        bookMargin: 0, operatingMargin: 0,
        spend: 0, prepay: 0, prepayBalance: 0, receivable: 0, cashGap: 0,
        forecastRoi: 0, actualRoi: 0, recoveryRate: 0, cumSpend: 0, cumExp: 0,
        efficiencyRatio: 0, headcount: 0, perCapitaProfit: 0,
    };
    const m = computed(() => store.metricsOf(filter, 'company', 'company') ?? ZERO);
    const series = computed(() => store.queryMonthSeries(filter));
    const gameRows = computed(() => store.queryRows(filter, 'game'));
    const lossCount = computed(() => gameRows.value.filter((g) => g.operatingProfit < 0).length);
    const basisText = computed(() => (filter.basis === 'book' ? '账面' : '经营'));

    /** 与上一等长期间比较的经营利润环比 */
    const mom = computed<number | null>(() => {
        const [sy, sm] = filter.startMonth.split('-').map(Number);
        const [ey, em] = filter.endMonth.split('-').map(Number);
        const len = Math.max(1, ey * 12 + em - (sy * 12 + sm) + 1);
        const key = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
        const startIdx = sy * 12 + (sm - 1) - len;
        const prev = store.metricsOf(
            { ...filter, startMonth: key(startIdx), endMonth: key(startIdx + len - 1) },
            'company',
            'company',
        );
        const base = prev?.operatingProfit ?? 0;
        if (!base) return null;
        return (m.value.operatingProfit - base) / Math.abs(base);
    });

    /**
     * 经营结论。判断顺序：经营是否盈利 → 现金流是否被占用 → 是否处于投入期。
     * 措辞对齐财务口径，不使用"赚钱/亏钱"这类口语。
     */
    const verdict = computed(() => {
        const v = m.value;
        if (v.accrualRevenue === 0 && v.spend === 0 && v.headcount === 0) {
            return { tag: 'info' as const, label: '无数据', text: '当前筛选条件下无经营数据。' };
        }
        if (v.operatingProfit < 0) {
            return {
                tag: 'danger' as const,
                label: '经营亏损',
                text: `本期经营利润 ${money(v.operatingProfit)}，经营利润率 ${percent(v.operatingMargin)}。${lossCount.value} 个游戏处于亏损状态，需评估投放节奏与止损线。`,
            };
        }
        if (v.profitGap > 0) {
            return {
                tag: 'warning' as const,
                label: '投入期',
                text: `本期经营利润 ${money(v.operatingProfit)}（利润率 ${percent(v.operatingMargin)}），账面利润 ${money(v.bookProfit)}，口径差额 ${money(v.profitGap)}。差额来自应收未收 ${money(v.receivable)} 与预付余额 ${money(v.prepayBalance)}，属于放量投入期的正常特征：经营成果已确认，现金尚未回笼。`,
            };
        }
        return {
            tag: 'success' as const,
            label: '经营正常',
            text: `本期经营利润 ${money(v.operatingProfit)}（利润率 ${percent(v.operatingMargin)}），账面利润 ${money(v.bookProfit)}，两者差异 ${money(Math.abs(v.profitGap))}，回收进度与投放节奏基本匹配。`,
        };
    });

    const trendOption = computed<EChartsOption>(() => {
        const pts = series.value;
        return {
            // 图表只作趋势示意，刻意压扁：不占用首屏纵向空间
            grid: { left: 52, right: 20, top: 14, bottom: 22 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => `${Number(v).toFixed(0)} 万`,
            },
            xAxis: {
                type: 'category',
                data: pts.map((p) => p.label),
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 10 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                splitNumber: 3,
                axisLabel: { color: '#94a3b8', fontSize: 10 },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series: [
                {
                    name: '经营利润',
                    type: 'bar',
                    barMaxWidth: 20,
                    data: pts.map((p) => Number(toWan(p.metrics.operatingProfit).toFixed(1))),
                    itemStyle: {
                        color: (params: { value: number }) => (params.value >= 0 ? '#12b566' : '#fd6464'),
                        borderRadius: [2, 2, 0, 0],
                    },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: '#cbd5e1', type: 'dashed' },
                        data: [{ yAxis: 0 }],
                    },
                },
            ],
        } as EChartsOption;
    });
</script>

<style scoped lang="scss">
    .hl {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
    }

    .hl__verdict {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
    }

    .hl__verdict-tag {
        flex: 0 0 auto;
        margin-top: 1px;
    }

    .hl__verdict-text {
        margin: 0;
        font-size: var(--oa-fs-sm);
        line-height: 1.75;
        color: var(--oa-text-2);
    }

    .hl__metrics {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    @media (max-width: 1600px) {
        .hl__metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    @media (max-width: 1024px) {
        .hl__metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    /* 图表容器内边距收紧 */
    :deep(.hl__chart-body),
    .hl__chart-body {
        padding: 6px 10px 4px;
    }

    .hl__split {
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 11px;
        color: var(--oa-text-4);
    }
</style>
