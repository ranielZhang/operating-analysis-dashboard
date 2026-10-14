<template>
    <PanelCard title="曲线形状对比图" subtitle="同一组锚点（D90 / D360）下，对数形态与幂律形态的形状差异">
        <template #actions>
            <el-radio-group v-model="shape" size="small">
                <el-radio-button value="log">对数曲线 a·ln(n)+b</el-radio-button>
                <el-radio-button value="power">幂律曲线 p·n^q</el-radio-button>
            </el-radio-group>
        </template>

        <PanelEmptyState v-if="!curveTargets.length" text="当前筛选条件下暂无可对比的投放曲线" />
        <EChart v-else :option="option" style="height: 360px" />

        <p class="ccc__note">
            <span class="ccc__dot ccc__dot--log" />对数（当前采用）
            <span class="ccc__dot ccc__dot--power" />幂律（对照）
            <span class="ccc__sep">|</span>
            横轴 = 投放后天数，纵轴 = <b>累计</b>回收 ROI（倍数，1.0 = 回本）。
            <b>两条曲线的差距在 D30 前最明显</b>：此时幂律已爬升到较高水位、对数还在半坡——这段差距直接决定了当月预估的激进程度
            （用幂律形态做预估，当月应确认收入会明显更高、回本看起来更快）。因此曲线形态的选择，本质上是在选「预估的保守程度」。
        </p>

        <p class="ccc__calc">
            <b>取数口径：</b>曲线按 <code>roiAt(n, curveA, curveB)</code> 逐点求值；「全公司加权平均」= 各游戏 curveA / curveB 按其<b>当前筛选范围内的投放消耗</b>加权
            （curveA、curveB 均为线性参数，消耗加权后可等价为一条公司级曲线）；「ROI 最高 / 最低」按筛选范围内的<b>累计预估 ROI</b> 选出，对应图表中按曲线口径展示的两条代表线。
            实际使用的各游戏参数见上方「回收曲线参数表」。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAME_MAP } from '@/domain/dimensions';
    import { store, fitPower, roiAt, roiAtPower } from '@/domain/store';
    import { ratio } from '@/utils/format';

    /**
     * 区块 3 · 曲线形状对比图（高 360px）
     * 默认 4 条曲线：ROI 最高游戏 / ROI 最低游戏 / 全公司按消耗加权平均 / 目标线（水平 1.0）
     * 幂律参数由 fitPower(90, roiAt(90), 360, roiAt(360)) 拟合，即「同一组锚点下两种形态的差异」。
     */
    defineOptions({ name: 'SettingsCurveCompareChart' });

    const { filter } = useAnalysisFilter();

    /** 曲线形态：对数（当前系统） / 幂律（对照） */
    const shape = ref<'log' | 'power'>('log');

    /** X 轴天数刻度（业务关注的回收节点） */
    const DAYS = [1, 3, 7, 14, 30, 60, 90, 120, 180, 270, 360];
    const DAY_LABELS = DAYS.map((d) => `D${d}`);

    /** 当前筛选范围下的游戏行（来自 store 聚合） */
    const gameRows = computed(() => store.queryRows(filter, 'game'));

    /** 参与对比的游戏：ROI 最高 / 最低（筛选范围内有消耗） */
    const curveTargets = computed(() => {
        const list = gameRows.value.filter((r) => r.spend > 0 && GAME_MAP.has(r.key));
        if (!list.length) return [];
        const sorted = [...list].sort((a, b) => b.forecastRoi - a.forecastRoi);
        const high = sorted[0];
        const low = sorted[sorted.length - 1];
        const picks = high.key === low.key ? [high] : [high, low];
        return picks.map((row, i) => {
            const meta = GAME_MAP.get(row.key);
            return {
                key: row.key,
                role: i === 0 ? 'ROI 最高' : 'ROI 最低',
                name: row.name,
                curveA: meta?.curveA ?? 0,
                curveB: meta?.curveB ?? 0,
                spend: row.spend,
                color: i === 0 ? '#12b566' : '#fd6464',
            };
        });
    });

    /** 全公司按消耗加权平均曲线（权重 = 各游戏在筛选范围内的投放消耗） */
    const weightedAvg = computed(() => {
        let spend = 0;
        let aSum = 0;
        let bSum = 0;
        for (const row of gameRows.value) {
            const meta = GAME_MAP.get(row.key);
            if (!meta || row.spend <= 0) continue;
            spend += row.spend;
            aSum += meta.curveA * row.spend;
            bSum += meta.curveB * row.spend;
        }
        if (spend <= 0) return null;
        return { curveA: aSum / spend, curveB: bSum / spend, spend };
    });

    /** 幂律拟合参数：用对数曲线在 D90 / D360 两点反推 */
    function powerOf(a: number, b: number): { p: number; q: number } {
        return fitPower(90, roiAt(90, a, b), 360, roiAt(360, a, b));
    }

    interface CurveSeries {
        name: string;
        color: string;
        /** [对数形态数据, 幂律形态数据] */
        data: [number[], number[]];
    }

    /** 组装曲线：顺序 = 加权平均 → ROI 最高 → ROI 最低 */
    const series = computed<CurveSeries[]>(() => {
        const out: CurveSeries[] = [];
        const push = (name: string, color: string, a: number, b: number) => {
            const fit = powerOf(a, b);
            out.push({
                name,
                color,
                data: [DAYS.map((d) => roiAt(d, a, b)), DAYS.map((d) => roiAtPower(d, fit.p, fit.q))],
            });
        };
        const avg = weightedAvg.value;
        if (avg) push('全公司加权平均（按消耗）', '#4d94fa', avg.curveA, avg.curveB);
        curveTargets.value.forEach((t) => push(`${t.role}：${t.name}`, t.color, t.curveA, t.curveB));
        return out;
    });

    function fmt(v: number | undefined): string {
        return v === undefined ? '—' : `${ratio(v)} 倍`;
    }

    const option = computed<EChartsOption>(() => {
        const mode: 0 | 1 = shape.value === 'log' ? 0 : 1;
        const list = series.value;

        const makeSeries = (m: 0 | 1) =>
            list.map((s) => ({
                name: s.name,
                type: 'line' as const,
                smooth: false,
                symbolSize: 5,
                lineStyle: {
                    width: m === 0 ? 2.4 : 2,
                    type: (m === 0 ? 'solid' : 'dashed') as 'solid' | 'dashed',
                },
                itemStyle: { color: s.color },
                emphasis: { focus: 'series' as const },
                data: s.data[m],
                // 非当前形态的曲线在切换时保持不显示（图例仍可手动开关）
                selected: m === mode,
            }));

        return {
            grid: { left: 56, right: 24, top: 40, bottom: 30 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'line' },
                formatter: (params: unknown) => {
                    const arr = (Array.isArray(params) ? params : [params]) as Array<{ axisValue?: string }>;
                    const idx = DAY_LABELS.indexOf(String(arr[0]?.axisValue ?? ''));
                    const day = idx >= 0 ? DAYS[idx] : 0;
                    const lines = [`<b>投放后第 ${day} 天</b>`];
                    for (const s of list) {
                        lines.push(
                            `${s.name}<br/>&nbsp;&nbsp;对数 ${fmt(s.data[0][idx])} · 幂律 ${fmt(s.data[1][idx])}`,
                        );
                    }
                    lines.push('<span style="color:#9ca3af">目标线：1.00 倍（回本）</span>');
                    return lines.join('<br/>');
                },
            },
            legend: {
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: '#64748b', fontSize: 11 },
                data: [...list.map((s) => s.name), '目标线：回本 1.0 倍'],
            },
            xAxis: {
                type: 'category',
                data: DAY_LABELS,
                name: '投放后天数',
                nameGap: 22,
                nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                axisTick: { show: false },
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                name: '累计 ROI（倍）',
                nameTextStyle: { color: '#94a3b8', fontSize: 11 },
                splitNumber: 5,
                axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => v.toFixed(2) },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
            },
            series: [
                ...makeSeries(0),
                ...makeSeries(1),
                {
                    name: '目标线：回本 1.0 倍',
                    type: 'line',
                    data: DAYS.map(() => 1),
                    symbol: 'none',
                    lineStyle: { width: 1.5, type: 'dotted', color: '#ff9140' },
                    itemStyle: { color: '#ff9140' },
                    tooltip: { show: false },
                },
            ],
        };
    });
</script>

<style scoped lang="scss">
    .ccc__note {
        margin: 10px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-2);
        }
    }

    .ccc__dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin: 0 4px 1px 10px;
        border-radius: 50%;
    }

    .ccc__dot--log {
        background: var(--oa-operating);
    }

    .ccc__dot--power {
        background: var(--oa-revenue);
    }

    .ccc__sep {
        margin: 0 6px;
        color: var(--oa-border);
    }

    .ccc__calc {
        margin: 8px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-3);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-hover);
            border: 1px solid var(--oa-border-light);
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            color: var(--oa-primary-deep);
        }
    }
</style>
