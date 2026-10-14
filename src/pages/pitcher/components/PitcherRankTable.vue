<template>
    <PanelCard
        title="投手排行榜"
        subtitle="默认按经营利润降序 · 前三名为奖牌位 · 表尾为投手团队合计（比率列取合计口径，不逐行相加）"
        plain
    >
        <template v-if="hasPitchers">
            <el-table
                :data="rows"
                size="small"
                height="430"
                class="rank__table"
                show-overflow-tooltip
                show-summary
                :summary-method="summaryMethod"
                :default-sort="{ prop: 'operatingProfit', order: 'descending' }"
            >
                <!-- 排名：前三名用奖牌色标签 -->
                <el-table-column prop="rank" label="排名" width="66" align="center" fixed>
                    <template #default="{ row }">
                        <el-tag
                            v-if="row.rank <= 3"
                            size="small"
                            effect="dark"
                            class="rank__medal"
                            :class="`rank__medal--${row.rank}`"
                        >
                            {{ row.rank }}
                        </el-tag>
                        <span v-else class="oa-num rank__rank">{{ row.rank }}</span>
                    </template>
                </el-table-column>

                <!-- 姓名 + 所属小组 -->
                <el-table-column prop="name" label="姓名" min-width="120" fixed>
                    <template #default="{ row }">
                        <div class="rank__name-wrap">
                            <span class="rank__name">{{ row.name }}</span>
                            <span class="rank__group">{{ row.groupName }}</span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="joinMonth" label="入职月份" width="94" align="center">
                    <template #header>
                        <el-tooltip content="入职月份（YYYY-MM）：人力成本自入职月起按月计提，因此新人的人效比天然偏低" placement="top">
                            <span class="rank__th">入职月份</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.joinMonth }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="spend" label="投放消耗" min-width="104" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.spend) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="accrualRevenue" label="应确认收入" min-width="112" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.accrualRevenue) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="operatingProfit" label="经营利润" min-width="112" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num rank__strong" :class="trendClass(row.operatingProfit)">{{ money(row.operatingProfit) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="operatingMargin" label="经营利润率" min-width="100" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="trendClass(row.operatingMargin)">{{ percentText(row.operatingMargin, row.accrualRevenue) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="forecastRoi" label="累计预估 ROI" min-width="120" align="right" sortable>
                    <template #header>
                        <el-tooltip
                            content="累计口径：累计预估总回收 ÷ 累计投放消耗（自数据起点累计，不是本期 ROI）。1.00 = 回本，低于所属游戏红线则需预警"
                            placement="top"
                        >
                            <span class="rank__th">累计预估 ROI</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span class="oa-num" :class="roiClass(row.forecastRoi, row.spend)">{{ row.spend > 0 ? ratio(row.forecastRoi) : '—' }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="recoveryRate" label="回收完成度" min-width="108" align="right" sortable>
                    <template #header>
                        <el-tooltip content="累计口径：累计已回收 ÷ 累计预估总回收，反映存量用户的回收进度" placement="top">
                            <span class="rank__th">回收完成度</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.recoveryRate > 0 ? percent(row.recoveryRate, 0) : '—' }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="laborCost" label="人力成本" min-width="104" align="right" sortable>
                    <template #header>
                        <el-tooltip content="该投手区间内的人力成本 = 工资 + 医社保 + 个税 + 项目奖金" placement="top">
                            <span class="rank__th">人力成本</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.laborCost) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="efficiencyRatio" label="人效比" min-width="96" align="right" sortable>
                    <template #header>
                        <el-tooltip content="人效比 = 经营利润 ÷ 人力成本。> 1 表示该投手创造的经营利润已覆盖自身人力成本" placement="top">
                            <span class="rank__th">人效比</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span class="oa-num rank__strong" :class="effClass(row.efficiencyRatio)">{{ ratio(row.efficiencyRatio) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="gameCount" label="负责游戏数" min-width="104" align="right" sortable>
                    <template #header>
                        <el-tooltip content="按投放组合配置去重统计（游戏 × 平台的投放安排），反映盘面宽度，不随期间筛选变化" placement="top">
                            <span class="rank__th">负责游戏数</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <el-tooltip :content="row.gameNames.join('、') || '暂无投放游戏'" placement="top">
                            <span class="oa-num">{{ row.gameCount }}</span>
                        </el-tooltip>
                    </template>
                </el-table-column>

                <el-table-column prop="mainPlatformName" label="主投平台" min-width="132">
                    <template #header>
                        <el-tooltip content="按当期投放消耗最大的平台判定；括号内为该平台占该投手消耗的比例" placement="top">
                            <span class="rank__th">主投平台</span>
                        </el-tooltip>
                    </template>
                    <template #default="{ row }">
                        <span v-if="row.mainPlatformName" class="rank__platform">
                            <i class="rank__platform-dot" :style="{ background: row.mainPlatformColor }" />
                            {{ row.mainPlatformName }}
                            <span class="oa-num rank__platform-share">{{ percent(row.mainPlatformShare, 0) }}</span>
                        </span>
                        <span v-else class="oa-muted">无投放</span>
                    </template>
                </el-table-column>
            </el-table>

            <p class="rank__note">
                经营利润 / 经营利润率固定为<b>经营利润口径</b>（应确认收入 − 投放消耗 − 人力成本），不随顶部「利润口径」切换；
                累计预估 ROI / 回收完成度均为<b>自数据起点累计</b>口径（随预估窗口 {{ filter.roiWindow }} 日变化），与本期投放规模不同步。
                负责游戏数按投放组合配置统计，主投平台按当期消耗判定。
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内没有投手，排行榜为空" />
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, h } from 'vue';
    import type { VNode } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { ORG_MAP } from '@/domain/dimensions';
    import type { MetricRow } from '@/domain/types';
    import { money, percent, ratio, trendClass } from '@/utils/format';
    import { gameIdsOf, gameNamesOf, mainPlatformOf, usePitcherData } from './usePitcherData';

    /**
     * 区块 3 · 投手排行榜
     * 绩效与盘面分配的主表：谁赚钱、赚多少、靠什么盘面赚的。
     */
    defineOptions({ name: 'PitcherRankTable' });

    const { filter, pitcherRows, hasPitchers, teamMetrics } = usePitcherData();

    interface RankRow {
        rank: number;
        key: string;
        name: string;
        groupName: string;
        joinMonth: string;
        spend: number;
        accrualRevenue: number;
        operatingProfit: number;
        operatingMargin: number;
        forecastRoi: number;
        recoveryRate: number;
        laborCost: number;
        efficiencyRatio: number;
        gameCount: number;
        gameNames: string[];
        mainPlatformName: string;
        mainPlatformColor: string;
        mainPlatformShare: number;
    }

    /** 排行榜：按经营利润降序（默认排序，与表头 default-sort 一致） */
    const rows = computed<RankRow[]>(() =>
        [...pitcherRows.value].sort((a, b) => b.operatingProfit - a.operatingProfit).map((row: MetricRow, i: number) => {
            const main = mainPlatformOf(row.key);
            return {
                rank: i + 1,
                key: row.key,
                name: row.name,
                groupName: row.parentId ? ORG_MAP.get(row.parentId)?.name ?? '—' : '—',
                joinMonth: ORG_MAP.get(row.key)?.joinMonth ?? '—',
                spend: row.spend,
                accrualRevenue: row.accrualRevenue,
                operatingProfit: row.operatingProfit,
                operatingMargin: row.operatingMargin,
                forecastRoi: row.forecastRoi,
                recoveryRate: row.recoveryRate,
                laborCost: row.laborCost,
                efficiencyRatio: row.efficiencyRatio,
                gameCount: gameIdsOf(row.key).length,
                gameNames: gameNamesOf(row.key),
                mainPlatformName: main?.name ?? '',
                mainPlatformColor: main?.color ?? '#cbd5e1',
                mainPlatformShare: main?.share ?? 0,
            };
        }),
    );

    /** 分母为 0 时不给 0.0%，避免把「没有收入」读成「利润率为 0」 */
    const percentText = (v: number, base: number): string => (base > 0 ? percent(v) : '—');
    /** 人效比着色沿用全页统一分档（表格里用文字色，不用点色） */
    const effClass = (eff: number): string => (eff >= 1 ? 'oa-up' : eff >= 0 ? 'rank__warn' : 'oa-down');
    const roiClass = (roi: number, spend: number): string => (spend <= 0 ? '' : roi >= 1 ? 'oa-up' : 'oa-down');

    // ------------------------------------------------------------------
    // 表尾汇总：绝对额逐行相加；比率类取「合计口径」（逐行相加比率没有意义）
    // ------------------------------------------------------------------
    const teamAgg = computed(() => {
        const list = rows.value;
        const sumOf = (pick: (r: RankRow) => number): number => list.reduce((s, r) => s + pick(r), 0);
        const labor = sumOf((r) => r.laborCost);
        const profit = sumOf((r) => r.operatingProfit);
        const accrual = sumOf((r) => r.accrualRevenue);
        const games = new Set<string>();
        for (const r of list) for (const id of gameIdsOf(r.key)) games.add(id);
        return {
            count: list.length,
            spend: sumOf((r) => r.spend),
            accrual,
            profit,
            labor,
            margin: accrual > 0 ? profit / accrual : 0,
            /** 合计人效比 = 合计利润 ÷ 合计人力（与 store 的聚合口径一致） */
            efficiency: labor > 0 ? profit / labor : 0,
            gameCount: games.size,
            // 累计口径比率只能取团队聚合值：投放部子树口径（筛选把投放部排除时返回 null）
            forecastRoi: teamMetrics.value?.forecastRoi ?? null,
            recoveryRate: teamMetrics.value?.recoveryRate ?? null,
        };
    });

    const summaryMethod = (param: { columns: Array<{ property?: string }>; data: RankRow[] }): Array<string | VNode> => {
        const agg = teamAgg.value;
        const cell = (text: string, cls = ''): VNode => h('span', { class: ['oa-num', cls] }, text);
        const byProp: Record<string, string | VNode> = {
            rank: '合计',
            name: `${agg.count} 位投手`,
            joinMonth: '—',
            spend: cell(money(agg.spend)),
            accrualRevenue: cell(money(agg.accrual)),
            operatingProfit: cell(money(agg.profit), trendClass(agg.profit)),
            operatingMargin: cell(agg.accrual > 0 ? percent(agg.margin) : '—', trendClass(agg.margin)),
            forecastRoi: cell(agg.forecastRoi === null ? '—' : ratio(agg.forecastRoi), agg.forecastRoi === null ? '' : agg.forecastRoi >= 1 ? 'oa-up' : 'oa-down'),
            recoveryRate: cell(agg.recoveryRate === null ? '—' : percent(agg.recoveryRate, 0)),
            laborCost: cell(money(agg.labor)),
            efficiencyRatio: cell(ratio(agg.efficiency), agg.efficiency >= 1 ? 'oa-up' : 'oa-down'),
            gameCount: cell(`去重 ${agg.gameCount}`),
            mainPlatformName: '—',
        };
        return param.columns.map((c) => (c.property ? byProp[c.property] ?? '' : ''));
    };
</script>

<style scoped lang="scss">
    .rank__table {
        width: 100%;
    }

    .rank__th {
        border-bottom: 1px dashed var(--oa-text-4);
        cursor: help;
    }

    .rank__medal {
        min-width: 22px;
        border: none;
        font-weight: 700;

        &--1 {
            background: #f0b429;
            color: #fff;
        }

        &--2 {
            background: #9aa7b8;
            color: #fff;
        }

        &--3 {
            background: #cd7f32;
            color: #fff;
        }
    }

    .rank__rank {
        color: var(--oa-text-3);
    }

    .rank__name-wrap {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
    }

    .rank__name {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .rank__group {
        font-size: 11px;
        color: var(--oa-text-4);
    }

    .rank__strong {
        font-weight: 600;
    }

    .rank__warn {
        color: var(--oa-warning);
    }

    .rank__platform {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--oa-text-2);
    }

    .rank__platform-dot {
        width: 7px;
        height: 7px;
        border-radius: 2px;
        flex: 0 0 auto;
    }

    .rank__platform-share {
        color: var(--oa-text-4);
        font-size: 11px;
    }

    .rank__note {
        margin: 0;
        padding: 8px 14px 10px;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
        border-top: 1px solid var(--oa-border-light);
    }
</style>
