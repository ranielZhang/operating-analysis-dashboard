<template>
    <div class="rcs">
        <!-- ================= ① 收入结构 / ② 成本结构：左右两个环形图 + 占比小表 ================= -->
        <div class="rcs__split">
            <!-- 收入三科目 -->
            <PanelCard title="收入结构" subtitle="流量主 / 广告金 / 分成 · 实际发生口径">
                <PanelEmptyState v-if="revenueEmpty" text="当前筛选条件下暂无收入数据" />
                <div v-else class="rcs__block">
                    <EChart :option="revenueDonutOption" style="height: 240px" />

                    <ul class="rcs__list">
                        <li v-for="item in revenueItems" :key="item.key" class="rcs__row">
                            <span class="rcs__dot" :style="{ background: item.barColor }" />
                            <span class="rcs__label" :title="item.desc">{{ item.name }}</span>
                            <span class="rcs__track">
                                <el-progress
                                    :percentage="item.pct"
                                    :stroke-width="5"
                                    :show-text="false"
                                    :color="item.barColor"
                                />
                            </span>
                            <span class="rcs__amount oa-num">{{ money(item.value) }}</span>
                            <span class="rcs__share oa-num">{{ percent(item.share) }}</span>
                        </li>
                    </ul>

                    <div class="rcs__recon">
                        <span>应计确认收入 <b class="oa-num">{{ money(accrualRevenue) }}</b></span>
                        <span>已到账收入 <b class="oa-num">{{ money(cashRevenue) }}</b></span>
                    </div>

                    <p class="rcs__note">{{ revenueNote }}</p>
                </div>
            </PanelCard>

            <!-- 成本八科目（3 大类 + 8 细项） -->
            <PanelCard title="成本结构" subtitle="三大类 → 8 科目 · 实际发生口径">
                <PanelEmptyState v-if="costEmpty" text="当前筛选条件下暂无成本数据" />
                <div v-else class="rcs__block">
                    <EChart :option="costDonutOption" style="height: 240px" />

                    <ul class="rcs__list">
                        <template v-for="group in costGroups" :key="group.key">
                            <!-- 第一层：三大类小计 -->
                            <li class="rcs__row rcs__row--group">
                                <span class="rcs__dot" :style="{ background: group.barColor }" />
                                <span class="rcs__label">{{ group.name }}</span>
                                <span class="rcs__track">
                                    <el-progress
                                        :percentage="group.pct"
                                        :stroke-width="6"
                                        :show-text="false"
                                        :color="group.barColor"
                                    />
                                </span>
                                <span class="rcs__amount oa-num">{{ money(group.value) }}</span>
                                <span class="rcs__share oa-num">{{ percent(group.share) }}</span>
                            </li>
                            <!-- 第二层：科目细项 -->
                            <li v-for="item in group.items" :key="item.key" class="rcs__row rcs__row--leaf">
                                <span class="rcs__dot" :style="{ background: item.barColor }" />
                                <span class="rcs__label" :title="item.desc">{{ item.name }}</span>
                                <span class="rcs__track">
                                    <el-progress
                                        :percentage="item.pct"
                                        :stroke-width="5"
                                        :show-text="false"
                                        :color="item.barColor"
                                    />
                                </span>
                                <span class="rcs__amount oa-num">{{ money(item.value) }}</span>
                                <span class="rcs__share oa-num">{{ percent(item.share) }}</span>
                            </li>
                        </template>
                    </ul>

                    <p class="rcs__note">{{ costNote }}</p>
                </div>
            </PanelCard>
        </div>

        <!-- ================= ③ 收入 / 成本结构趋势：按月堆叠柱 ================= -->
        <PanelCard title="收入与成本结构趋势" subtitle="按月堆叠 · 单位：万元 · 实际发生口径">
            <PanelEmptyState v-if="trendEmpty" text="当前筛选条件下暂无月度结构数据" />
            <div v-else class="rcs__trends">
                <div class="rcs__trend">
                    <p class="rcs__trend-cap">收入 · 三科目堆叠</p>
                    <PanelEmptyState v-if="revenueTrendEmpty" text="所选期间无收入发生" />
                    <EChart v-else :option="revenueTrendOption" style="height: 240px" />
                </div>
                <div class="rcs__trend">
                    <p class="rcs__trend-cap">成本 · 八科目堆叠</p>
                    <PanelEmptyState v-if="costTrendEmpty" text="所选期间无成本发生" />
                    <EChart v-else :option="costTrendOption" style="height: 240px" />
                </div>
            </div>
            <p class="rcs__note rcs__note--foot">{{ trendNote }}</p>
        </PanelCard>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';

    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { store } from '@/domain/store';
    import type { CostBreakdown, RevenueBreakdown } from '@/domain/types';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, percent } from '@/utils/format';

    /**
     * 经营总览 · 收入成本结构（M5 收入结构 + M6 成本结构）
     * 回答两个问题：钱从哪来（收入三科目）、钱花到哪去（成本三大类 8 科目）。
     * 无 props：自己读全局筛选条件 → 调 store 取数 → 全部 computed 重算。
     */
    defineOptions({ name: 'OverviewRevenueCostStructure' });

    const { filter } = useAnalysisFilter();

    // ============================================================
    // 1. 取数（唯一数据源：store）
    // ============================================================
    /** 公司整体指标（结构与总额都取这一份） */
    const metrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    /** 逐月序列（强制按月，趋势堆叠柱用） */
    const points = computed(() => store.queryMonthSeries(filter));

    const ZERO_REVENUE: RevenueBreakdown = { liuliangzhu: 0, adGold: 0, iapShare: 0 };
    const ZERO_COST: CostBreakdown = {
        adSpend: 0,
        prepay: 0,
        salary: 0,
        socialInsurance: 0,
        individualTax: 0,
        projectBonus: 0,
        welfare: 0,
        office: 0,
    };

    const revenueByType = computed<RevenueBreakdown>(() => metrics.value?.revenueByType ?? ZERO_REVENUE);
    const costByType = computed<CostBreakdown>(() => metrics.value?.costByType ?? ZERO_COST);

    /** 收入结构合计 = 三科目之和（口径：应计确认收入的实际构成，不随利润口径切换） */
    const revenueTotal = computed(() => {
        const r = revenueByType.value;
        return r.liuliangzhu + r.adGold + r.iapShare;
    });
    /** 成本结构合计 = 八科目之和（实际发生口径：投放消耗 + 充值额 + 人工 + 管理） */
    const costTotal = computed(() => {
        const c = costByType.value;
        return c.adSpend + c.prepay + c.salary + c.socialInsurance + c.individualTax + c.projectBonus + c.welfare + c.office;
    });

    const accrualRevenue = computed(() => metrics.value?.accrualRevenue ?? 0);
    const cashRevenue = computed(() => metrics.value?.cashRevenue ?? 0);

    // ============================================================
    // 2. 配色（唯一来源：theme.scss 的设计令牌）
    //    ECharts 走 canvas 渲染、不解析 CSS 变量，所以这里把令牌读成实际色值；
    //    读不到时回退到 theme.scss 里同一份字面值，保证图表永远不会画成黑色。
    // ============================================================
    interface Palette {
        revLlz: string;
        revAdGold: string;
        revShare: string;
        costAd: string;
        costPrepay: string;
        costLabor: string;
        costAdmin: string;
        card: string;
    }

    let paletteCache: Palette | null = null;
    function palette(): Palette {
        if (!paletteCache) {
            const read = (name: string, fallback: string): string => {
                if (typeof document === 'undefined') return fallback;
                const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
                return v || fallback;
            };
            paletteCache = {
                revLlz: read('--oa-rev-liuliangzhu', '#8b5cf6'),
                revAdGold: read('--oa-rev-adgold', '#f472b6'),
                revShare: read('--oa-rev-share', '#06b6d4'),
                costAd: read('--oa-cost-ad', '#fd6464'),
                costPrepay: read('--oa-cost-prepay', '#ff9140'),
                costLabor: read('--oa-cost-labor', '#4d94fa'),
                costAdmin: read('--oa-cost-admin', '#06b6d4'),
                card: read('--oa-card', '#ffffff'),
            };
        }
        return paletteCache;
    }

    /** #rrggbb → rgba()：实现「同组内细分项用同色不同透明度」 */
    function alpha(color: string, a: number): string {
        const m = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
        if (!m) return color;
        const n = Number.parseInt(m[1], 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    /** 图表坐标系固定色（对齐契约 §7） */
    const AXIS_LINE = '#e2e8f0';
    const AXIS_TEXT = '#94a3b8';
    const SPLIT_LINE = '#f1f5f9';
    const LEGEND_TEXT = '#64748b';
    const TEXT_1 = '#1f2937';
    const TEXT_4 = '#9ca3af';

    // ============================================================
    // 3. 科目定义
    // ============================================================
    type RevToken = 'revLlz' | 'revAdGold' | 'revShare';
    type CostToken = 'costAd' | 'costPrepay' | 'costLabor' | 'costAdmin';
    type CostGroupKey = 'business' | 'labor' | 'admin';

    const REVENUE_DEFS: Array<{ key: keyof RevenueBreakdown; name: string; desc: string; token: RevToken }> = [
        { key: 'liuliangzhu', name: '流量主收入', desc: '小游戏内激励视频 / 插屏 / Banner 广告分成', token: 'revLlz' },
        { key: 'adGold', name: '广告金', desc: '平台返点 / 返还广告金', token: 'revAdGold' },
        { key: 'iapShare', name: '分成收入', desc: 'IAP 内购经渠道分成后的净额', token: 'revShare' },
    ];

    interface CostLeafDef {
        key: keyof CostBreakdown;
        name: string;
        desc: string;
        group: CostGroupKey;
        token: CostToken;
        /** 同组内细分项用同色不同透明度区分 */
        alpha: number;
    }

    const COST_DEFS: CostLeafDef[] = [
        // 业务成本：投放成本（媒体后台实际消耗）与预付成本（已充值未消耗）同属「业务成本」大类，
        // 但按需求各自使用专属色（红 / 橙），以便一眼区分「消耗口径」与「充值（现金流出）口径」。
        { key: 'adSpend', name: '投放成本', desc: '媒体后台实际消耗', group: 'business', token: 'costAd', alpha: 1 },
        { key: 'prepay', name: '预付成本', desc: '已充值未消耗的现金流出', group: 'business', token: 'costPrepay', alpha: 1 },
        { key: 'salary', name: '工资', desc: '基本工资 + 绩效', group: 'labor', token: 'costLabor', alpha: 1 },
        { key: 'socialInsurance', name: '医社保', desc: '公司承担部分', group: 'labor', token: 'costLabor', alpha: 0.74 },
        { key: 'individualTax', name: '个税', desc: '代扣代缴个税', group: 'labor', token: 'costLabor', alpha: 0.52 },
        { key: 'projectBonus', name: '项目奖金', desc: '项目达成奖金（按季发放）', group: 'labor', token: 'costLabor', alpha: 0.34 },
        { key: 'welfare', name: '福利费', desc: '按中心人工成本比例计提', group: 'admin', token: 'costAdmin', alpha: 1 },
        { key: 'office', name: '办公费', desc: '按中心人头计提', group: 'admin', token: 'costAdmin', alpha: 0.62 },
    ];

    const COST_GROUP_DEFS: Array<{ key: CostGroupKey; name: string; token: CostToken }> = [
        { key: 'business', name: '业务成本', token: 'costAd' },
        { key: 'labor', name: '人工成本', token: 'costLabor' },
        { key: 'admin', name: '管理费用', token: 'costAdmin' },
    ];

    interface StructItem {
        key: string;
        name: string;
        desc: string;
        groupKey: string;
        value: number;
        /** 占比 0~1，分母 = 总收入 / 总成本 */
        share: number;
        /** 占比 0~100（el-progress 用） */
        pct: number;
        /** 图表用色 */
        color: string;
        /** 表内色点 / 占比条用色 */
        barColor: string;
    }

    function shareOf(value: number, total: number): number {
        return total > 0 ? value / total : 0;
    }
    function pctOf(share: number): number {
        return Math.min(100, Math.max(0, Number((share * 100).toFixed(1))));
    }

    const revenueItems = computed<StructItem[]>(() => {
        const p = palette();
        const total = revenueTotal.value;
        return REVENUE_DEFS.map((d) => {
            const value = revenueByType.value[d.key];
            const share = shareOf(value, total);
            return {
                key: d.key,
                name: d.name,
                desc: d.desc,
                groupKey: 'revenue',
                value,
                share,
                pct: pctOf(share),
                color: p[d.token],
                barColor: p[d.token],
            };
        });
    });

    const costItems = computed<StructItem[]>(() => {
        const p = palette();
        const total = costTotal.value;
        return COST_DEFS.map((d) => {
            const value = costByType.value[d.key];
            const share = shareOf(value, total);
            return {
                key: d.key,
                name: d.name,
                desc: d.desc,
                groupKey: d.group,
                value,
                share,
                pct: pctOf(share),
                color: alpha(p[d.token], d.alpha),
                barColor: p[d.token],
            };
        });
    });

    /** 成本第一层：三大类（外层环形 + 小计行） */
    const costGroups = computed(() => {
        const p = palette();
        const total = costTotal.value;
        return COST_GROUP_DEFS.map((g) => {
            const items = costItems.value.filter((it) => it.groupKey === g.key);
            const value = items.reduce((s, it) => s + it.value, 0);
            const share = shareOf(value, total);
            return {
                key: g.key,
                name: g.name,
                value,
                share,
                pct: pctOf(share),
                color: p[g.token],
                barColor: p[g.token],
                items,
            };
        });
    });

    // ============================================================
    // 4. 空数据兜底
    // ============================================================
    const revenueEmpty = computed(() => !metrics.value || revenueTotal.value <= 0);
    const costEmpty = computed(() => !metrics.value || costTotal.value <= 0);

    const monthRevenueTotals = computed(() =>
        points.value.map((pt) => {
            const r = pt.metrics.revenueByType;
            return r.liuliangzhu + r.adGold + r.iapShare;
        }),
    );
    const monthCostTotals = computed(() =>
        points.value.map((pt) => {
            const c = pt.metrics.costByType;
            return (
                c.adSpend + c.prepay + c.salary + c.socialInsurance + c.individualTax + c.projectBonus + c.welfare + c.office
            );
        }),
    );
    const revenueTrendEmpty = computed(() => !points.value.length || monthRevenueTotals.value.every((v) => v <= 0));
    const costTrendEmpty = computed(() => !points.value.length || monthCostTotals.value.every((v) => v <= 0));
    const trendEmpty = computed(() => revenueTrendEmpty.value && costTrendEmpty.value);

    // ============================================================
    // 5. 口径文案（说明「为什么结构与总成本/总收入可能不等」）
    // ============================================================
    const basisText = computed(() => (filter.basis === 'book' ? '账面口径' : '经营口径'));

    const revenueNote = computed(
        () =>
            `三科目按应计确认口径拆解（不随利润口径切换）：合计 ${money(revenueTotal.value)}，` +
            `当前${basisText.value}收入 ${money(metrics.value?.revenue ?? 0)}，差额来自平台结算滞后。`,
    );

    const costNote = computed(
        () =>
            `八科目＝投放消耗＋充值额＋人工＋管理（实际发生口径），合计 ${money(costTotal.value)}；` +
            `当前${basisText.value}总成本 ${money(metrics.value?.totalCost ?? 0)}（业务成本按口径只取「投放消耗」或「充值额」）。`,
    );

    const trendNote =
        '结构分析固定展示实际发生口径：投放成本恒为媒体后台实际消耗、预付成本恒为本期充值额，不随利润口径（经营 / 账面）切换；金额轴单位为万元。';

    // ============================================================
    // 6. 图表 option
    // ============================================================
    /**
     * 环形图中心文案：总额 + 副标（用 title 组件垂直居中在圆环中心）
     * fontSize 可调：成本图是两层环、中心孔更小，字号要相应收一点避免压到内环。
     */
    function pieTitle(text: string, subtext: string, fontSize = 16, subSize = 11) {
        return {
            text,
            subtext,
            left: 'center' as const,
            top: 'middle' as const,
            textAlign: 'center' as const,
            itemGap: 2,
            textStyle: { fontSize, fontWeight: 600, align: 'center' as const, color: TEXT_1 },
            subtextStyle: { fontSize: subSize, align: 'center' as const, color: TEXT_4 },
        };
    }

    /**
     * 环形图 tooltip：ECharts 的 formatter 回调参数是联合类型，
     * 这里做一次窄化断言取出 marker / name / value（不使用 any 扩散）。
     */
    function pieTooltipFormatter(total: number) {
        return (params: unknown): string => {
            const p = params as { marker?: string; seriesName?: string; name?: string; value?: number | string };
            const v = Number(p.value ?? 0);
            const head = p.seriesName ? `${p.seriesName} · ` : '';
            return `${p.marker ?? ''}${head}${p.name ?? ''}<br/>金额：${money(v)}<br/>占比：${percent(shareOf(v, total))}`;
        };
    }

    /** 右侧收入环形图：三科目 */
    const revenueDonutOption = computed<EChartsOption>(() => {
        const p = palette();
        return {
            title: pieTitle(money(revenueTotal.value), '营业收入'),
            tooltip: { trigger: 'item', formatter: pieTooltipFormatter(revenueTotal.value) },
            // 科目名称与占比由下方小表承担图例职责，环形图本体不再放标签，避免窄容器下互相压字
            series: [
                {
                    name: '收入科目',
                    type: 'pie',
                    radius: ['48%', '72%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    itemStyle: { borderColor: p.card, borderWidth: 2 },
                    data: revenueItems.value.map((it) => ({
                        name: it.name,
                        value: it.value,
                        itemStyle: { color: it.color },
                    })),
                },
            ],
        };
    });

    /**
     * 成本环形图：两层结构
     *   外层 = 三大类（业务 / 人工 / 管理），内层 = 八细项（人工与管理组内为同色不同透明度）；
     *   外环负责「钱花在哪一块」，内环负责「这一块里具体是什么」，
     *   取两层而非「八细项 + legend 分组」，是因为大类占比本身就是本模块要回答的核心结论。
     */
    const costDonutOption = computed<EChartsOption>(() => {
        const p = palette();
        return {
            title: pieTitle(money(costTotal.value), '成本合计', 13, 10),
            tooltip: { trigger: 'item', formatter: pieTooltipFormatter(costTotal.value) },
            series: [
                {
                    name: '成本细项',
                    type: 'pie',
                    radius: ['30%', '50%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    itemStyle: { borderColor: p.card, borderWidth: 1 },
                    data: costItems.value.map((it) => ({
                        name: it.name,
                        value: it.value,
                        itemStyle: { color: it.color },
                    })),
                },
                {
                    name: '成本大类',
                    type: 'pie',
                    radius: ['55%', '72%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    itemStyle: { borderColor: p.card, borderWidth: 2 },
                    data: costGroups.value.map((g) => ({
                        name: g.name,
                        value: g.value,
                        itemStyle: { color: g.color },
                    })),
                },
            ],
        };
    });

    const trendLabels = computed(() => points.value.map((pt) => pt.label));

    function axisTooltip() {
        return {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            valueFormatter: (v: unknown) => money(Number(v)),
        };
    }

    function categoryAxis(labels: string[]) {
        return {
            type: 'category' as const,
            data: labels,
            axisLine: { lineStyle: { color: AXIS_LINE } },
            axisLabel: { color: AXIS_TEXT, fontSize: 11, hideOverlap: true },
            axisTick: { show: false },
        };
    }

    function wanValueAxis() {
        return {
            type: 'value' as const,
            splitNumber: 5,
            axisLabel: { color: AXIS_TEXT, fontSize: 11, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` },
            splitLine: { lineStyle: { color: SPLIT_LINE } },
        };
    }

    function legendBase() {
        return { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: LEGEND_TEXT, fontSize: 11 } };
    }

    /** 收入三科目堆叠柱 */
    const revenueTrendOption = computed<EChartsOption>(() => {
        const p = palette();
        return {
            grid: { left: 58, right: 16, top: 34, bottom: 26 },
            tooltip: axisTooltip(),
            legend: { ...legendBase(), data: REVENUE_DEFS.map((d) => d.name) },
            xAxis: categoryAxis(trendLabels.value),
            yAxis: wanValueAxis(),
            series: REVENUE_DEFS.map((d) => ({
                name: d.name,
                type: 'bar' as const,
                stack: 'revenue',
                barMaxWidth: 18,
                itemStyle: { color: p[d.token] },
                data: points.value.map((pt) => pt.metrics.revenueByType[d.key]),
            })),
        };
    });

    /** 成本八科目堆叠柱 */
    const costTrendOption = computed<EChartsOption>(() => {
        const p = palette();
        return {
            grid: { left: 58, right: 16, top: 34, bottom: 26 },
            tooltip: axisTooltip(),
            legend: { ...legendBase(), type: 'scroll' as const, data: COST_DEFS.map((d) => d.name) },
            xAxis: categoryAxis(trendLabels.value),
            yAxis: wanValueAxis(),
            series: COST_DEFS.map((d) => ({
                name: d.name,
                type: 'bar' as const,
                stack: 'cost',
                barMaxWidth: 18,
                itemStyle: { color: alpha(p[d.token], d.alpha) },
                data: points.value.map((pt) => pt.metrics.costByType[d.key]),
            })),
        };
    });
</script>

<style scoped lang="scss">
    .rcs {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-width: 0;
        min-height: 0;
    }

    /* ---------- 收入 / 成本：左右两张卡 ---------- */
    .rcs__split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--oa-gap);
        align-items: stretch;
        min-width: 0;
    }

    .rcs__split > * {
        min-width: 0;
        min-height: 0;
    }

    .rcs__block {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        min-height: 0;
    }

    /* ---------- 占比小表 ---------- */
    .rcs__list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .rcs__row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 3px 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.5;
        color: var(--oa-text-2);
    }

    .rcs__row--group {
        border-top: 1px solid var(--oa-border-light);

        &:first-child {
            border-top: 0;
        }
    }

    .rcs__row--leaf {
        padding-left: 8px;
        color: var(--oa-text-3);
    }

    .rcs__dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .rcs__row--leaf .rcs__dot {
        width: 6px;
        height: 6px;
    }

    .rcs__label {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .rcs__row--group .rcs__label {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .rcs__track {
        flex: 1 1 40px;
        min-width: 30px;
    }

    .rcs__track :deep(.el-progress) {
        width: 100%;
    }

    .rcs__amount {
        flex: 0 0 auto;
        color: var(--oa-text-1);
    }

    .rcs__share {
        flex: 0 0 42px;
        text-align: right;
        color: var(--oa-text-3);
    }

    /* ---------- 收入口径对照 ---------- */
    .rcs__recon {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        padding: 6px 8px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        b {
            font-weight: 600;
            color: var(--oa-text-1);
        }
    }

    /* ---------- 口径说明 ---------- */
    .rcs__note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }

    .rcs__note--foot {
        margin-top: 8px;
    }

    /* ---------- 趋势：两个并排堆叠柱（窄容器自动降为上下排列） ---------- */
    .rcs__trends {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: var(--oa-gap);
        min-width: 0;
    }

    .rcs__trend {
        min-width: 0;
    }

    .rcs__trend-cap {
        margin: 0 0 2px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }
</style>
