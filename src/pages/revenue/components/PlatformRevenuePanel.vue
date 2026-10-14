<template>
    <PanelCard
        title="分平台收入对比"
        subtitle="堆叠柱为各平台三科目金额（万元）；ROI 为自数据起点累计口径，结算滞后天数来自平台结算规则"
    >
        <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无平台收入数据" />

        <div v-else class="pf">
            <div class="pf__block">
                <p class="pf__cap">各平台三科目收入结构（万元）</p>
                <EChart :option="option" style="height: 256px" />
            </div>

            <div class="pf__block">
                <p class="pf__cap">平台收入明细</p>
                <el-table :data="rows" size="small" :default-sort="{ prop: 'accrualRevenue', order: 'descending' }">
                    <el-table-column label="平台" min-width="140">
                        <template #default="{ row }">
                            <span class="pf__name">
                                <i class="pf__dot" :style="{ background: platformColor(row.key) }" />
                                {{ row.name }}
                            </span>
                        </template>
                    </el-table-column>

                    <el-table-column label="应确认收入" align="right" min-width="118" prop="accrualRevenue" sortable>
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(row.accrualRevenue) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column label="流量主" align="right" min-width="104">
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(subjectAmount(row.revenueByType, 'liuliangzhu')) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column label="广告金" align="right" min-width="104">
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(subjectAmount(row.revenueByType, 'adGold')) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column label="分成" align="right" min-width="104">
                        <template #default="{ row }">
                            <span class="oa-num">{{ money(subjectAmount(row.revenueByType, 'iapShare')) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column label="占公司收入比例" align="right" min-width="126">
                        <template #default="{ row }">
                            <span class="oa-num">{{ percent(safeRatio(row.accrualRevenue, totalRevenue)) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column label="累计预估ROI" align="right" min-width="118">
                        <template #default="{ row }">
                            <span class="oa-num" :class="row.forecastRoi >= 1 ? 'oa-up' : 'oa-down'">
                                {{ ratio(row.forecastRoi) }}
                            </span>
                        </template>
                    </el-table-column>

                    <el-table-column label="结算滞后天数" align="right" min-width="116">
                        <template #default="{ row }">
                            <span class="oa-num" :class="settleLag(row.key) > 45 ? 'oa-down' : ''">
                                {{ settleLag(row.key) }} 天
                            </span>
                        </template>
                    </el-table-column>
                </el-table>

                <p class="pf__note">
                    结算滞后天数决定账面收入到账时间，是账面利润滞后于经营利润的主要原因之一。
                </p>
            </div>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { PLATFORM_MAP } from '@/domain/dimensions';
    import { store } from '@/domain/store';
    import { money, percent, ratio, toWan } from '@/utils/format';
    import {
        REVENUE_SUBJECTS,
        revenueColor,
        safeRatio,
        subjectAmount,
        token,
        wanAxisLabel,
        wanTooltip,
    } from './revenueTheme';

    /** 分平台收入对比：图表看结构，表格看「收入规模 + 到账节奏」 */
    defineOptions({ name: 'PlatformRevenuePanel' });

    const { filter } = useAnalysisFilter();

    /** 只保留在本期范围内真正有业务的平台（无消耗无收入的行是筛选噪声） */
    const rows = computed(() =>
        store
            .queryRows(filter, 'platform')
            .filter((row) => row.accrualRevenue > 0 || row.spend > 0 || row.cashRevenue > 0)
            .sort((a, b) => b.accrualRevenue - a.accrualRevenue),
    );

    const hasData = computed(() => rows.value.length > 0);

    /** 公司收入分母：用平台行合计，保证表格占比自洽（四舍五入后合计仍为 100%） */
    const totalRevenue = computed(() => rows.value.reduce((sum, row) => sum + row.accrualRevenue, 0));

    /** 平台识别色（维度元数据自带，仅表格标记点使用；图表统一用三科目固定色） */
    function platformColor(key: string): string {
        return PLATFORM_MAP.get(key)?.color ?? token('--oa-text-4', '#9ca3af');
    }

    /** 结算滞后天数（来自 PLATFORM_MAP 元数据） */
    function settleLag(key: string): number {
        return PLATFORM_MAP.get(key)?.settleLagDays ?? 0;
    }

    const option = computed<EChartsOption>(() => {
        const list = rows.value;
        return {
            grid: { left: 58, right: 20, top: 40, bottom: 26 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: token('--oa-text-3', '#6b7280'), fontSize: 11 },
            },
            xAxis: {
                type: 'category',
                data: list.map((row) => row.name),
                axisLine: { lineStyle: { color: token('--oa-border', '#e5e9f2') } },
                axisLabel: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                name: '万元',
                nameTextStyle: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11 },
                splitNumber: 5,
                axisLabel: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11, formatter: wanAxisLabel },
                splitLine: { lineStyle: { color: token('--oa-border-light', '#eef1f7') } },
            },
            series: REVENUE_SUBJECTS.map((subject) => ({
                name: subject.name,
                type: 'bar' as const,
                stack: 'platform',
                barMaxWidth: 44,
                itemStyle: { color: revenueColor(subject.key) },
                data: list.map((row) => toWan(subjectAmount(row.revenueByType, subject.key))),
                tooltip: { valueFormatter: wanTooltip },
            })),
        };
    });
</script>

<style scoped lang="scss">
    .pf {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
        min-height: 0;
    }

    .pf__block {
        min-width: 0;
        min-height: 0;
    }

    .pf__cap {
        margin: 0 0 6px;
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .pf__name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .pf__dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .pf__note {
        margin: 8px 0 0;
        padding: 6px 10px;
        border-left: 3px solid var(--oa-warning);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-warning-soft);
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-2);
    }
</style>
