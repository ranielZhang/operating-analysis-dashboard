<template>
    <PanelCard
        title="Cohort 投放回收分析"
        subtitle="每个月的投放当成一个 cohort，跟踪其投放后累计回收 ROI"
    >
        <template #actions>
            <el-radio-group v-model="gameScope" size="small">
                <el-radio-button value="all">全部游戏</el-radio-button>
                <el-radio-button value="key">仅重点游戏</el-radio-button>
                <el-radio-button value="slow">仅亏损曲线游戏</el-radio-button>
            </el-radio-group>
        </template>

        <div v-if="!rows.length" class="cohort-empty">
            <PanelEmptyState text="当前筛选条件下近 8 期无投放数据，无法构建 Cohort 回收曲线" />
        </div>

        <div v-else class="cohort-grid">
            <!-- 1. 多 cohort 回收曲线 -->
            <section class="blk">
                <div class="blk__title">投放后累计回收 ROI 曲线</div>
                <EChart :option="mainOption" style="height: 320px" />
            </section>

            <!-- 2. 关键节点对比 -->
            <section class="blk">
                <div class="blk__title">
                    各 cohort 关键节点 ROI 对比
                    <span class="blk__hint">绿 = 高于回本线 1.0，红 = 未回本</span>
                </div>
                <EChart :option="barOption" style="height: 240px" />
            </section>

            <!-- 3 + 4. 明细表 & 曲线参数对照 -->
            <div class="split">
                <section class="blk">
                    <div class="blk__title">
                        Cohort 回收明细
                        <span class="blk__hint">回本天数按 D30 粒度线性插值估算</span>
                    </div>
                    <el-table
                        :data="rows"
                        size="small"
                        max-height="300"
                        show-overflow-tooltip
                        :default-sort="{ prop: 'cohortMonth', order: 'descending' }"
                    >
                        <el-table-column prop="cohortMonth" label="投放月" min-width="92" fixed sortable />
                        <el-table-column label="投放消耗" align="right" min-width="96">
                            <template #header>
                                <el-tooltip
                                    content="该 cohort 整月投放消耗；当月（数据截止日所在月）为不完整月，消耗天然偏低"
                                    placement="top"
                                >
                                    <span>投放消耗</span>
                                </el-tooltip>
                            </template>
                            <template #default="{ row }">
                                <span class="oa-num">{{ money(row.spend) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="D90 ROI" align="right" min-width="84">
                            <template #default="{ row }">
                                <span class="oa-num" :class="trendClass(row.roi90 - 1)">{{ ratio(row.roi90) }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="D180 ROI" align="right" min-width="96">
                            <template #default="{ row }">
                                <span class="oa-num" :class="trendClass(row.roi180 - 1)">{{ ratio(row.roi180) }}</span>
                                <el-tag v-if="row.p180" size="small" type="info" class="mini-tag">预估</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="D360 ROI" align="right" min-width="96">
                            <template #default="{ row }">
                                <span class="oa-num" :class="trendClass(row.roi360 - 1)">{{ ratio(row.roi360) }}</span>
                                <el-tag v-if="row.p360" size="small" type="info" class="mini-tag">预估</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="预计回本天数" align="right" min-width="106">
                            <template #default="{ row }">
                                <template v-if="row.paybackDay !== null">
                                    <span class="oa-num">{{ row.paybackDay }}</span>
                                    <span class="unit">天</span>
                                </template>
                                <el-tooltip v-else content="D30~D360 区间内累计 ROI 始终低于 1.0，尚未回本" placement="top">
                                    <el-tag size="small" type="danger">未回本</el-tag>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column label="回收完成度" align="right" min-width="100">
                            <template #default="{ row }">
                                <el-tooltip content="口径：D360 累计 ROI ÷ 1.4（引擎按 D1≈17%、D90≈112%、D360≈141% 校准的 360 日参考目标）" placement="top">
                                    <span class="oa-num">{{ percent(row.completion) }}</span>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column label="状态" min-width="80" align="center">
                            <template #default="{ row }">
                                <el-tag size="small" :type="statusOf(row.roi180).tone">{{ statusOf(row.roi180).text }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="状态依据" min-width="150" show-overflow-tooltip>
                            <template #default="{ row }">
                                <span class="blk__hint">D180 ROI {{ ratio(row.roi180) }}：≥1.15 健康 / 1.0~1.15 持平 / &lt;1.0 未回本</span>
                            </template>
                        </el-table-column>
                    </el-table>
                </section>

                <section class="blk">
                    <div class="blk__title">回收曲线参数对照（curveA / curveB）</div>
                    <div class="dist">
                        <div class="dist__item">
                            <div class="dist__head">
                                <span class="dist__name">回收最快曲线</span>
                                <span class="dist__cap">最高 3 个游戏 · D360 ROI</span>
                            </div>
                            <ul class="dist__list">
                                <li v-for="item in topCurves" :key="item.id">
                                    <span class="dist__label">{{ item.name }}</span>
                                    <span class="oa-num dist__val dist__val--up">{{ ratio(item.roi360) }}</span>
                                    <span class="oa-num dist__param">a {{ item.curveA.toFixed(2) }} / b {{ item.curveB.toFixed(2) }}</span>
                                </li>
                            </ul>
                        </div>
                        <div class="dist__item">
                            <div class="dist__head">
                                <span class="dist__name">回收最慢曲线</span>
                                <span class="dist__cap">最低 3 个游戏 · D360 ROI</span>
                            </div>
                            <ul class="dist__list">
                                <li v-for="item in bottomCurves" :key="item.id">
                                    <span class="dist__label">{{ item.name }}</span>
                                    <span class="oa-num dist__val dist__val--down">{{ ratio(item.roi360) }}</span>
                                    <span class="oa-num dist__param">a {{ item.curveA.toFixed(2) }} / b {{ item.curveB.toFixed(2) }}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <p class="note">
                        不同游戏的回收曲线不同（<span class="oa-num">roiAt(360, curveA, curveB)</span> 相差可达 2 倍），
                        因此每个月的 cohort 曲线是「该月各游戏按投放消耗加权的合成曲线」，不是某一条单游戏曲线。
                    </p>
                </section>
            </div>

            <!-- 5. 一句话结论 -->
            <section class="conclusion">
                <span class="conclusion__tag">结论</span>
                <span class="conclusion__text">{{ conclusion }}</span>
            </section>
            <p v-if="scopeNote" class="scope-note">{{ scopeNote }}</p>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import EChart from '@/components/EChart.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAMES, GAME_MAP, TODAY } from '@/domain/dimensions';
    import { RECOVERY_MAX_DAY, dayIndexOf, roiAt, store } from '@/domain/store';
    import type { CohortPoint } from '@/domain/types';
    import { money, percent, ratio, trendClass } from '@/utils/format';

    /**
     * M9 · Cohort 回收曲线
     *
     * 口径说明
     *  1) 买量成本在投放当天一次性发生，收入在未来 90~360 天陆续回流，所以「某月投放到底回收得怎么样」
     *     必须用同期群（Cohort）视角：把每个投放月当成一个 cohort，跟踪它投放后第 30/60/…/360 天的累计 ROI。
     *  2) ROI 沿用现有系统口径 = 累计回收收入 / 累计消耗（含本金，1.0 = 回本），与 store 头部注释一致。
     *  3) 引擎的回收曲线是 ROI(n) = curveA·ln(n) + curveB，n = 投放后天数。cohort 曲线的 a/b 是
     *     该 cohort 内所有投放组合按消耗加权的合成参数（见 store.buildCohorts）。
     *  4) projected = true 表示该点落在数据截止日（2026-06-18）之后，属于曲线外推，图上用虚线区分。
     */

    defineOptions({ name: 'ForecastCohortRecovery' });

    const { filter } = useAnalysisFilter();

    /** cohort 曲线口径所用的「D360 参考目标 ROI」，来自引擎校准结果（D1≈17% / D90≈112% / D360≈141%） */
    const TARGET_ROI_360 = 1.4;
    /** 近 8 期投放 */
    const COHORT_COUNT = 8;

    /** 颜色：按 cohort 时间从旧到新做色相渐变（旧 = 蓝灰，新 = 亮蓝/紫） */
    const GRADIENT = ['#94a3b8', '#7c9cc4', '#5b8ad4', '#4d94fa', '#6f7ff0', '#8b5cf6', '#a855f7', '#c084fc'];
    /** 关键节点三根柱：D90 / D180 / D360 —— 同一语义（高于/低于回本线）用绿/红深浅三档区分窗口 */
    const BAR_COLORS = ['#fca5a5', '#f87171', '#dc2626'];
    const BAR_COLORS_OK = ['#6ee7b7', '#34d399', '#10b981'];

    type GameScope = 'all' | 'key' | 'slow';
    const gameScope = ref<GameScope>('all');

    // ---------- 取数 ----------
    /** 近 8 期 cohort 曲线点（每 30 天一个点，含 projected 标记） */
    const baseCohorts = computed<CohortPoint[]>(() => store.cohorts(filter, COHORT_COUNT));

    /** 游戏维度行（当前筛选范围内），用于组件内 gameScope 过滤与曲线参数对照 */
    const gameRows = computed(() => store.queryRows(filter, 'game'));

    /** 当前范围内全部游戏消耗合计（组件内游戏过滤时用于折算 cohort 消耗） */
    const totalGameSpend = computed(() => gameRows.value.reduce((s, r) => s + r.spend, 0));

    /** 公司合成曲线参数：全部游戏按当前范围消耗加权（同时作为「亏损曲线游戏」的判定基准） */
    const compositeA = computed(() => {
        const t = totalGameSpend.value;
        return t > 0 ? gameRows.value.reduce((s, r) => s + r.spend * (GAME_MAP.get(r.key)?.curveA ?? 0), 0) / t : 0;
    });
    const compositeB = computed(() => {
        const t = totalGameSpend.value;
        return t > 0 ? gameRows.value.reduce((s, r) => s + r.spend * (GAME_MAP.get(r.key)?.curveB ?? 0), 0) / t : 0;
    });

    /**
     * 组件内游戏口径（只影响本组件展示，不回写全局 filter.gameIds）：
     *  - key  ：GAMES 里 keyGame = true 的重点游戏
     *  - slow ：拖累回收的「亏损曲线游戏」= D360 累计 ROI 低于公司合成曲线（全部游戏按消耗加权的 D360 ROI）的游戏。
     *           判定用 D360 累计 ROI 而不是单看 curveA —— ROI(n) = a·ln(n) + b，同一个 a 配不同 b，
     *           D360 结果最多差 2 倍，只有 D360 ROI 才是业务口径的「回收好坏」。
     *           当前数据下该组 D360 ROI ≈ 1.14，明显低于全部游戏的 ≈ 1.40。
     */
    const scopedGameIds = computed<Set<string> | null>(() => {
        if (gameScope.value === 'all') return null;
        const composite = roiAt(RECOVERY_MAX_DAY, compositeA.value, compositeB.value);
        const list = GAMES.filter((g) =>
            gameScope.value === 'key' ? g.keyGame : roiAt(RECOVERY_MAX_DAY, g.curveA, g.curveB) < composite,
        );
        return new Set(list.map((g) => g.id));
    });

    interface CohortSeries {
        cohortMonth: string;
        /** 是否发生过游戏维度的组件内过滤（此时 spend 为按消耗占比的近似拆分） */
        filtered: boolean;
        spend: number;
        /** 该 cohort 的加权曲线参数 */
        a: number;
        b: number;
        points: Array<{ day: number; roi: number; projected: boolean }>;
    }

    const cohorts = computed<CohortSeries[]>(() => {
        const scope = scopedGameIds.value;
        // 组件内游戏过滤时，按「所辖游戏在当前范围内各游戏的消耗占比」把 cohort 消耗拆出来重新加权。
        // 说明：引擎没有开放「游戏 × 月份」的消耗接口，这里只能做到同比例拆分，
        // 因此加权曲线参数是精确的，spend 的拆分是近似口径（图表上标注「游戏过滤口径」）。
        const subGames = scope ? gameRows.value.filter((r) => scope.has(r.key) && r.spend > 0) : [];
        const subTotal = subGames.reduce((s, r) => s + r.spend, 0);
        const active = scope !== null && subTotal > 0;

        const base = baseCohorts.value;
        const months = [...new Set(base.map((p) => p.cohortMonth))];
        const out: CohortSeries[] = [];

        for (const cohortMonth of months) {
            const pts = base.filter((p) => p.cohortMonth === cohortMonth).sort((x, y) => x.day - y.day);
            if (!pts.length) continue;
            const baseSpend = pts[0].spend;
            // D30 / D90 两个点即可反解曲线参数：a = (roi1 − roi2) / (ln n1 − ln n2)，b = roi − a·ln n
            const roi30 = pts.find((p) => p.day === 30)?.roi ?? pts[0].roi;
            const roi90 = pts.find((p) => p.day === 90)?.roi ?? pts[pts.length - 1].roi;
            let a = (roi30 - roi90) / (Math.log(30) - Math.log(90));
            let b = roi90 - a * Math.log(90);
            let spend = baseSpend;
            let filtered = false;

            if (active) {
                let wa = 0;
                let wb = 0;
                for (const r of subGames) {
                    const meta = GAME_MAP.get(r.key);
                    if (!meta) continue;
                    wa += r.spend * meta.curveA;
                    wb += r.spend * meta.curveB;
                }
                a = wa / subTotal;
                b = wb / subTotal;
                spend = Math.round(baseSpend * (subTotal / totalGameSpend.value));
                filtered = true;
            }
            if (spend <= 0) continue;

            out.push({
                cohortMonth,
                filtered,
                spend,
                a,
                b,
                points: pts.map((p) => ({
                    day: p.day,
                    roi: roiAt(p.day, a, b),
                    projected: isProjected(cohortMonth, p.day, p.projected),
                })),
            });
        }
        out.sort((x, y) => (x.cohortMonth < y.cohortMonth ? -1 : 1));
        return out;
    });

    const colorOf = (i: number): string => GRADIENT[i % GRADIENT.length];

    /**
     * 数据截止日的全局天数下标（与 store 内部口径一致：DAY_COUNT = 数据起点 → 今日的天数）。
     * 用于判定某个 cohort 的第 n 天是否已「跑出可观测区间」，从而决定点要不要画成虚线/标「预估」。
     */
    const DATA_CUTOFF_DAY = dayIndexOf(TODAY) + 1;

    /** 某 cohort 第 n 天对应的全局天数下标 */
    function targetDayIndex(cohortMonth: string, n: number): number {
        return dayIndexOf(`${cohortMonth}-01`) + n;
    }

    /**
     * store 的 cohort 点自带 projected 标记（targetDay >= DAY_COUNT 即视为外推），
     * 我们按「该 cohort 的第 n 天是否已越过数据截止日」重新核对一遍：
     * 部分 cohort 的自然点（如末月的 D180）实际已跑完，不该再标预估。
     */
    function isProjected(cohortMonth: string, day: number, fallback: boolean): boolean {
        const t = targetDayIndex(cohortMonth, day);
        return t >= 0 ? t >= DATA_CUTOFF_DAY : fallback;
    }

    /**
     * 预计回本天数：找曲线首次 roi >= 1.0 的天数。
     * 引擎曲线 ROI(n) = a·ln(n) + b 在 n>0 区间单调递增，故解析解为 n = exp((1 − b) / a)；
     * 这里按要求改用数值扫描（1 → RECOVERY_MAX_DAY 天）配合 30 天粒度点做线性插值：
     *   1) 在 D30~D360 的自然点上找第一个 roi >= 1 的点；
     *   2) 若首点 D30 就已回本，说明回本日早于首个观测点，回退解析解 exp((1 − b) / a)；
     *   3) 否则在上一个点与该点之间按 ROI 线性插值定位回本日；
     *   4) 扫描到 RECOVERY_MAX_DAY 仍未回本 → null（展示为「未回本」）。
     */
    function paybackDayOf(c: CohortSeries): number | null {
        const pts = c.points;
        if (!pts.length) return null;
        let hitIdx = -1;
        for (let n = 1; n <= RECOVERY_MAX_DAY; n++) {
            if (roiAt(n, c.a, c.b) >= 1) {
                // 引擎每天一个 30 天点位，首个 roi ≥ 1 的观测点即为 hitIdx
                hitIdx = pts.findIndex((p) => p.day >= n);
                break;
            }
        }
        if (hitIdx < 0) return null;
        const hit = pts[hitIdx];
        if (hitIdx === 0) {
            // 首点 D30 就已回本 → 回本日早于首个观测点，回退解析解 n = exp((1 − b) / a)
            const analytic = Math.exp((1 - c.b) / (c.a || 1));
            return Math.max(1, Math.round(Math.min(analytic, RECOVERY_MAX_DAY)));
        }
        const prev = pts[hitIdx - 1];
        const span = hit.roi - prev.roi;
        const t = span > 0 ? (1 - prev.roi) / span : 0;
        return Math.round(prev.day + (hit.day - prev.day) * Math.min(1, Math.max(0, t)));
    }

    interface CohortRow {
        cohortMonth: string;
        spend: number;
        roi90: number;
        roi180: number;
        roi360: number;
        p180: boolean;
        p360: boolean;
        paybackDay: number | null;
        /** 回收完成度 = D360 累计 ROI ÷ 参考目标 1.4 */
        completion: number;
    }

    const rows = computed<CohortRow[]>(() =>
        cohorts.value
            .map((c) => {
                const at = (day: number): { roi: number; projected: boolean } =>
                    c.points.find((p) => p.day === day) ?? { roi: roiAt(day, c.a, c.b), projected: true };
                const d90 = at(90);
                const d180 = at(180);
                const d360 = at(360);
                return {
                    cohortMonth: c.cohortMonth,
                    spend: c.spend,
                    roi90: d90.roi,
                    roi180: d180.roi,
                    roi360: d360.roi,
                    p180: d180.projected,
                    p360: d360.projected,
                    paybackDay: paybackDayOf(c),
                    completion: d360.roi / TARGET_ROI_360,
                };
            })
            .sort((x, y) => (x.cohortMonth < y.cohortMonth ? 1 : -1)),
    );

    // ---------- 图表 1：多 cohort 回收曲线 ----------
    const DAYS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];
    const DAY_LABELS = DAYS.map((d) => `D${d}`);
    /** 合成平均曲线的固定图例名（首个 series + 图例首项，便于和单期 cohort 区分） */
    const AVG_NAME = '加权平均';

    const mainOption = computed<EChartsOption>(() => {
        const series: NonNullable<EChartsOption['series']> = [];
        const legend: string[] = [];

        // 各 cohort 的消耗加权平均曲线（完全由下面的 cohort 曲线合成，非另起数据源）——
        // 8 条同色系曲线单独看可读性有限，先放一条深色加粗的合成曲线给出整体回收节奏
        const totalSpend = cohorts.value.reduce((s, c) => s + c.spend, 0);
        if (totalSpend > 0) {
            const wa = cohorts.value.reduce((s, c) => s + c.spend * c.a, 0) / totalSpend;
            const wb = cohorts.value.reduce((s, c) => s + c.spend * c.b, 0) / totalSpend;
            legend.push(AVG_NAME);
            series.push({
                name: AVG_NAME,
                type: 'line',
                data: DAYS.map((d) => Number(roiAt(d, wa, wb).toFixed(4))),
                smooth: false,
                symbolSize: 6,
                z: 5,
                lineStyle: { width: 3, color: '#334155' },
                itemStyle: { color: '#334155' },
                emphasis: { focus: 'series' },
            });
        }

        cohorts.value.forEach((c, i) => {
            const color = colorOf(i);
            const actual: Array<number | null> = [];
            const projected: Array<number | null> = [];
            c.points.forEach((p, k) => {
                if (p.projected) {
                    actual.push(null);
                    // 虚线前补一个实线末点做衔接，同时避免虚线回到 0
                    if (k > 0 && !c.points[k - 1].projected) projected.push(c.points[k - 1].roi);
                    else projected.push(null);
                    projected.push(p.roi);
                } else {
                    actual.push(p.roi);
                    projected.push(null);
                }
            });
            legend.push(c.cohortMonth);
            series.push({
                name: c.cohortMonth,
                type: 'line',
                data: actual,
                smooth: false,
                symbolSize: 4,
                connectNulls: false,
                lineStyle: { width: 1.6, color, opacity: 0.9 },
                itemStyle: { color },
                emphasis: { focus: 'series' },
                // 回本线只挂第一条曲线，避免重复渲染
                markLine:
                    i === 0
                        ? {
                              silent: true,
                              symbol: 'none',
                              data: [{ yAxis: 1 }],
                              lineStyle: { type: 'dashed', color: '#94a3b8', width: 1 },
                              label: {
                                  formatter: '回本线 ROI = 1.0',
                                  position: 'insideEndTop',
                                  color: '#94a3b8',
                                  fontSize: 11,
                              },
                          }
                        : undefined,
            });
            series.push({
                name: c.cohortMonth,
                type: 'line',
                data: projected,
                smooth: false,
                symbolSize: 4,
                symbol: 'emptyCircle',
                connectNulls: false,
                lineStyle: { width: 1.6, type: 'dashed', color, opacity: 0.9 },
                itemStyle: { color },
                emphasis: { focus: 'series' },
            });
        });

        return {
            grid: { left: 56, right: 24, top: 38, bottom: 28 },
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v) => (v === null || v === undefined || v === '' ? '—' : ratio(Number(v))),
            },
            // 每个 cohort 有实线 / 虚线两条同名 series，只让实线进图例
            legend: {
                data: legend,
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
            },
            xAxis: {
                type: 'category',
                data: DAY_LABELS,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                splitNumber: 5,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}x` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series,
        };
    });

    // ---------- 图表 2：关键节点分组柱 ----------
    const barOption = computed<EChartsOption>(() => {
        const months = rows.value.map((r) => r.cohortMonth);
        const pick = (key: 'roi90' | 'roi180' | 'roi360') => rows.value.map((r) => Number(r[key].toFixed(4)));
        const mk = (name: string, key: 'roi90' | 'roi180' | 'roi360', idx: number) => ({
            name,
            type: 'bar' as const,
            data: pick(key),
            barMaxWidth: 14,
            itemStyle: {
                borderRadius: [2, 2, 0, 0] as [number, number, number, number],
                // 高于回本线用绿、低于用红
                color: (p: { value: unknown }) => {
                    const v = Number(p.value);
                    return Number.isFinite(v) && v >= 1 ? BAR_COLORS_OK[idx] : BAR_COLORS[idx];
                },
            },
        });

        return {
            grid: { left: 56, right: 24, top: 38, bottom: 28 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v) => (v === null || v === undefined || v === '' ? '—' : ratio(Number(v))),
            },
            legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 11 } },
            xAxis: {
                type: 'category',
                data: months,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                splitNumber: 4,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}x` },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series: [
                {
                    ...mk('D90', 'roi90', 0),
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        data: [{ yAxis: 1 }],
                        lineStyle: { type: 'dashed', color: '#94a3b8', width: 1 },
                        label: { formatter: '回本线 1.0', position: 'insideEndTop', color: '#94a3b8', fontSize: 11 },
                    },
                },
                mk('D180', 'roi180', 1),
                mk('D360', 'roi360', 2),
            ],
        };
    });

    // ---------- 曲线参数对照 ----------
    interface CurveItem {
        id: string;
        name: string;
        curveA: number;
        curveB: number;
        roi360: number;
    }
    const curveList = computed<CurveItem[]>(() =>
        GAMES.map((g) => ({
            id: g.id,
            name: g.name,
            curveA: g.curveA,
            curveB: g.curveB,
            roi360: roiAt(360, g.curveA, g.curveB),
        })).sort((x, y) => y.roi360 - x.roi360),
    );
    const topCurves = computed(() => curveList.value.slice(0, 3));
    const bottomCurves = computed(() => curveList.value.slice(-3).reverse());

    // ---------- 状态与结论 ----------
    function statusOf(roi180: number): { text: string; tone: 'success' | 'warning' | 'danger' } {
        if (roi180 >= 1.15) return { text: '健康', tone: 'success' };
        if (roi180 >= 1) return { text: '持平', tone: 'warning' };
        return { text: '未回本', tone: 'danger' };
    }

    const conclusion = computed<string>(() => {
        const list = rows.value;
        if (!list.length) return '当前筛选条件下暂无可分析的 cohort。';

        let best = list[0];
        let worst = list[0];
        let projectedCount = 0;
        const paybacks: number[] = [];
        for (const r of list) {
            if (r.roi180 > best.roi180) best = r;
            if (r.roi180 < worst.roi180) worst = r;
            if (r.p360) projectedCount += 1;
            if (r.paybackDay !== null) paybacks.push(r.paybackDay);
        }

        const scopeText =
            gameScope.value === 'all'
                ? ''
                : gameScope.value === 'key'
                  ? '（仅重点游戏口径）'
                  : '（仅亏损曲线游戏口径）';
        const head = `近 ${list.length} 期投放中，${best.cohortMonth} 期回收最健康（D180 ROI ${ratio(best.roi180)}）`;
        const tail =
            worst.roi180 < 1
                ? `，${worst.cohortMonth} 期偏弱（D180 ROI ${ratio(worst.roi180)}，尚未回本）`
                : `，${worst.cohortMonth} 期相对偏弱（D180 ROI ${ratio(worst.roi180)}）`;

        const projectedText = projectedCount
            ? `。其中 ${projectedCount} 期的 D360 已越过数据截止日（当月仅到第 ${store.daysElapsed} 天），D90 及以后为曲线外推值，随实际回收会持续修正`
            : '；全部 cohort 均已落在可观测区间内，曲线为实测口径';

        const paybackText = paybacks.length
            ? `。按 D30 粒度插值估算，回本周期集中在 ${Math.min(...paybacks)}~${Math.max(...paybacks)} 天`
            : '。按当前曲线外推，观测区间内（≤365 天）仍未回本，需重点关注止损节奏';

        return head + tail + scopeText + projectedText + paybackText + '。';
    });

    /** 组件内游戏过滤为近似口径时的说明（图表/表格均使用该口径） */
    const scopeNote = computed<string>(() => {
        if (gameScope.value === 'all') return '';
        if (!cohorts.value.length || !cohorts.value[0].filtered) return '';
        const label = gameScope.value === 'key' ? '重点游戏' : '亏损曲线游戏';
        return `当前为「${label}」口径：曲线参数按所选游戏在当前筛选范围内的消耗加权精确合成；但由于引擎未开放「游戏 × 月份」的消耗接口，各 cohort 的消耗额是按游戏消耗占比同比例折算的近似值，故细节以曲线形状为准。`;
    });
