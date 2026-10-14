<template>
    <PanelCard
        title="分游戏收入 Top / Bottom"
        subtitle="横向堆叠条按三科目拆色，一眼可见变现结构；ROI / 回收完成度为自数据起点累计口径"
    >
        <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无游戏收入数据" />

        <div v-else class="gm">
            <div class="gm__charts">
                <div class="gm__chart">
                    <p class="gm__cap">应确认收入前 8 名（万元）</p>
                    <EChart :option="topOption" style="height: 300px" />
                </div>

                <div v-if="bottomRows.length" class="gm__chart">
                    <p class="gm__cap">应确认收入后 5 名，由低到高（万元）</p>
                    <EChart :option="bottomOption" style="height: 300px" />
                </div>
            </div>

            <p class="gm__legend">
                变现类型：<el-tag size="small" type="warning" effect="light">IAA 广告</el-tag> 收入几乎全部来自流量主 + 广告金（条上只有紫 + 粉）；
                <el-tag size="small" type="primary" effect="light">IAP 内购</el-tag> 以分成收入为主（青色段占比高）；
                <el-tag size="small" type="info" effect="light">混合变现</el-tag> 两者兼有。
                回收完成度 = 累计已确认收入 ÷ 累计预估总回收，≥85% 视为回收基本完成。
            </p>

            <el-table
                :data="rows"
                size="small"
                max-height="340"
                :default-sort="{ prop: 'accrualRevenue', order: 'descending' }"
            >
                <el-table-column label="游戏" min-width="128" show-overflow-tooltip fixed>
                    <template #default="{ row }">
                        <span class="gm__game">{{ row.name }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="所属项目" min-width="118" show-overflow-tooltip>
                    <template #default="{ row }">
                        <span class="oa-muted">{{ projectName(row.key) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="变现类型" min-width="108">
                    <template #default="{ row }">
                        <el-tooltip :content="monetizeTip(row.key)" placement="top">
                            <el-tag size="small" effect="light" :type="monetizeMeta(row.key).type">
                                {{ monetizeMeta(row.key).label }}
                            </el-tag>
                        </el-tooltip>
                    </template>
                </el-table-column>

                <el-table-column label="应确认收入" align="right" min-width="118" prop="accrualRevenue" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.accrualRevenue) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="流量主占比" align="right" min-width="110">
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(shareOf(row, 'liuliangzhu')) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="分成占比" align="right" min-width="102">
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(shareOf(row, 'iapShare')) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="累计预估ROI" align="right" min-width="118">
                    <template #default="{ row }">
                        <span class="oa-num" :class="row.forecastRoi >= 1 ? 'oa-up' : 'oa-down'">
                            {{ ratio(row.forecastRoi) }}
                        </span>
                    </template>
                </el-table-column>

                <el-table-column min-width="152">
                    <template #header>
                        <el-tooltip content="累计口径：累计已确认收入 ÷ 累计预估总回收（自数据起点累计，不是本期口径）" placement="top">
                            <span>回收完成度</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <div class="gm__recovery">
                            <el-progress
                                class="gm__bar"
                                :percentage="recoveryPercent(row)"
                                :color="recoveryColor(row.recoveryRate)"
                                :stroke-width="6"
                                :show-text="false"
                            />
                            <span class="oa-num gm__pct">{{ percent(row.recoveryRate) }}</span>
                        </div>
                    </template>
                </el-table-column>
            </el-table>
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
    import { GAME_MAP, PROJECT_MAP } from '@/domain/dimensions';
    import { store } from '@/domain/store';
    import type { MetricRow } from '@/domain/types';
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

    /** 分游戏收入 Top / Bottom：回答「钱是哪些游戏挣的、挣得干不干净」 */
    defineOptions({ name: 'GameRevenuePanel' });

    const { filter } = useAnalysisFilter();

    const TOP_N = 8;
    const BOTTOM_N = 5;

    /** 只保留本期有收入的游戏，按应确认收入降序 */
    const rows = computed(() =>
        store
            .queryRows(filter, 'game')
            .filter((row) => row.accrualRevenue > 0)
            .sort((a, b) => b.accrualRevenue - a.accrualRevenue),
    );

    const hasData = computed(() => rows.value.length > 0);

    const topRows = computed(() => rows.value.slice(0, TOP_N));

    /** 后 N 名：反转为「由低到高」，配合 inverse 轴让最差的一条排在顶部 */
    const bottomRows = computed(() =>
        rows.value.length > TOP_N ? rows.value.slice(-BOTTOM_N).reverse() : [],
    );

    const MONETIZE_META: Record<string, { label: string; type: 'warning' | 'primary' | 'info'; short: string }> = {
        iaa: { label: 'IAA 广告', type: 'warning', short: 'IAA' },
        iap: { label: 'IAP 内购', type: 'primary', short: 'IAP' },
        mix: { label: '混合变现', type: 'info', short: '混合' },
    };

    /** 变现类型标签（来自 GAME_MAP 元数据，非派生指标） */
    function monetizeMeta(gameId: string) {
        const monetize = GAME_MAP.get(gameId)?.monetize ?? 'mix';
        return MONETIZE_META[monetize] ?? MONETIZE_META.mix;
    }

    /** 变现类型说明（含元数据里的预估 IAA 占比，避免只给结论不给依据） */
    function monetizeTip(gameId: string): string {
        const meta = GAME_MAP.get(gameId);
        if (!meta) return '变现类型未知';
        return `${monetizeMeta(gameId).label}：预估总回收中 IAA（流量主 + 广告金）占 ${percent(meta.iaaShare)}，投放阶段为${meta.stage}`;
    }

    function projectName(gameId: string): string {
        const projectId = GAME_MAP.get(gameId)?.projectId;
        return projectId ? PROJECT_MAP.get(projectId)?.name ?? projectId : '—';
    }

    /** 单科目占该游戏应确认收入的比例 */
    function shareOf(row: MetricRow, key: 'liuliangzhu' | 'adGold' | 'iapShare'): number {
        return safeRatio(subjectAmount(row.revenueByType, key), row.accrualRevenue);
    }

    function recoveryPercent(row: MetricRow): number {
        return Math.min(100, Math.max(0, Number((row.recoveryRate * 100).toFixed(1))));
    }

    /** 回收完成度色阶：≥85% 基本回收完成；60%~85% 正常推进；<60% 仍大量未回收 */
    function recoveryColor(rate: number): string {
        if (rate >= 0.85) return token('--oa-success', '#12b566');
        if (rate >= 0.6) return token('--oa-primary', '#4d94fa');
        return token('--oa-warning', '#ff9140');
    }

    /** 横向堆叠条：条长 = 应确认收入，分段 = 三科目（IAA 游戏只有紫 + 粉） */
    function barOption(list: MetricRow[]): EChartsOption {
        return {
            grid: { left: 108, right: 46, top: 34, bottom: 24 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: token('--oa-text-3', '#6b7280'), fontSize: 11 },
            },
            xAxis: {
                type: 'value',
                name: '万元',
                nameTextStyle: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11 },
                splitNumber: 4,
                axisLabel: { color: token('--oa-text-4', '#9ca3af'), fontSize: 11, formatter: wanAxisLabel },
                splitLine: { lineStyle: { color: token('--oa-border-light', '#eef1f7') } },
            },
            yAxis: {
                type: 'category',
                inverse: true,
                data: list.map((row) => `${row.name}（${monetizeMeta(row.key).short}）`),
                axisLine: { lineStyle: { color: token('--oa-border', '#e5e9f2') } },
                axisLabel: { color: token('--oa-text-2', '#4b5563'), fontSize: 11 },
                axisTick: { show: false },
            },
            series: REVENUE_SUBJECTS.map((subject) => ({
                name: subject.name,
                type: 'bar' as const,
                stack: 'game',
                barMaxWidth: 16,
                itemStyle: { color: revenueColor(subject.key) },
                data: list.map((row) => toWan(subjectAmount(row.revenueByType, subject.key))),
                tooltip: { valueFormatter: wanTooltip },
            })),
        };
    }

    const topOption = computed<EChartsOption>(() => barOption(topRows.value));
    const bottomOption = computed<EChartsOption>(() => barOption(bottomRows.value));
</script>

<style scoped lang="scss">
    .gm {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        min-height: 0;
    }

    .gm__charts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: var(--oa-gap);
        min-width: 0;
    }

    .gm__chart {
        min-width: 0;
    }

    .gm__cap {
        margin: 0 0 4px;
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .gm__legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 2;
        color: var(--oa-text-4);
    }

    .gm__game {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .gm__recovery {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .gm__bar {
        flex: 1 1 auto;
        min-width: 0;
    }

    .gm__pct {
        flex: 0 0 auto;
        width: 46px;
        text-align: right;
    }

    @media (max-width: 1400px) {
        .gm__charts {
            grid-template-columns: 1fr;
        }
    }
</style>
