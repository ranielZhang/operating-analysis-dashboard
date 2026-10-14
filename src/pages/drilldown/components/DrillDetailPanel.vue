<template>
    <PanelCard title="节点详情" class="drill-detail">
        <template #actions>
            <span class="detail__axis">{{ axisLabel }}</span>
        </template>

        <div class="detail__scroll oa-scroll">
            <PanelEmptyState v-if="!m" text="当前筛选条件下该节点无数据（可能已被筛选条件排除）" />

            <template v-else>
                <!-- 区块 1 · 节点头部 -->
                <header class="detail__head">
                    <div class="detail__title-row">
                        <span class="detail__name">{{ drillSelection.name }}</span>
                        <el-tag size="small" effect="light" type="info">{{ dimLabel }}</el-tag>
                        <el-tag v-if="orgNode?.isPitcher" size="small" effect="light" type="success">投手</el-tag>
                        <el-tag v-if="gameMeta?.keyGame" size="small" effect="light" type="warning">重点游戏</el-tag>
                    </div>

                    <div v-if="orgNode" class="detail__meta">
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">岗位</i>{{ orgNode.isPitcher ? '投手' : ORG_LEVEL_TEXT[orgNode.level] }}
                        </span>
                        <span v-if="orgNode.owner && !orgNode.isPitcher" class="detail__meta-item">
                            <i class="detail__meta-k">负责人</i>{{ orgNode.owner }}
                        </span>
                        <span v-if="orgNode.isPitcher" class="detail__meta-item">
                            <i class="detail__meta-k">入职月份</i>{{ monthLabel(orgNode.joinMonth) }}
                        </span>
                        <span v-if="groupName" class="detail__meta-item">
                            <i class="detail__meta-k">所属小组</i>{{ groupName }}
                        </span>
                        <span class="detail__meta-item">
                            <i class="detail__meta-k">人头</i>{{ orgNode.headcount }} 人
                        </span>
                    </div>

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
                        hint="权责发生制（含预估回报）"
                    />
                    <MetricCard
                        label="账面利润"
                        :value="m.bookProfit"
                        format="moneyAuto"
                        tone="book"
                        :colored="true"
                        size="sm"
                        hint="银行流水口径"
                    />
                    <MetricCard
                        label="累计预估 ROI"
                        :value="m.forecastRoi"
                        format="ratio"
                        tone="gap"
                        size="sm"
                        :hint="`累计口径 · 实际 ROI ${ratio(m.actualRoi)}`"
                    />
                    <MetricCard
                        label="累计回收完成度"
                        :value="m.recoveryRate"
                        format="percent"
                        tone="revenue"
                        size="sm"
                        hint="累计已回收 / 累计预估总回收"
                    />
                </div>

                <!-- 区块 3 · 月度趋势 -->
                <section class="detail__block">
                    <div class="detail__block-head">
                        <span class="detail__block-title">月度走势</span>
                        <span class="detail__block-sub">近 12 个月 · 收入为左轴、利润为右轴</span>
                    </div>
                    <EChart v-if="series.length" :option="chartOption" style="height: 200px" />
                    <PanelEmptyState v-else text="所选期间内没有可用的月度数据" />
                    <p class="detail__note">仅展示与左侧树同口径的月度走势；节点未被单月筛选命中时该月按 0 计。</p>
                </section>

                <!-- 区块 4 · 结构明细 -->
                <section class="detail__block">
                    <div class="detail__block-head">
                        <span class="detail__block-title">结构明细</span>
                        <span class="detail__block-sub">
                            收入合计 {{ money(revenueTotal) }} · 成本合计 {{ money(costTotal) }}
                        </span>
                    </div>
                    <div class="detail__breakdown">
                        <div class="detail__pie detail__pie--revenue">
                            <div class="detail__pie-head">
                                <span class="detail__pie-title">收入构成</span>
                                <span class="oa-num">{{ money(revenueTotal) }}</span>
                            </div>
                            <EChart v-if="revenueTotal > 0" :option="revenuePie" style="height: 168px" />
                            <PanelEmptyState v-else text="本期无收入" />
                        </div>

                        <div class="detail__pie detail__pie--cost">
                            <div class="detail__pie-head">
                                <span class="detail__pie-title">成本构成</span>
                                <span class="oa-num">{{ money(costTotal) }}</span>
                            </div>
                            <EChart v-if="costTotal > 0" :option="costPie" style="height: 168px" />
                            <PanelEmptyState v-else text="本期无成本" />
                        </div>
                    </div>

                    <!-- 预付（充值额）与投放消耗属不同口径，不能叠加进构成，单独说明 -->
                    <p v-if="prepayAmount > 0" class="detail__pie-note">
                        本期现金流出（充值）<b class="oa-num">{{ money(prepayAmount) }}</b>
                        —— 属银行流水口径，与投放消耗不可叠加，故不计入成本构成。
                    </p>
                </section>

                <!-- 区块 5 · 现金口径 -->
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
    import { DIM_LABEL, useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, monthLabel, percent, ratio, toWan, trendClass } from '@/utils/format';
    import { drillSelection } from '../useDrillSelection';

    /** 逐层下钻 · 右侧节点详情侧栏：节点头部 / 核心小卡 / 月度走势 / 结构明细 / 现金口径 */
    defineOptions({ name: 'DrillDetailPanel' });

    const { filter } = useAnalysisFilter();

    /** 单节点指标；节点被筛选条件排除时为 null */
    const m = computed(() => store.metricsOf(filter, drillSelection.dim, drillSelection.key));

    const dimLabel = computed(() => DIM_LABEL[drillSelection.dim] ?? drillSelection.dim);

    const axisLabel = computed(() => {
        const d = drillSelection.dim;
        if (d === 'platform' || d === 'project' || d === 'game') return '业务轴';
        if (d === 'month') return '时间轴';
        return '组织轴';
    });

    // ---------- 区块 1 · 节点头部元数据 ----------
    /** 组织层级中文名（非投手节点展示"岗位"用） */
    const ORG_LEVEL_TEXT: Record<string, string> = {
        company: '公司',
        center: '中心',
        department: '部门',
        group: '小组',
        pitcher: '投手',
    };

    const orgNode = computed(() => ORG_MAP.get(drillSelection.key) ?? null);

    /** 投手所属小组名 = 父节点 name */
    const groupName = computed(() => {
        const n = orgNode.value;
        if (!n || !n.isPitcher || !n.parentId) return '';
        return ORG_MAP.get(n.parentId)?.name ?? '';
    });

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

    const costTotal = computed(() => m.value?.totalCost ?? 0);

    const revenueDefs = computed<BreakdownDef[]>(() => {
        const r = m.value?.revenueByType;
        return [
            { name: '流量主', value: r?.liuliangzhu ?? 0, color: 'var(--oa-rev-liuliangzhu)' },
            { name: '广告金', value: r?.adGold ?? 0, color: 'var(--oa-rev-adgold)' },
            { name: '分成', value: r?.iapShare ?? 0, color: 'var(--oa-rev-share)' },
        ];
    });

    const costDefs = computed<BreakdownDef[]>(() => {
        const c = m.value?.costByType;
        return [
            { name: '投放', value: c?.adSpend ?? 0, color: 'var(--oa-cost-ad)' },
            { name: '预付', value: c?.prepay ?? 0, color: 'var(--oa-cost-prepay)' },
            { name: '工资', value: c?.salary ?? 0, color: 'var(--oa-cost-labor)' },
            { name: '医社保', value: c?.socialInsurance ?? 0, color: 'var(--oa-cost-labor)' },
            { name: '个税', value: c?.individualTax ?? 0, color: 'var(--oa-cost-labor)' },
            { name: '项目奖金', value: c?.projectBonus ?? 0, color: 'var(--oa-cost-labor)' },
            { name: '福利费', value: c?.welfare ?? 0, color: 'var(--oa-cost-admin)' },
            { name: '办公费', value: c?.office ?? 0, color: 'var(--oa-cost-admin)' },
        ];
    });

    function decorate(defs: BreakdownDef[], total: number) {
        return defs.map((d) => {
            const share = total > 0 ? d.value / total : 0;
            return {
                ...d,
                share,
                percentage: Math.min(100, Math.max(0, Math.round(share * 100))),
            };
        });
    }

    const revenueRows = computed(() => decorate(revenueDefs.value, revenueTotal.value));
    const costRows = computed(() => decorate(costDefs.value, costTotal.value));

    /** 本期充值额（现金口径），仅作说明，不进饼图 */
    const prepayAmount = computed(() => m.value?.costByType.prepay ?? 0);

    /**
     * 成本构成饼图的数据。
     * 刻意**剔除「预付」**：它代表本期现金流出（充值额），与「投放」是同一笔业务成本的两种口径，
     * 两者相加会超过总成本（实测 79.7% + 93.3% > 100%），因此只保留可加总的 7 个科目。
     */
    const costPieDefs = computed(() => costDefs.value.filter((d) => d.name !== '预付'));

    interface PieSlice {
        name: string;
        value: number;
    }

    /** 生成环形饼图 option：左侧圆环 + 右侧竖排图例（带金额与占比） */
    function buildPie(
        defs: BreakdownDef[],
        total: number,
        centerLabel: string,
        palette: string[],
        allRows: Array<BreakdownDef & { share: number }>,
    ): EChartsOption {
        const data: PieSlice[] = defs.filter((d) => d.value > 0).map((d) => ({ name: d.name, value: d.value }));
        const byName = new Map(allRows.map((r) => [r.name, r]));
        return {
            color: palette,
            tooltip: {
                trigger: 'item',
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `${p.name}<br/>${money(p.value)} · ${p.percent.toFixed(1)}%`,
            },
            legend: {
                orient: 'vertical',
                right: 0,
                top: 'middle',
                itemWidth: 8,
                itemHeight: 8,
                itemGap: 6,
                textStyle: { fontSize: 11, color: '#4b5563' },
                formatter: (name: string) => {
                    const row = byName.get(name);
                    if (!row) return name;
                    return `${name}  ${money(row.value)}  ${percent(row.share)}`;
                },
            },
            title: {
                text: money(total),
                subtext: centerLabel,
                left: '27%',
                top: '42%',
                textAlign: 'center',
                textStyle: { fontSize: 13, fontWeight: 700, color: '#1f2937' },
                subtextStyle: { fontSize: 10, color: '#9ca3af' },
            },
            series: [
                {
                    type: 'pie',
                    radius: ['46%', '70%'],
                    center: ['27%', '50%'],
                    avoidLabelOverlap: true,
                    label: { show: false },
                    labelLine: { show: false },
                    itemStyle: { borderColor: '#fff', borderWidth: 1 },
                    data,
                },
            ],
        } as EChartsOption;
    }

    const revenuePie = computed<EChartsOption>(() =>
        buildPie(revenueDefs.value, revenueTotal.value, '收入合计', ['#8b5cf6', '#f472b6', '#06b6d4'], revenueRows.value),
    );

    const costPie = computed<EChartsOption>(() =>
        buildPie(
            costPieDefs.value,
            costTotal.value,
            '成本合计',
            // 投放（红）→ 人工四科目（蓝由深到浅）→ 管理两科目（青由深到浅）
            ['#fd6464', '#4d94fa', '#7aaffb', '#a5c9fd', '#c9ddfe', '#06b6d4', '#5fd4e6'],
            costRows.value,
        ),
    );

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

    .detail__axis {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
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

    .detail__title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail__name {
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        color: var(--oa-text-1);
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

    .detail__block-sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        text-align: right;
    }

    .detail__note {
        margin: 0;
        font-size: 11px;
        line-height: 1.5;
        color: var(--oa-text-4);
    }

    /* 区块 4 */
    /* 收入 / 成本两张饼图左右分开 */
    .detail__breakdown {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--oa-gap-lg);
    }

    /* 两张饼图各自成一张子卡片：独立描边 + 顶部身份色条，
       避免并排时左侧图例被误读成右侧饼图的图例 */
    .detail__pie {
        min-width: 0;
        padding: 8px 10px 6px;
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius-sm);
        background: #fbfcfe;
    }

    .detail__pie--revenue {
        border-top: 2px solid var(--oa-revenue);
    }

    .detail__pie--cost {
        border-top: 2px solid var(--oa-cost);
    }

    .detail__pie--revenue .detail__pie-title::before {
        background: var(--oa-revenue);
    }

    .detail__pie--cost .detail__pie-title::before {
        background: var(--oa-cost);
    }

    @media (max-width: 1700px) {
        .detail__cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 1200px) {
        .detail__breakdown {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .detail__pie-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 2px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        span:last-child {
            font-weight: 600;
            color: var(--oa-text-1);
        }
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
            height: 11px;
            border-radius: 2px;
            background: var(--oa-text-4);
        }
    }

    .detail__pie-note {
        margin: 8px 0 0;
        font-size: 11px;
        line-height: 1.6;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-3);
        }
    }

    .detail__list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .detail__list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding-bottom: 3px;
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        color: var(--oa-text-2);
        border-bottom: 1px solid var(--oa-border-light);
    }

    .detail__row {
        display: grid;
        grid-template-columns: 6px minmax(46px, auto) minmax(52px, auto) minmax(28px, 1fr) 44px;
        align-items: center;
        gap: 6px;
        font-size: var(--oa-fs-xs);
    }

    .detail__row-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .detail__row-name {
        color: var(--oa-text-3);
        white-space: nowrap;
    }

    .detail__row-val {
        color: var(--oa-text-1);
        text-align: right;
        white-space: nowrap;
    }

    .detail__row-bar {
        display: block;
        min-width: 0;

        :deep(.el-progress) {
            line-height: 1;
        }

        :deep(.el-progress-bar__outer) {
            background: var(--oa-border-light);
        }
    }

    .detail__row-pct {
        color: var(--oa-text-4);
        text-align: right;
        white-space: nowrap;
    }

    /* 区块 5 */
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
