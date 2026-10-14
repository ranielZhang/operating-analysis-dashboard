<template>
    <PanelCard title="组织利润贡献" subtitle="钱是哪些中心 / 部门 / 小组赚的" plain>
        <template #actions>
            <el-radio-group v-model="level" size="small">
                <el-radio-button v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                </el-radio-button>
            </el-radio-group>
        </template>

        <div class="oc">
            <!-- ------------------------------------------------------------------
                 成本中心口径说明：这层业务事实不讲清楚，用户会把「研发中心利润为负」
                 当成数据错误。文案里的中心名全部由数据推导（spend === 0 且有人工成本）。
            ------------------------------------------------------------------ -->
            <div class="oc__notice">
                <span class="oc__notice-badge">口径</span>
                <span class="oc__notice-text">{{ noticeText }}</span>
            </div>

            <template v-if="hasData">
                <!-- 图 1：利润贡献横向柱状图（随全局利润口径切换，正负分色） -->
                <EChart :option="profitOption" style="height: 260px" />
                <p v-if="chartRows.length < levelRows.length" class="oc__caption">
                    柱图只画利润最高的 {{ chartRows.length }} 个节点（共 {{ levelRows.length }} 个），完整明细见下表。
                </p>

                <!-- 图 2：消耗 / 应确认收入 / 经营利润 三维对比 -->
                <EChart :option="compareOption" style="height: 240px" />
                <p class="oc__caption">
                    左轴：投放消耗 / 应确认收入；右轴：经营利润。利润量级只有消耗的 1/4 ~ 1/3，分轴仅为放大可读性，
                    柱高不可跨轴直接比较；成本中心的消耗与收入恒为 0，因此只看得见它的负向利润柱（量级很小，请以表格数值为准）。
                </p>

                <div class="oc__table">
                    <el-table
                        :data="tableRows"
                        size="small"
                        show-overflow-tooltip
                        :default-sort="{ prop: 'operatingProfit', order: 'descending' }"
                    >
                        <el-table-column prop="name" label="名称" min-width="122" fixed>
                            <template #default="{ row }">
                                <span class="oc__row-name">{{ row.name }}</span>
                                <el-tag v-if="row.isCostCenter" size="small" type="info" class="oc__tag">成本中心</el-tag>
                            </template>
                        </el-table-column>

                        <el-table-column label="人数" align="right" width="58">
                            <template #default="{ row }">
                                <span class="oa-num">{{ comma(row.headcount) }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column label="投放消耗" align="right" min-width="86" sortable prop="spend">
                            <template #default="{ row }">
                                <span class="oa-num">{{ money(row.spend) }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column label="应确认收入" align="right" min-width="92" sortable prop="accrualRevenue">
                            <template #default="{ row }">
                                <span class="oa-num">{{ money(row.accrualRevenue) }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column label="经营利润" align="right" min-width="92" sortable prop="operatingProfit">
                            <template #default="{ row }">
                                <span class="oa-num" :class="trendClass(row.operatingProfit)">
                                    {{ money(row.operatingProfit) }}
                                </span>
                            </template>
                        </el-table-column>

                        <el-table-column label="利润率" align="right" min-width="74" sortable prop="operatingMargin">
                            <template #default="{ row }">
                                <span class="oa-num" :class="row.accrualRevenue > 0 ? trendClass(row.operatingProfit) : ''">
                                    {{ row.marginText }}
                                </span>
                            </template>
                        </el-table-column>

                        <el-table-column label="累计预估ROI" align="right" min-width="98" sortable prop="forecastRoi">
                            <template #default="{ row }">
                                <span class="oa-num">{{ row.roiText }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column label="人效比" align="right" min-width="72" sortable prop="efficiencyRatio">
                            <template #default="{ row }">
                                <span class="oa-num">{{ row.effText }}</span>
                            </template>
                        </el-table-column>
                    </el-table>

                    <p class="oc__foot">{{ footNote }}</p>
                </div>

                <p class="oc__conclusion">
                    <span>{{ leadSentence }}</span>
                    <span>{{ costSentence }}</span>
                </p>

                <!-- 组织轴不响应业务筛选，这里把口径差异讲清楚，否则用户会以为本面板数字算错 -->
                <p v-if="axisWarn" class="oc__warn">{{ axisWarn }}</p>
            </template>

            <PanelEmptyState v-else text="当前筛选范围内没有可归属到该层级的组织节点（试试切换到更低的层级）" />
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import { store } from '@/domain/store';
    import type { MetricRow } from '@/domain/types';
    import { useAnalysisFilter, basisLabel } from '@/composables/useAnalysisFilter';
    import { comma, money, percent, ratio, toWan, trendClass } from '@/utils/format';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';

    /** M4 组织利润贡献：中心 / 部门 / 小组 三层利润归因 */
    defineOptions({ name: 'OverviewOrgContribution' });

    const { filter } = useAnalysisFilter();

    // ------------------------------------------------------------------
    // 图表配色：ECharts 走 canvas，canvas 不解析 CSS 变量，
    // 因此这里用与 theme.scss 设计令牌等值的字面色值（改令牌时需同步）。
    //   --oa-operating    #12b566   经营利润（正）
    //   --oa-danger       #fd6464   负值 / 亏损
    //   --oa-cost-ad      #fd6464   投放消耗
    //   --oa-revenue      #8b5cf6   应确认收入
    // ------------------------------------------------------------------
    const COLOR_POS = '#12b566';
    const COLOR_NEG = '#fd6464';
    const COLOR_SPEND = '#fd6464';
    const COLOR_REVENUE = '#8b5cf6';

    type OrgLevel = 'center' | 'department' | 'group';

    const LEVEL_OPTIONS: Array<{ value: OrgLevel; label: string }> = [
        { value: 'center', label: '中心' },
        { value: 'department', label: '部门' },
        { value: 'group', label: '小组' },
    ];

    /** 当前查看层级（组件内状态，与全局筛选条件互不影响） */
    const level = ref<OrgLevel>('center');
    const levelLabel = computed(() => LEVEL_OPTIONS.find((o) => o.value === level.value)?.label ?? '');

    /** 图表 1 / 图表 2 / 表格 最多展示多少个节点（小组层有 17 个，必须收敛） */
    const PROFIT_CHART_MAX = 8;
    const COMPARE_CHART_MAX = 6;
    const TABLE_MAX = 10;

    // ============================================================
    // 取数：全部来自 store，随全局筛选条件实时重算
    // ============================================================
    /** 当前层级的组织节点（store 已按组织 / 业务筛选范围裁剪，空数组 = 无数据） */
    const levelRows = computed<MetricRow[]>(() => store.queryRows(filter, level.value));

    /** 成本中心行：无投放消耗、却有人工成本 */
    const isCostCenterRow = (r: MetricRow): boolean => r.spend === 0 && r.laborCost > 0;

    /** 表格行：默认按经营利润降序 */
    const rowsByOperating = computed(() =>
        [...levelRows.value].sort((a, b) => b.operatingProfit - a.operatingProfit),
    );
    /** 图表行：按当前口径利润降序（横向柱图从上到下递减） */
    const rowsByProfit = computed(() => [...levelRows.value].sort((a, b) => b.profit - a.profit));

    interface ContribRow {
        key: string;
        name: string;
        headcount: number;
        spend: number;
        accrualRevenue: number;
        operatingProfit: number;
        operatingMargin: number;
        forecastRoi: number;
        efficiencyRatio: number;
        laborCost: number;
        isCostCenter: boolean;
        /** 以下三个为展示文本（分母为 0 时用「—」，避免出现 0.0% / 0.00 误导） */
        marginText: string;
        roiText: string;
        effText: string;
    }

    const toRow = (r: MetricRow): ContribRow => ({
        key: r.key,
        name: r.name,
        headcount: r.headcount,
        spend: r.spend,
        accrualRevenue: r.accrualRevenue,
        operatingProfit: r.operatingProfit,
        operatingMargin: r.operatingMargin,
        forecastRoi: r.forecastRoi,
        efficiencyRatio: r.efficiencyRatio,
        laborCost: r.laborCost,
        isCostCenter: isCostCenterRow(r),
        marginText: r.accrualRevenue > 0 ? percent(r.operatingMargin) : '—',
        roiText: r.spend > 0 ? ratio(r.forecastRoi) : '—',
        effText: r.laborCost > 0 ? ratio(r.efficiencyRatio) : '—',
    });

    const tableRows = computed<ContribRow[]>(() => rowsByOperating.value.slice(0, TABLE_MAX).map(toRow));
    const chartRows = computed<MetricRow[]>(() => rowsByProfit.value.slice(0, PROFIT_CHART_MAX));
    const compareRows = computed<MetricRow[]>(() => rowsByProfit.value.slice(0, COMPARE_CHART_MAX));

    const hasData = computed(() => levelRows.value.length > 0);

    /** 表格未展示部分（避免「只显示前 10 个」被误读成全量） */
    const restRows = computed<MetricRow[]>(() => rowsByOperating.value.slice(TABLE_MAX));
    const hiddenCount = computed(() => restRows.value.length);
    const hiddenProfit = computed(() => restRows.value.reduce((s, r) => s + r.operatingProfit, 0));
    const hiddenCostCenters = computed(() => restRows.value.filter(isCostCenterRow).length);

    /** 表尾说明：把「只展示了前 N 个」和「分母为 0 显示 —」两件事都讲明，避免被误读成数据缺失 */
    const footNote = computed(() => {
        const head = `共 ${levelRows.value.length} 个${levelLabel.value}节点，按经营利润降序展示前 ${tableRows.value.length} 个`;
        const rest = hiddenCount.value
            ? `；其余 ${hiddenCount.value} 个合计经营利润 ${money(hiddenProfit.value)}（其中 ${hiddenCostCenters.value} 个为无投放、只承担人力的成本单元）`
            : '';
        return `${head}${rest}。利润率 / 累计预估ROI / 人效比的分母为 0 时显示「—」（无收入 / 无投放 / 无人工成本）。`;
    });

    // ============================================================
    // 中心层汇总：结论文案 + 成本中心说明的名与数
    // ============================================================
    /** 中心层各行（当前筛选范围内）；level 已是中心层时直接复用，避免重复取数 */
    const centerRows = computed<MetricRow[]>(() =>
        level.value === 'center' ? levelRows.value : store.queryRows(filter, 'center'),
    );
    /** 有投放消耗的中心 = 真正的利润中心 */
    const earnerRows = computed(() => centerRows.value.filter((r) => r.spend > 0));
    /** 无消耗、只有人工/管理成本的中心 = 成本中心 */
    const costCenterRows = computed(() => centerRows.value.filter(isCostCenterRow));

    const earnerNames = computed(() => earnerRows.value.map((r) => r.name).join(' / '));
    const costCenterNames = computed(() => costCenterRows.value.map((r) => r.name).join(' / '));

    /**
     * 成本中心口径说明文案（三种范围形态都要说得通）：
     * 1) 范围内有成本中心 → 解释「消耗为 0 + 只有人工/管理成本 ⇒ 利润天然为负」
     * 2) 范围内只有投放主体（例如只筛了投放部）→ 说明成本中心不在当前范围内
     * 3) 范围内两者都没有（例如只筛了某个部门却看「中心」层）→ 提示放宽范围 / 换层级
     */
    const noticeText = computed(() => {
        if (costCenterNames.value) {
            const fact = `${costCenterNames.value} 是成本中心：不直接投放，投放消耗恒为 0，只产生人工与管理成本，因此收入为 0、利润天然为负。`;
            if (!earnerNames.value) {
                return `${fact}当前筛选范围内没有发生投放的利润中心，所以这里只体现成本，没有收入与利润来源。`;
            }
            return `${fact}当前范围内的投放消耗与收入全部由 ${earnerNames.value} 承担；下表带「成本中心」标签的行即属这类单元，不是数据错误。`;
        }
        if (earnerRows.value.length) {
            return `${earnerNames.value} 承担当前范围内的全部投放消耗与收入，是这里唯一的利润来源；成本中心不在当前筛选范围内（可在筛选栏切换组织范围查看）。`;
        }
        return '当前筛选范围过窄（例如只选中了某个部门或小组）：该范围内既没有发生投放的节点，也没有可比成本，请放宽组织范围或切换到更低层级。';
    });

    /** 公司合计（做占比分母，恒取经营口径） */
    const companyMetrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    const companyOperatingProfit = computed(() => companyMetrics.value?.operatingProfit ?? 0);

    /**
     * 组织轴合计（各中心经营利润之和）。
     * ⚠️ store 的组织维度按月预聚合，**不响应平台/项目/游戏筛选**；
     * 而 metricsOf('company') 走的是「筛选后的投放组合」。
     * 因此一旦选了业务范围，组织行（全量业务）与公司合计（筛选后业务）口径不同，
     * 不能拿来做占比分子/分母 —— 这里显式检测并在界面上说明，避免给出荒谬的百分比。
     */
    const orgAxisTotal = computed(() => centerRows.value.reduce((s, r) => s + r.operatingProfit, 0));
    const axisDiverged = computed(() => {
        const gap = Math.abs(orgAxisTotal.value - companyOperatingProfit.value);
        return gap / Math.max(Math.abs(companyOperatingProfit.value), 1) > 0.02;
    });

    const axisWarn = computed(() => {
        if (!axisDiverged.value) return '';
        return `注意：当前选了平台 / 项目 / 游戏范围。本面板的组织行按全量业务归集（全量消耗 ${money(
            centerRows.value.reduce((s, r) => s + r.spend, 0),
        )}），而全公司合计 ${money(companyOperatingProfit.value)} 只含筛选后的业务（消耗 ${money(
            companyMetrics.value?.spend ?? 0,
        )}），两者口径不同、不可直接相加或相除，占比结论请在不筛选业务范围时查看。`;
    });

    /** 贡献最大的利润中心 */
    const leadCenter = computed<MetricRow | undefined>(
        () => [...earnerRows.value].sort((a, b) => b.operatingProfit - a.operatingProfit)[0],
    );

    const leadSentence = computed(() => {
        const lead = leadCenter.value;
        // 范围内只有成本中心（例如只筛了研发中心）时，没有可讲的利润来源
        if (!lead) return '当前筛选范围内没有任何中心发生投放消耗，因此没有利润来源，只体现成本；';
        const head = `${lead.name} 贡献经营利润 ${money(lead.operatingProfit)}`;
        const company = companyOperatingProfit.value;
        // 组织轴与公司合计口径不一致（选了业务范围）→ 只报数，不给占比
        if (axisDiverged.value) {
            return `${head}（组织行按全量业务归集）；当前筛选了业务范围，全公司合计 ${money(company)} 只含筛选后的业务，两者口径不同，故不计算占比；`;
        }
        if (company <= 0) {
            return `${head}；全公司经营利润为负（${money(company)}），暂不计算占比；`;
        }
        const share = lead.operatingProfit / company;
        // 成本中心只吃成本、不产生收入，会把「公司合计利润」压低，
        // 导致该占比 > 100%，必须在文案里解释，否则会被当成算错。
        if (share > 1.2) {
            return `${head}，占全公司经营利润（${money(company)}）的 ${percent(share)}——比值超过 100% 是因为 ${costCenterNames.value} 只有成本、没有收入，把公司合计利润压低了；`;
        }
        return `${head}，占全公司经营利润（${money(company)}）的 ${percent(share)}；`;
    });

    const costSentence = computed(() => {
        if (!costCenterRows.value.length) return '当前筛选范围未包含成本中心。';
        const cost = costCenterRows.value.reduce((s, r) => s + r.laborCost + r.adminCost, 0);
        const labor = costCenterRows.value.reduce((s, r) => s + r.laborCost, 0);
        return `${costCenterNames.value} 因消耗为 0 不产生收入，合计承担人工与管理成本 ${money(cost)}，其中人力 ${money(labor)}。`;
    });

    // ============================================================
    // 图 1：利润贡献横向柱状图
    //   yAxis 类别轴取倒序 → 利润最大的节点排在最上方
    //   金额数据保持「元」（store 原值），坐标轴按「万」显示、tooltip 用 money()
    // ============================================================
    const profitOption = computed<EChartsOption>(() => {
        const rows = [...chartRows.value].reverse();
        const values = rows.map((r) => r.profit);
        const hasNegative = values.some((v) => v < 0);
        // 柱顶/柱侧 label 是绘制在坐标系里的，必须给坐标轴留出 label 宽度，
        // 否则最小的负值柱（成本中心）的 label 会被 grid 裁掉。
        const maxV = Math.max(0, ...values);
        const minV = Math.min(0, ...values);
        return {
            grid: { left: 6, right: 74, top: 8, bottom: 4, containLabel: true },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => money(Number(v)),
            },
            xAxis: {
                type: 'value',
                min: minV < 0 ? minV * 1.35 : 0,
                max: maxV > 0 ? maxV * 1.15 : minV < 0 ? 0 : 1,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => `${toWan(Number(v)).toFixed(0)}万` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            yAxis: {
                type: 'category',
                data: rows.map((r) => r.name),
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false },
                axisLabel: { color: '#64748b', fontSize: 11 },
            },
            series: [
                {
                    name: basisLabel(filter.basis),
                    type: 'bar',
                    barMaxWidth: 16,
                    // 正负分色 + 柱顶 label 显示金额（负值 label 放到柱子左侧，避免压住零线）
                    data: rows.map((r) => ({
                        value: r.profit,
                        itemStyle: {
                            color: r.profit >= 0 ? COLOR_POS : COLOR_NEG,
                            borderRadius: r.profit >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
                        },
                        label: {
                            show: true,
                            position: r.profit >= 0 ? 'right' : 'left',
                            distance: 4,
                            fontSize: 11,
                            color: r.profit >= 0 ? COLOR_POS : COLOR_NEG,
                            formatter: () => money(r.profit),
                        },
                    })),
                    ...(hasNegative
                        ? {
                              markLine: {
                                  silent: true,
                                  symbol: 'none',
                                  label: { show: false },
                                  lineStyle: { color: '#cbd5e1', type: 'dashed' as const, width: 1 },
                                  data: [{ xAxis: 0 }],
                              },
                          }
                        : {}),
                },
            ],
        };
    });

    // ============================================================
    // 图 2：消耗 / 应确认收入 / 经营利润 三维对比
    // 取舍说明：利润 = 收入 − 消耗 − 人工 − 管理，实测「利润 : 消耗」约为 1/4 ~ 1/3，
    // 若三根柱共用一根轴，利润柱（尤其成本中心的小额负值）会被压得难以判读。
    // 因此：投放消耗 + 应确认收入 走左轴，经营利润走右轴（两轴数据单位都是「元」，
    // 刻度 label 统一按「万」显示）。分轴只为放大可读性，柱高不可跨轴直接比较。
    // ============================================================
    const compareOption = computed<EChartsOption>(() => {
        const rows = compareRows.value;
        const labels = rows.map((r) => r.name);
        return {
            grid: { left: 8, right: 8, top: 30, bottom: 6, containLabel: true },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => money(Number(v)),
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
                data: ['投放消耗', '应确认收入', '经营利润'],
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false },
                axisLabel: { color: '#94a3b8', fontSize: 11, interval: 0, width: 58, overflow: 'truncate' },
            },
            yAxis: [
                {
                    type: 'value',
                    splitNumber: 4,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => `${toWan(Number(v)).toFixed(0)}万` },
                    splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                {
                    type: 'value',
                    splitNumber: 4,
                    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => `${toWan(Number(v)).toFixed(0)}万` },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: '投放消耗',
                    type: 'bar',
                    yAxisIndex: 0,
                    barMaxWidth: 14,
                    itemStyle: { color: COLOR_SPEND, borderRadius: [3, 3, 0, 0] },
                    data: rows.map((r) => r.spend),
                },
                {
                    name: '应确认收入',
                    type: 'bar',
                    yAxisIndex: 0,
                    barMaxWidth: 14,
                    itemStyle: { color: COLOR_REVENUE, borderRadius: [3, 3, 0, 0] },
                    data: rows.map((r) => r.accrualRevenue),
                },
                {
                    name: '经营利润',
                    type: 'bar',
                    yAxisIndex: 1,
                    barMaxWidth: 14,
                    itemStyle: {
                        borderRadius: [3, 3, 0, 0],
                        // 利润柱同样按正负分色；成本中心为负值，与图 1 视觉语言一致
                        color: COLOR_POS,
                    },
                    data: rows.map((r) => ({
                        value: r.operatingProfit,
                        itemStyle: { color: r.operatingProfit >= 0 ? COLOR_POS : COLOR_NEG },
                    })),
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .oc {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        padding: 12px 14px;
    }

    /* ---------- 成本中心口径说明 ---------- */
    .oc__notice {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 7px 10px;
        background: var(--oa-hover);
        border: 1px dashed var(--oa-border);
        border-radius: var(--oa-radius-sm);
    }

    .oc__notice-badge {
        flex: 0 0 auto;
        padding: 0 6px;
        font-size: var(--oa-fs-xs);
        line-height: 18px;
        color: var(--oa-primary);
        background: var(--oa-primary-soft);
        border-radius: var(--oa-radius-sm);
    }

    .oc__notice-text {
        font-size: var(--oa-fs-xs);
        line-height: 18px;
        color: var(--oa-text-3);
    }

    .oc__caption {
        margin: -4px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    /* ---------- 明细表 ---------- */
    .oc__table {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 0;
    }

    .oc__row-name {
        color: var(--oa-text-1);
    }

    .oc__tag {
        margin-left: 6px;
        transform: scale(0.92);
        transform-origin: left center;
    }

    .oc__foot {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    /* ---------- 一句话结论 ---------- */
    .oc__conclusion {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        margin: 0;
        padding: 8px 10px;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-2);
        background: var(--oa-primary-soft);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
    }

    /* 业务筛选导致组织轴 / 公司合计口径不一致时的提示 */
    .oc__warn {
        margin: 0;
        padding: 6px 10px;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-warning);
        background: var(--oa-warning-soft);
        border-left: 3px solid var(--oa-warning);
        border-radius: var(--oa-radius-sm);
    }

    /* 表格紧凑化 */
    :deep(.el-table) {
        font-size: var(--oa-fs-xs);
    }

    :deep(.el-table th.el-table__cell) {
        padding: 5px 0;
        background: var(--oa-hover);
        color: var(--oa-text-3);
        font-weight: 600;
    }

    :deep(.el-table td.el-table__cell) {
        padding: 4px 0;
    }

    :deep(.el-table .cell) {
        padding: 0 8px;
    }
</style>
