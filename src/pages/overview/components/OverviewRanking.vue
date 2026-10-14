<template>
    <div class="rank">
        <PanelCard title="游戏经营利润排名" subtitle="按本期经营利润排序">
            <el-table :data="byProfit" size="small" max-height="292" show-overflow-tooltip>
                <el-table-column type="index" label="#" width="46" align="center" />
                <el-table-column prop="name" label="游戏" min-width="110" />
                <el-table-column label="经营利润" min-width="104" align="right" sortable :sort-by="'operatingProfit'">
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.operatingProfit)">
                            {{ money(row.operatingProfit) }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="利润率" width="86" align="right">
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.operatingMargin)">
                            {{ row.accrualRevenue > 0 ? percent(row.operatingMargin) : '—' }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="累计预估 ROI" width="116" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ ratio(row.forecastRoi) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="回收完成度" width="106" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.spend > 0 ? percent(row.recoveryRate) : '—' }}</span>
                    </template>
                </el-table-column>
            </el-table>
        </PanelCard>

        <PanelCard title="投手经营利润排名" subtitle="本期经营利润 Top 8，仅含投放岗">
            <el-table :data="byPitcher" size="small" max-height="292" show-overflow-tooltip>
                <el-table-column type="index" label="#" width="46" align="center" />
                <el-table-column prop="name" label="投手" min-width="92" />
                <el-table-column label="所属小组" min-width="92">
                    <template #default="{ row }">{{ groupName(row) }}</template>
                </el-table-column>
                <el-table-column label="经营利润" min-width="104" align="right" sortable :sort-by="'operatingProfit'">
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.operatingProfit)">
                            {{ money(row.operatingProfit) }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="人效比" width="88" align="right">
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.efficiencyRatio)">
                            {{ ratio(row.efficiencyRatio) }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="投放消耗" width="104" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.spend) }}</span>
                    </template>
                </el-table-column>
            </el-table>
        </PanelCard>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import { ORG_MAP } from '@/domain/dimensions';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, percent, ratio, trendClass } from '@/utils/format';
    import type { MetricRow } from '@/domain/types';

    /**
     * 经营排名：游戏与投手两个维度。
     * 指标口径与全站一致（经营利润 / 利润率 / 累计预估 ROI / 回收完成度 / 人效比），
     * 其中「累计预估 ROI」「回收完成度」「人效比」均为累计口径。
     */
    defineOptions({ name: 'OverviewRanking' });

    const { filter } = useAnalysisFilter();

    const byProfit = computed(() =>
        [...store.queryRows(filter, 'game')].sort((a, b) => b.operatingProfit - a.operatingProfit).slice(0, 10),
    );

    const byPitcher = computed(() =>
        store
            .queryRows(filter, 'pitcher')
            .filter((r) => ORG_MAP.get(r.key)?.isPitcher && r.spend > 0)
            .sort((a, b) => b.operatingProfit - a.operatingProfit)
            .slice(0, 8),
    );

    function groupName(row: MetricRow): string {
        return ORG_MAP.get(row.parentId ?? '')?.name ?? '—';
    }
</script>

<style scoped lang="scss">
    .rank {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    @media (max-width: 1400px) {
        .rank {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
