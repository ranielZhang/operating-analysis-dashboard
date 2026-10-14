<template>
    <PanelCard title="分组织 / 分业务成本对比" :subtitle="subtitle">
        <el-tabs v-model="activeTab" class="cmp__tabs">
            <el-tab-pane label="按小组" name="group" />
            <el-tab-pane label="按游戏" name="game" />
        </el-tabs>

        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无成本数据" />

        <template v-else>
            <EChart :option="option" style="height: 300px" />

            <el-table
                :data="tableRows"
                size="small"
                show-overflow-tooltip
                :default-sort="{ prop: 'struct', order: 'descending' }"
                class="cmp__table"
            >
                <el-table-column prop="name" :label="nameLabel" min-width="120" fixed />

                <el-table-column prop="headcount" label="人数" align="right" min-width="72" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ comma(row.headcount) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="adSpend" label="投放消耗" align="right" min-width="108" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.adSpend) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="prepay" label="预付成本" align="right" min-width="104" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.prepay) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="labor" label="人工成本" align="right" min-width="104" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.labor) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="admin" label="管理费用" align="right" min-width="100" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.admin) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="struct" label="结构合计" align="right" min-width="112" sortable>
                    <template #default="{ row }">
                        <span class="oa-num cmp__strong">{{ money(row.struct) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="profit" label="经营利润" align="right" min-width="112" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.profit)">{{ money(row.profit) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="costProfitRate" label="成本利润率" align="right" min-width="108" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.costProfitRate)">{{ percent(row.costProfitRate) }}</span>
                    </template>
                </el-table-column>
            </el-table>

            <p class="cmp__note">
                {{ activeTab === 'group' ? '按小组：' : '按游戏：' }}
                结构合计 = 投放消耗 + 预付成本 + 人工成本 + 管理费用（真实发生额口径，与顶部指标卡「总成本」的差别见页面顶部口径说明）；
                成本利润率 = <b>经营利润 ÷ 结构合计</b>，为负说明该
                {{ activeTab === 'group' ? '小组' : '游戏' }}的总成本超过其贡献的经营利润。
                <template v-if="activeTab === 'group'">
                    小组为组织轴<b>直接归集</b>口径：投放消耗 / 充值额按投手归集、人工成本按人头归属，管理费用由中心按人头下沉后汇总，
                    因此小组 — 部门 — 中心 — 公司各层级合计都能勾稽到公司合计；研发 / 中台 / 职能小组成本利润率为 −100% 附近，
                    是因为它们只有成本、没有投放消耗与收入。
                </template>
                <template v-else>
                    按游戏视角时，人工成本与管理费用是按各游戏<b>投放消耗占比分摊</b>的成本池（业务轴口径），不是可直接归集的费用。
                </template>
            </p>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import { comma, money, percent, trendClass } from '@/utils/format';
    import { groupColor, leafColor, structTotal, tokenValue } from './costModel';

    /**
     * 区块 5 · 分组织 / 分业务成本对比（el-tabs）
     * 按小组 = 组织轴直接归集成本；按游戏 = 业务轴成本池按消耗占比分摊。
     */
    defineOptions({ name: 'OrgBizCostCompare' });

    const { filter } = useAnalysisFilter();

    const activeTab = ref<'group' | 'game'>('group');

    /** 只计算当前 tab，避免同时跑两套 queryRows（含环比/同比） */
    const rows = computed(() => store.queryRows(filter, activeTab.value));

    const tableRows = computed(() =>
        rows.value.map((r) => {
            const struct = structTotal(r.costByType);
            return {
                key: r.key,
                name: r.name,
                headcount: r.headcount,
                adSpend: r.costByType.adSpend,
                prepay: r.costByType.prepay,
                labor: r.laborCost,
                admin: r.adminCost,
                struct,
                profit: r.operatingProfit,
                revenue: r.accrualRevenue,
                costProfitRate: struct > 0 ? r.operatingProfit / struct : 0,
            };
        }),
    );

    const isEmpty = computed(
        () => tableRows.value.length === 0 || tableRows.value.every((r) => r.struct === 0 && r.revenue === 0),
    );

    const nameLabel = computed(() => (activeTab.value === 'group' ? '小组' : '游戏'));

    const subtitle = computed(() => {
        const list = tableRows.value;
        const total = list.reduce((s, r) => s + r.struct, 0);
        const loss = list.filter((r) => r.costProfitRate < 0 && r.struct > 0).length;
        return `${list.length} 个${nameLabel.value} · 结构合计 ${money(total)} · 成本利润率<0 的 ${loss} 个`;
    });

    const option = computed<EChartsOption>(() => {
        const labels = tableRows.value.map((r) => r.name);
        type Row = (typeof tableRows.value)[number];
        const seriesDef: Array<{ name: string; color: string; pick: (r: Row) => number }> = [
            { name: '投放消耗', color: groupColor('business'), pick: (r) => r.adSpend },
            { name: '预付成本', color: leafColor('prepay'), pick: (r) => r.prepay },
            { name: '人工成本', color: groupColor('labor'), pick: (r) => r.labor },
            { name: '管理费用', color: groupColor('admin'), pick: (r) => r.admin },
        ];
        const warning = tokenValue('--oa-warning', '#ff9140');

        const bars = seriesDef.map((s) => ({
            name: s.name,
            type: 'bar' as const,
            stack: 'cost',
            barMaxWidth: 24,
            itemStyle: { color: s.color },
            emphasis: { focus: 'series' as const },
            data: tableRows.value.map((r) => s.pick(r)),
        }));

        const line = {
            name: '成本利润率',
            type: 'line' as const,
            yAxisIndex: 1,
            smooth: false,
            symbolSize: 5,
            lineStyle: { width: 2, color: warning },
            itemStyle: { color: warning },
            data: tableRows.value.map((r) => (r.struct > 0 ? r.costProfitRate : null)),
        };

        return {
            grid: { left: 60, right: 56, top: 42, bottom: 64 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                confine: true,
                formatter: (params: unknown) => {
                    const list = params as Array<{ seriesName?: string; value?: number | null; marker?: string; axisValueLabel?: string }>;
                    if (!list.length) return '';
                    const rows2 = list.map((it) => {
                        const v = it.value;
                        const text = v === null || v === undefined ? '—' : it.seriesName === '成本利润率' ? percent(v) : money(v);
                        return `${it.marker ?? ''}${it.seriesName}：<b>${text}</b>`;
                    });
                    return `<div style="font-size:12px;line-height:19px">${list[0].axisValueLabel ?? ''}<br/>${rows2.join('<br/>')}</div>`;
                },
            },
            legend: {
                type: 'scroll',
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11, rotate: 32, hideOverlap: true },
                axisTick: { show: false },
            },
            yAxis: [
                {
                    type: 'value',
                    name: '成本',
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
                    name: '成本利润率',
                    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                    splitNumber: 5,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => percent(v, 0) },
                    splitLine: { show: false },
                },
            ],
            series: [...bars, line],
        };
    });
</script>

<style scoped lang="scss">
    .cmp__tabs {
        margin-bottom: 4px;
    }

    .cmp__table {
        margin-top: 10px;
    }

    .cmp__strong {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .cmp__note {
        margin: 8px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
        }
    }
</style>
