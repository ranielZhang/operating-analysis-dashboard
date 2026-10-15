<template>
    <PanelCard title="节点详情" class="drill-detail">
        <template #actions>
            <span class="detail__name">{{ drillSelection.name }}</span>
            <el-tag v-if="orgNode?.isPitcher" size="small" effect="light" type="success">投手</el-tag>
            <el-tag v-if="gameMeta?.keyGame" size="small" effect="light" type="warning">重点游戏</el-tag>
        </template>

        <div class="detail__scroll oa-scroll">
            <PanelEmptyState v-if="!m" text="当前筛选条件下该节点无数据（可能已被筛选条件排除）" />

            <template v-else>
                <!-- 区块 1 · 节点补充信息（名称已放到标题栏右侧） -->
                <header v-if="gameMeta || (!orgNode && !gameMeta)" class="detail__head">
                    <div v-if="gameMeta" class="detail__meta">
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">变现类型</i>{{ monetizeLabel }}
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">上线月份</i>{{ monthLabel(gameMeta.onlineMonth) }}
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">生命周期</i>{{ gameMeta.stage }}
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">是否重点</i>{{ gameMeta.keyGame ? '是' : '否' }}
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">目标回本</i>{{ gameMeta.paybackDays }} 天
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">ROI 红线</i><b class="oa-num">{{ ratio(gameMeta.redLineRoi) }}</b>
                        </span>
                    </div>

                    <div v-if="!orgNode && !gameMeta" class="detail__meta">
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">节点键</i><b class="oa-num">{{ drillSelection.key }}</b>
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">期间</i>{{ filter.startMonth }} ~ {{ filter.endMonth }}
                        </span>
                    </div>
                </header>

                <!-- 区块 2 · 四张核心小卡 -->
                <div class="detail__cards">
                    <MetricCard
                        label="经营利润"
                        :value="m.operatingProfit"
                        format="moneyAuto"
                        tone="operating"
                        :colored="true"
                        size="sm"
                    />
                    <MetricCard
                        label="账面利润"
                        :value="m.bookProfit"
                        format="moneyAuto"
                        tone="book"
                        :colored="true"
                        size="sm"
                    />
                    <MetricCard
                        label="累计预估 ROI"
                        :value="m.forecastRoi"
                        format="ratio"
                        tone="gap"
                        size="sm"
                    />
                    <MetricCard
                        label="累计回收完成度"
                        :value="m.recoveryRate"
                        format="percent"
                        tone="revenue"
                        size="sm"
                    />
                </div>

                <!-- 区块 3 · 月度趋势 -->
                <section class="detail__block">
                    <div class="detail__block-head">
                        <span class="detail__block-title">月度走势</span>
                    </div>
                    <EChart v-if="series.length" :option="chartOption" style="height: 200px" />
                    <PanelEmptyState v-else text="所选期间内没有可用的月度数据" />
                </section>

                <!-- 区块 4 · 结构明细 -->
                <section class="detail__block">
                    <div class="detail__block-head">
                        <span class="detail__block-title">结构明细</span>
                    </div>
                    <div class="detail__breakdown">
                        <div v-for="panel in breakdownPanels" :key="panel.key" class="detail__pie-card">
                            <div class="detail__pie-head">
                                <span class="detail__pie-title" :class="`detail__pie-title--${panel.key}`">
                                    {{ panel.title }}
                                </span>
                                <span class="detail__pie-total oa-num">{{ money(panel.total) }}</span>
                            </div>
                            <div class="detail__pie-body">
                                <EChart
                                    v-if="panel.total > 0"
                                    :option="panel.option"
                                    class="detail__pie-chart"
                                    style="width: 148px; height: 148px"
                                />
                                <PanelEmptyState v-else text="本期无发生" class="detail__pie-empty" />
                                <!-- 图例放在本卡片内部，不会与相邻卡片的图例混淆 -->
                                <ul class="detail__legend">
                                    <li v-for="row in panel.rows" :key="row.name" class="detail__legend-row">
                                        <span class="detail__legend-dot" :style="{ background: row.color }" />
                                        <span class="detail__legend-name">{{ row.name }}</span>
                                        <span class="detail__legend-val oa-num">{{ money(row.value) }}</span>
                                        <span class="detail__legend-pct oa-num">{{ percent(row.share) }}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 区块 5 · 现金口径 -->
                <p v-if="prepayAmount > 0" class="detail__note">
                    预付（本期充值）<b class="oa-num">{{ money(prepayAmount) }}</b>
                    属银行流水口径，与投放消耗不可叠加，故不计入成本构成。
                </p>
                <p v-if="showCash" class="detail__cash">
                    预付余额 <b class="oa-num">{{ money(m.prepayBalance) }}</b> · 应收未收
                    <b class="oa-num">{{ money(m.receivable) }}</b> → 现金缺口
                    <b class="oa-num" :class="trendClass(m.cashGap)">{{ money(m.cashGap) }}</b>
                </p>
            </template>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import MetricCard from '@/components/MetricCard.vue';
    import EChart from '@/components/EChart.vue';
    import { store } from '@/domain/store';
    import { GAME_MAP, ORG_MAP } from '@/domain/dimensions';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, monthLabel, percent, ratio, toWan, trendClass } from '@/utils/format';
    import { drillSelection } from '../useDrillSelection';

    /** 经营数据看板 · 节点详情侧栏：节点头部 / 核心小卡 / 月度走势 / 现金口径 */
    defineOptions({ name: 'DrillDetailPanel' });

    const { filter } = useAnalysisFilter();

    /** 单节点指标；节点被筛选条件排除时为 null */
    const m = computed(() => store.metricsOf(filter, drillSelection.dim, drillSelection.key));

    // ---------- 区块 1 · 节点头部元数据 ----------
    const orgNode = computed(() => ORG_MAP.get(drillSelection.key) ?? null);

    const gameMeta = computed(() => GAME_MAP.get(drillSelection.key) ?? null);

    const MONETIZE_LABEL: Record<'iaa' | 'iap' | 'mix', string> = {
        iaa: 'IAA 广告变现',
        iap: 'IAP 内购',
        mix: '混合变现',
    };
    const monetizeLabel = computed(() => (gameMeta.value ? MONETIZE_LABEL[gameMeta.value.monetize] : ''));

    // ---------- 区块 3 · 该节点的月度序列（逐月按节点取数） ----------
    const series = computed(() => {
        const months = store.months.slice(-12).filter((mo) => mo >= filter.startMonth && mo <= filter.endMonth);
        return months.map((mo) => {
            const f = { ...filter, startMonth: mo, endMonth: mo };
            const mm = store.metricsOf(f, drillSelection.dim, drillSelection.key);
            return {
                label: `${Number(mo.slice(5))}月`,
                month: mo,
                income: mm?.accrualRevenue ?? 0,
                profit: mm?.operatingProfit ?? 0,
            };
        });
    });

    const chartOption = computed<EChartsOption>(() => ({
        grid: { left: 52, right: 52, top: 30, bottom: 24 },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            // 图内数据已由 toWan() 转成「万」，提示时需还原成「元」再走 money()
            valueFormatter: (v) => money(Number(v) * 1e4),
        },
        legend: {
            top: 0,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: '#64748b', fontSize: 11 },
            data: ['应确认收入', '经营利润'],
        },
        xAxis: {
            type: 'category',
            data: series.value.map((d) => d.label),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#94a3b8', fontSize: 11 },
            axisTick: { show: false },
        },
        yAxis: [
            {
                type: 'value',
                name: '收入',
                nameTextStyle: { color: '#94a3b8', fontSize: 10 },
                splitNumber: 4,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            {
                type: 'value',
                name: '利润',
                nameTextStyle: { color: '#94a3b8', fontSize: 10 },
                splitNumber: 4,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(0)}万` },
                splitLine: { show: false },
            },
        ],
        series: [
            {
                name: '应确认收入',
                type: 'bar',
                yAxisIndex: 0,
                barMaxWidth: 16,
                itemStyle: { color: 'var(--oa-revenue)', borderRadius: [2, 2, 0, 0] },
                data: series.value.map((d) => toWan(d.income)),
            },
            {
                name: '经营利润',
                type: 'line',
                yAxisIndex: 1,
                smooth: false,
                symbolSize: 5,
                lineStyle: { width: 2, color: 'var(--oa-operating)' },
                itemStyle: { color: 'var(--oa-operating)' },
                data: series.value.map((d) => toWan(d.profit)),
                markLine: {
                    silent: true,
                    symbol: 'none',
                    label: { show: false },
                    lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1 },
                    data: [{ yAxis: 0 }],
                },
            },
        ],
    }));

    // ---------- 区块 4 · 结构明细 ----------
    interface BreakdownDef {
        name: string;
        value: number;
        color: string;
    }

    const revenueTotal = computed(() => {
        const r = m.value?.revenueByType;
        if (!r) return 0;
        return r.liuliangzhu + r.adGold + r.iapShare;
    });

    /** 成本合计 = 业务成本 + 人工 + 管理费用（当前口径），与下列 7 个科目之和恒等 */
    const costTotal = computed(() => m.value?.totalCost ?? 0);

    const revenueDefs = computed<BreakdownDef[]>(() => {
        const r = m.value?.revenueByType;
        return [
            { name: '流量主', value: r?.liuliangzhu ?? 0, color: '#8b5cf6' },
            { name: '广告金', value: r?.adGold ?? 0, color: '#f472b6' },
            { name: '分成', value: r?.iapShare ?? 0, color: '#06b6d4' },
        ];
    });

    /**
     * 成本科目。**刻意不含「预付」**：预付代表本期现金流出（充值额），
     * 与「投放」是同一笔业务成本的两种口径，两者相加会超过总成本
     * （实测 79.7% + 93.3% > 100%）。预付单独在图注说明。
     * 配色：投放红 → 人工四科目蓝（由深到浅）→ 管理两科目青（由深到浅）。
     */
    const costDefs = computed<BreakdownDef[]>(() => {
        const c = m.value?.costByType;
        return [
            { name: '投放', value: c?.adSpend ?? 0, color: '#fd6464' },
            { name: '工资', value: c?.salary ?? 0, color: '#4d94fa' },
            { name: '医社保', value: c?.socialInsurance ?? 0, color: '#7aaffb' },
            { name: '个税', value: c?.individualTax ?? 0, color: '#a5c9fd' },
            { name: '项目奖金', value: c?.projectBonus ?? 0, color: '#c9ddfe' },
            { name: '福利费', value: c?.welfare ?? 0, color: '#06b6d4' },
            { name: '办公费', value: c?.office ?? 0, color: '#5fd4e6' },
        ];
    });

    /** 本期充值额（现金口径），仅作说明，不计入构成 */
    const prepayAmount = computed(() => m.value?.costByType.prepay ?? 0);

    function withShare(defs: BreakdownDef[], total: number) {
        return defs.map((d) => ({ ...d, share: total > 0 ? d.value / total : 0 }));
    }

    const revenueRows = computed(() => withShare(revenueDefs.value, revenueTotal.value));
    const costRows = computed(() => withShare(costDefs.value, costTotal.value));

    /**
     * 环形饼图 option。
     * 图例由卡片内的 HTML 列表渲染。圆心文案挂在扇区 label 的 position:'center' 上，
     * 锚点就是饼心；不用 title，避免标题盒和 textAlign 互相偏移。
     */
    function pieOption(rows: Array<BreakdownDef & { share: number }>, total: number, centerLabel: string): EChartsOption {
        const slices = rows.filter((r) => r.value > 0);
        const centerLabelStyle = {
            show: true,
            position: 'center' as const,
            formatter: `{val|${money(total)}}\n{sub|${centerLabel}}`,
            rich: {
                val: {
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1f2937',
                    lineHeight: 18,
                    align: 'center' as const,
                },
                sub: { fontSize: 10, color: '#9ca3af', lineHeight: 14, align: 'center' as const },
            },
        };
        return {
            tooltip: {
                trigger: 'item',
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `${p.name}<br/>${money(p.value)} · ${p.percent.toFixed(1)}%`,
            },
            series: [
                {
                    type: 'pie',
                    radius: ['56%', '82%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    itemStyle: { borderColor: '#fff', borderWidth: 2 },
                    data: slices.map((r, index) => ({
                        name: r.name,
                        value: r.value,
                        itemStyle: { color: r.color },
                        label: index === 0 ? centerLabelStyle : { show: false },
                        labelLine: { show: false },
                        emphasis: index === 0 ? { label: centerLabelStyle } : { label: { show: false } },
                    })),
                },
            ],
        } as EChartsOption;
    }

    const breakdownPanels = computed(() => [
        {
            key: 'revenue',
            title: '收入构成',
            total: revenueTotal.value,
            rows: revenueRows.value,
            option: pieOption(revenueRows.value, revenueTotal.value, '收入合计'),
        },
        {
            key: 'cost',
            title: '成本构成',
            total: costTotal.value,
            rows: costRows.value,
            option: pieOption(costRows.value, costTotal.value, '成本合计'),
        },
    ]);

    // ---------- 区块 5 · 现金口径 ----------
    const showCash = computed(() => {
        if (drillSelection.dim === 'company') return true;
        const metrics = m.value;
        if (!metrics) return false;
        return metrics.prepayBalance !== 0 || metrics.receivable !== 0;
    });
</script>

<style scoped lang="scss">
    .drill-detail {
        height: 100%;
        min-height: 0;
    }

    .detail__scroll {
        height: 100%;
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
    }

    /* 区块 1 */
    .detail__head {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 10px;
        border-bottom: 1px dashed var(--oa-border-light);
    }

    .detail__name {
        max-width: 280px;
        overflow: hidden;
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .detail__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
    }

    .detail__meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .detail__meta-k {
        font-style: normal;
        color: var(--oa-text-4);
    }

    /* 区块 2 */
    /* 四张核心小卡：一行四列 */
    .detail__cards {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    /* 区块 3 / 4 通用块 */
    .detail__block {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .detail__block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }

    .detail__block-title {
        position: relative;
        padding-left: 9px;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
        white-space: nowrap;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 11px;
            border-radius: 2px;
            background: var(--oa-primary);
        }
    }

    .detail__note {
        margin: 0;
        font-size: 11px;
        line-height: 1.5;
        color: var(--oa-text-4);
    }

    /* 区块 4 */






    @media (max-width: 1700px) {
        .detail__cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }













    /* 结构明细：两张各自独立的饼图卡片，图例内嵌在本卡片内 */
    .detail__breakdown {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--oa-gap-lg);
    }

    .detail__pie-card {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 8px 10px 10px;
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius-sm);
        background: #fbfcfe;
    }

    .detail__pie-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 6px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--oa-border-light);
    }

    .detail__pie-title {
        position: relative;
        padding-left: 9px;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 12px;
            border-radius: 2px;
        }
    }

    .detail__pie-title--revenue::before {
        background: var(--oa-revenue);
    }

    .detail__pie-title--cost::before {
        background: var(--oa-cost);
    }

    .detail__pie-total {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .detail__pie-body {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        /* 两张卡片等高时，内容在卡片内垂直居中，不把空白堆在底部 */
        flex: 1 1 auto;
    }

    .detail__pie-chart {
        flex: 0 0 148px;
    }

    .detail__pie-empty {
        flex: 0 0 148px;
        min-height: 148px;
    }

    .detail__legend {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    /* 科目 / 金额 / 占比 三列对齐，行间加极淡斑马纹，便于横向读数（成本有 7 行） */
    .detail__legend-row {
        display: grid;
        grid-template-columns: 8px minmax(44px, 1fr) minmax(70px, auto) 48px;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        border-radius: 3px;
        font-size: var(--oa-fs-xs);
        line-height: 1.5;

        &:nth-child(odd) {
            background: rgba(241, 245, 249, 0.7);
        }
    }

    .detail__legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .detail__legend-name {
        color: var(--oa-text-2);
        white-space: nowrap;
    }

    .detail__legend-val {
        color: var(--oa-text-1);
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
    }

    .detail__legend-pct {
        color: var(--oa-text-3);
        text-align: right;
        white-space: nowrap;
    }

    @media (max-width: 1200px) {
        .detail__breakdown {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .detail__cash {
        margin: 0;
        padding: 7px 10px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
        background: var(--oa-hover);
        border-left: 3px solid var(--oa-gap-color);
        border-radius: var(--oa-radius-sm);
    }
</style>
