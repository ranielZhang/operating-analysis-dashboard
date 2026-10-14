<template>
    <PanelCard
        title="情景对比"
        subtitle="4 个预设情景用同一套结构参数（平台 / 游戏 / 窗口 / 期数）推演，高亮累计经营利润最优情景"
    >
        <template #actions>
            <el-radio-group :model-value="activeKey" size="small" @change="onPick">
                <el-radio-button v-for="p in SCENARIO_PRESETS" :key="p.key" :value="p.key">{{ p.name }}</el-radio-button>
            </el-radio-group>
        </template>

        <PanelEmptyState v-if="!rows.length" text="当前参数下无有效游戏 / 平台结构，暂无可对比情景" />
        <el-table
            v-else
            :data="rows"
            size="small"
            class="scen__table"
            :row-class-name="rowClass"
            :default-sort="{ prop: 'cumulativeProfit', order: 'descending' }"
        >
            <el-table-column prop="name" label="情景" min-width="112" fixed>
                <template #default="{ row }">
                    <div class="scen__name">
                        <b>{{ row.name }}</b>
                        <span v-if="row.key === bestKey" class="scen__best" :class="{ 'scen__best--loss': !bestProfitable }">
                            {{ bestProfitable ? '最优' : '最优·仍亏损' }}
                        </span>
                        <span v-if="row.key === activeKey" class="scen__cur">当前</span>
                    </div>
                    <span class="scen__desc">{{ row.desc }}</span>
                </template>
            </el-table-column>

            <el-table-column label="假设（预算/曲线A/曲线B/人工）" min-width="188">
                <template #default="{ row }">
                    <span class="oa-num scen__assump">
                        {{ signed(row.params.budgetDelta) }} / {{ signed(row.params.curveADelta) }} /
                        {{ signed(row.params.curveBDelta) }} / {{ signed(row.params.laborDelta) }}
                    </span>
                </template>
            </el-table-column>

            <el-table-column label="月均消耗" align="right" min-width="104" sortable :sort-by="'avgSpend'">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.avgSpend) }}</span>
                </template>
            </el-table-column>

            <el-table-column label="月均收入" align="right" min-width="104" sortable :sort-by="'avgRevenue'">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.avgRevenue) }}</span>
                </template>
            </el-table-column>

            <el-table-column label="月均经营利润" align="right" min-width="118" sortable :sort-by="'avgProfit'">
                <template #default="{ row }">
                    <span class="oa-num" :class="trendClass(row.avgProfit)">{{ money(row.avgProfit) }}</span>
                </template>
            </el-table-column>

            <el-table-column label="累计经营利润" align="right" min-width="122" sortable :sort-by="'cumulativeProfit'">
                <template #default="{ row }">
                    <span class="oa-num" :class="trendClass(row.cumulativeProfit)">{{ money(row.cumulativeProfit) }}</span>
                </template>
            </el-table-column>

            <el-table-column label="累计预估 ROI" align="right" min-width="112" sortable :sort-by="'cumulativeRoi'">
                <template #default="{ row }">
                    <span class="oa-num">{{ ratio(row.cumulativeRoi) }} 倍</span>
                </template>
            </el-table-column>

            <el-table-column label="现金缺口（近似）" align="right" min-width="122" sortable :sort-by="'cashGap'">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.cashGap) }}</span>
                </template>
            </el-table-column>
        </el-table>

        <p v-if="rows.length" class="scen__note">
            月均消耗 / 收入 / 经营利润 / 累计经营利润 / 累计预估 ROI 全部来自数据引擎 `store.project`
            （与「月度经营预估」页同源，可直接对照）。<b>现金缺口为近似口径</b>：引擎推演接口不返回现金字段，
            此处按「当期实际现金缺口水平 × 消耗放大倍数 + 推演期增量部分的预付/应收净额」折算，用于情景间横向比较量级。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { money, ratio, trendClass } from '@/utils/format';
    import { SCENARIO_PRESETS, type ScenarioKey, type ScenarioRow } from './simulatorEngine';
    import { computed } from 'vue';

    /** 情景对比表：预设情景一键切换 + 六项结果横向对比 */
    defineOptions({ name: 'SimulatorScenarioTable' });

    const props = defineProps<{
        /** 当前结构参数下的 4 个预设情景结果 */
        rows: ScenarioRow[];
        /** 当前参数命中的预设（可能为空 = 手动调参中） */
        activeKey: ScenarioKey | null;
    }>();

    const emit = defineEmits<{ pick: [ScenarioKey] }>();

    /** 累计经营利润最高的情景（全为亏损时同样给出相对最优，标记为「仍亏损」） */
    const bestKey = computed<ScenarioKey | null>(() => {
        if (!props.rows.length) return null;
        const best = props.rows.reduce((a, b) => (b.cumulativeProfit > a.cumulativeProfit ? b : a), props.rows[0]);
        return best.key;
    });

    /** 最优情景是否仍然亏损 */
    const bestProfitable = computed(() => {
        const row = props.rows.find((r) => r.key === bestKey.value);
        return (row?.cumulativeProfit ?? 0) > 0;
    });

    function onPick(v: string | number | boolean | undefined) {
        if (typeof v === 'string') emit('pick', v as ScenarioKey);
    }

    function rowClass({ row }: { row: ScenarioRow }): string {
        if (row.key === bestKey.value) return bestProfitable.value ? 'scen-row--best' : 'scen-row--best-loss';
        if (row.key === props.activeKey) return 'scen-row--cur';
        return '';
    }

    function signed(v: number): string {
        const s = `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
        return s;
    }
</script>

<style scoped lang="scss">
    .scen__table {
        width: 100%;

        :deep(.scen-row--best) {
            background: var(--oa-success-soft);

            td {
                background: var(--oa-success-soft) !important;
            }
        }

        /* 相对最优但仍亏损时，用警示色而不是成功色，避免误导 */
        :deep(.scen-row--best-loss) {
            background: var(--oa-warning-soft);

            td {
                background: var(--oa-warning-soft) !important;
            }
        }

        :deep(.scen-row--cur) td:first-child {
            box-shadow: inset 3px 0 0 var(--oa-primary);
        }
    }

    .scen__name {
        display: flex;
        align-items: center;
        gap: 5px;
        line-height: 18px;
    }

    .scen__best {
        padding: 0 5px;
        border-radius: 7px;
        background: var(--oa-success-soft);
        color: #0e9455;
        font-size: 10px;
        white-space: nowrap;

        &--loss {
            background: var(--oa-warning-soft);
            color: #c96a1c;
        }
    }

    .scen__cur {
        padding: 0 5px;
        border-radius: 7px;
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
        font-size: 10px;
    }

    .scen__desc {
        display: block;
        font-size: 10px;
        line-height: 1.4;
        color: var(--oa-text-4);
        white-space: normal;
    }

    .scen__assump {
        font-size: 11px;
        color: var(--oa-text-3);
    }

    .scen__note {
        margin: 8px 0 0;
        font-size: 11px;
        line-height: 1.6;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-3);
        }
    }
</style>
