<template>
    <PanelCard title="人工成本专题" :subtitle="subtitle">
        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无人工成本数据" />

        <!-- 筛选范围小于中心层级（如只选了一个小组/投手）时，分中心对比不适用，直接给出口径提示 -->
        <PanelEmptyState
            v-else-if="noCenterScope"
            text="当前筛选范围小于中心层级（例如只选择了某个小组或投手），分中心人工成本对比不适用，请放宽组织筛选范围"
        />

        <template v-else>
            <!-- 分中心人工成本 + 人数（双轴分组柱） -->
            <EChart :option="option" style="height: 300px" />

            <el-table
                :data="tableRows"
                size="small"
                show-overflow-tooltip
                :default-sort="{ prop: 'labor', order: 'descending' }"
                class="labor__table"
            >
                <el-table-column prop="name" label="中心" min-width="120" fixed>
                    <template #default="{ row }">
                        <span class="labor__center">
                            {{ row.name }}
                            <em class="labor__type" :class="row.isCostCenter ? 'labor__type--cost' : 'labor__type--profit'">
                                {{ row.isCostCenter ? '成本中心' : '利润中心' }}
                            </em>
                        </span>
                    </template>
                </el-table-column>

                <el-table-column prop="headcount" label="人数" align="right" min-width="76" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ comma(row.headcount) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="salaryBase" label="薪资基准/月" align="right" min-width="104" sortable>
                    <template #default="{ row }">
                        <span class="oa-num labor__muted">{{ money(row.salaryBase) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="labor" label="人工成本" align="right" min-width="110" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.labor) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="perCapita" label="人均人工成本" align="right" min-width="118" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.perCapita) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="laborShare" label="占公司人工成本" align="right" min-width="120" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(row.laborShare) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="profit" label="经营利润" align="right" min-width="112" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.profit)">{{ money(row.profit) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="efficiency" label="人效比" align="right" min-width="92" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.efficiency)">{{ ratio(row.efficiency) }}</span>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 本页最重要的业务结论 -->
            <p class="labor__conclusion">
                研发中心 / 中台 / 职能中心为成本中心，无投放消耗与收入，其人工成本需要通过发行中心的经营利润覆盖。
            </p>

            <p class="labor__note">
                当前成本中心（{{ costCenterNames }}）人工成本合计 <b class="oa-num">{{ money(costCenterLabor) }}</b>，占公司人工成本
                <b class="oa-num">{{ percent(costCenterShare) }}</b>；利润中心（{{ profitCenterNames }}）经营利润合计
                <b class="oa-num">{{ money(profitCenterProfit) }}</b>，覆盖倍数
                <b class="oa-num" :class="coverage >= 1 ? 'oa-up' : 'oa-down'">{{ ratio(coverage) }}</b>
                —— {{ coverage >= 1 ? '可覆盖成本中心人工成本' : `尚不能覆盖，缺口 ${money(costCenterLabor - profitCenterProfit)}` }}。
            </p>

            <p class="labor__note">
                人工成本构成：工资 <b class="oa-num">{{ money(cb.salary) }}</b>（{{ percent(shareOf(cb.salary, m.laborCost)) }}）
                + 医社保（公司承担 <b>{{ percent(SOCIAL_INSURANCE_RATE) }}</b>）<b class="oa-num">{{ money(cb.socialInsurance) }}</b>
                （{{ percent(shareOf(cb.socialInsurance, m.laborCost)) }}）
                + 个税（按工资 <b>{{ percent(TAX_RATE) }}</b> 代扣代缴）<b class="oa-num">{{ money(cb.individualTax) }}</b>
                （{{ percent(shareOf(cb.individualTax, m.laborCost)) }}）
                + 项目奖金（季度末月发放，可按项目直接归集）<b class="oa-num">{{ money(cb.projectBonus) }}</b>
                （{{ percent(shareOf(cb.projectBonus, m.laborCost)) }}）。
            </p>

            <p class="labor__note labor__note--muted">
                口径：人数为期末时点值，人工成本为期间累计值，因此「人均人工成本 = 期间人工成本 ÷ 期末人数」是<b>期间人均</b>，不等于月薪；
                「薪资基准/月」取自 <code>CENTER_SALARY</code> 配置，实际工资还会叠加个人职级系数与年度调薪。
                人效比 = 经营利润 ÷ 人工成本（&lt; 1 表示人工成本尚未被自身经营利润覆盖）。
                <template v-if="hiddenCenterCount > 0">
                    当前组织筛选下另有 {{ hiddenCenterCount }} 个中心不在范围内，未列入本表。
                </template>
            </p>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { CENTERS, CENTER_SALARY, SOCIAL_INSURANCE_RATE, TAX_RATE } from '@/domain/dimensions';
    import { store } from '@/domain/store';
    import type { Metrics } from '@/domain/types';
    import { comma, money, percent, ratio, trendClass } from '@/utils/format';
    import { EMPTY_METRICS, isEmptyMetrics, share, tokenValue } from './costModel';

    /**
     * 区块 4 · 人工成本专题
     * 遍历 CENTERS 取各中心人工成本 / 人数 → 分组柱（人数走第二轴）+ 明细表 + 成本中心覆盖结论。
     */
    defineOptions({ name: 'LaborCostPanel' });

    const { filter } = useAnalysisFilter();

    /** 各中心指标（受组织筛选影响：不在范围内的中心 metricsOf 返回 null） */
    const centerRows = computed(() =>
        CENTERS.map((c) => ({ center: c, m: store.metricsOf(filter, 'center', c.id) })).filter(
            (r): r is { center: (typeof CENTERS)[number]; m: Metrics } => r.m !== null,
        ),
    );

    const company = computed<Metrics | null>(() => store.metricsOf(filter, 'company', 'company'));
    const m = computed<Metrics>(() => company.value ?? EMPTY_METRICS);
    const cb = computed(() => m.value.costByType);

    /** 公司人工成本（期间累计，受组织筛选影响） */
    const totalLabor = computed(() => m.value.laborCost);

    const isEmpty = computed(() => !company.value || isEmptyMetrics(company.value) || totalLabor.value === 0);

    /** 组织筛选把范围收窄到中心以下时，任何中心都不在范围内，分中心对比失去意义 */
    const noCenterScope = computed(() => centerRows.value.length === 0);

    const tableRows = computed(() =>
        centerRows.value.map((r) => {
            const headcount = r.m.headcount;
            const perCapita = headcount > 0 ? r.m.laborCost / headcount : 0;
            return {
                key: r.center.id,
                name: r.center.name,
                headcount,
                salaryBase: CENTER_SALARY[r.center.id] ?? 0,
                labor: r.m.laborCost,
                perCapita,
                laborShare: share(r.m.laborCost, totalLabor.value),
                profit: r.m.operatingProfit,
                efficiency: r.m.efficiencyRatio,
                /** 成本中心 = 无投放消耗且无收入（不产生直接收入，靠发行中心利润覆盖） */
                isCostCenter: r.m.spend === 0 && r.m.accrualRevenue === 0,
            };
        }),
    );

    const hiddenCenterCount = computed(() => CENTERS.length - centerRows.value.length);

    const subtitle = computed(
        () => `${centerRows.value.length} 个中心 · 公司人工成本 ${money(totalLabor.value)} · 期末人数 ${comma(m.value.headcount)} 人`,
    );

    const costCenterRows = computed(() => tableRows.value.filter((r) => r.isCostCenter));
    const profitCenterRows = computed(() => tableRows.value.filter((r) => !r.isCostCenter));
    const costCenterLabor = computed(() => costCenterRows.value.reduce((s, r) => s + r.labor, 0));
    const profitCenterProfit = computed(() => profitCenterRows.value.reduce((s, r) => s + r.profit, 0));
    const costCenterShare = computed(() => share(costCenterLabor.value, totalLabor.value));
    /** 覆盖倍数 = 利润中心经营利润 ÷ 成本中心人工成本 */
    const coverage = computed(() => (costCenterLabor.value > 0 ? profitCenterProfit.value / costCenterLabor.value : 0));
    const costCenterNames = computed(() => costCenterRows.value.map((r) => r.name).join(' / ') || '无');
    const profitCenterNames = computed(() => profitCenterRows.value.map((r) => r.name).join(' / ') || '无');

    const shareOf = (v: number, total: number): number => share(v, total);

    const option = computed<EChartsOption>(() => {
        const laborColor = tokenValue('--oa-cost-labor', '#4d94fa');
        const headColor = tokenValue('--oa-cost-admin', '#06b6d4');
        const labels = tableRows.value.map((r) => r.name);

        return {
            grid: { left: 60, right: 56, top: 42, bottom: 28 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                confine: true,
                formatter: (params: unknown) => {
                    const list = params as Array<{ seriesName?: string; value?: number | null; marker?: string; axisValueLabel?: string }>;
                    if (!list.length) return '';
                    const rows = list.map((it) => {
                        const v = it.value ?? 0;
                        const text = it.seriesName === '人数' ? `${comma(v)} 人` : money(v);
                        return `${it.marker ?? ''}${it.seriesName}：<b>${text}</b>`;
                    });
                    return `<div style="font-size:12px;line-height:19px">${list[0].axisValueLabel ?? ''}<br/>${rows.join('<br/>')}</div>`;
                },
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
                data: ['人工成本', '人数'],
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11, hideOverlap: true },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '人工成本',
                    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: {
                        color: '#94a3b8',
                        fontSize: 11,
                        formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
                    },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                {
                    type: 'value',
                    name: '人数',
                    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v}人` },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: '人工成本',
                    type: 'bar',
                    barMaxWidth: 22,
                    itemStyle: { color: laborColor },
                    data: tableRows.value.map((r) => r.labor),
                },
                {
                    name: '人数',
                    type: 'bar',
                    yAxisIndex: 1,
                    barMaxWidth: 22,
                    itemStyle: { color: headColor },
                    data: tableRows.value.map((r) => r.headcount),
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .labor__table {
        margin-top: 10px;
    }

    .labor__center {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .labor__type {
        padding: 0 5px;
        border-radius: 8px;
        font-size: 11px;
        font-style: normal;
        line-height: 16px;
    }

    .labor__type--cost {
        background: var(--oa-warning-soft);
        color: #c96a1c;
    }

    .labor__type--profit {
        background: var(--oa-success-soft);
        color: #0e9455;
    }

    .labor__muted {
        color: var(--oa-text-3);
    }

    .labor__conclusion {
        margin: 12px 0 0;
        padding: 8px 12px;
        border-left: 3px solid var(--oa-warning);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-warning-soft);
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        line-height: 1.7;
        color: var(--oa-text-1);
    }

    .labor__note {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-hover);
            border: 1px solid var(--oa-border);
            color: var(--oa-primary-deep);
        }
    }

    .labor__note--muted {
        color: var(--oa-text-4);
    }
</style>