</script>

<style scoped lang="scss">
    .cohort-empty {
        height: 240px;
    }

    .cohort-grid {
        display: grid;
        gap: var(--oa-gap);
        min-height: 0;
    }

    .blk {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        min-height: 0;
        padding: 10px 12px 12px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        background: var(--oa-card);
    }

    .blk__title {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .blk__hint {
        font-size: var(--oa-fs-xs);
        font-weight: 400;
        color: var(--oa-text-4);
    }

    .split {
        display: grid;
        grid-template-columns: minmax(560px, 1.6fr) minmax(300px, 1fr);
        gap: var(--oa-gap);
        min-height: 0;

        @media (max-width: 1280px) {
            grid-template-columns: 1fr;
        }
    }

    .mini-tag {
        margin-left: 4px;
        transform: scale(0.88);
    }

    .unit {
        margin-left: 2px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .dist {
        display: flex;
        flex-wrap: wrap;
        gap: var(--oa-gap);
    }

    .dist__item {
        flex: 1 1 190px;
        min-width: 0;
        padding: 8px 10px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
    }

    .dist__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
    }

    .dist__name {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .dist__cap {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .dist__list {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            align-items: baseline;
            gap: 8px;
            padding: 3px 0;
            font-size: var(--oa-fs-xs);
        }
    }

    .dist__label {
        flex: 1 1 auto;
        min-width: 0;
        color: var(--oa-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dist__val {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .dist__val--up {
        color: var(--oa-success);
    }

    .dist__val--down {
        color: var(--oa-danger);
    }

    .dist__param {
        color: var(--oa-text-4);
    }

    .note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-3);
        border-left: 2px solid var(--oa-primary);
        padding-left: 8px;
    }

    .conclusion {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        background: var(--oa-primary-soft);
    }

    .conclusion__tag {
        flex: 0 0 auto;
        padding: 1px 8px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary);
        color: #fff;
        font-size: var(--oa-fs-xs);
        line-height: 18px;
    }

    .conclusion__text {
        font-size: var(--oa-fs-sm);
        line-height: 20px;
        color: var(--oa-text-1);
    }

    .scope-note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }
</style>
