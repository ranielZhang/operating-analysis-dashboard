<template>
    <PanelCard title="账面利润 → 经营利润 桥接" subtitle="两个口径的差额来自收入确认时点与支出确认时点的差异">
        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无经营数据" />

        <template v-else>
            <!-- 区块 1 · 桥接瀑布图 -->
            <div class="bridge__chart">
                <EChart :option="option" style="height: 380px" />
            </div>

            <!-- 区块 2 · 桥接明细表 -->
            <el-table :data="rows" size="small" class="bridge__table">
                <el-table-column prop="name" label="项目" min-width="120" fixed>
                    <template #default="{ row }">
                        <span :class="row.key === 'operating' ? 'bridge__strong' : ''">{{ row.name }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="金额" align="right" min-width="120">
                    <template #default="{ row }">
                        <span class="oa-num bridge__amt" :class="`bridge__tone--${row.tone}`">{{ money(row.value) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="计算式子" min-width="320" show-overflow-tooltip>
                    <template #default="{ row }">
                        <span class="bridge__formula oa-num">{{ row.formula }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="meaning" label="业务含义" min-width="230" show-overflow-tooltip />

                <el-table-column label="标识" width="96" align="center">
                    <template #default="{ row }">
                        <el-tag v-if="row.badge" size="small" :type="row.badgeTone" effect="plain">{{ row.badge }}</el-tag>
                        <span v-else class="oa-muted">—</span>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 区块 3 · 时点余额补充（存量视角） -->
            <div class="bridge__stock-title">
                时点余额（存量视角）
                <span class="oa-muted bridge__stock-tip">与上方流量口径相互独立</span>
            </div>

            <div class="bridge__stock">
                <div class="bridge__stock-card">
                    <div class="bridge__stock-lab">预付余额</div>
                    <div class="bridge__stock-val oa-num">{{ money(stock.prepayBalance) }}</div>
                    <div class="bridge__stock-sub">累计充值 − 累计消耗 · 已充值但还没消耗掉</div>
                </div>
                <div class="bridge__stock-card">
                    <div class="bridge__stock-lab">应收未收</div>
                    <div class="bridge__stock-val oa-num">{{ money(stock.receivable) }}</div>
                    <div class="bridge__stock-sub">累计预估总回收 − 累计已回收 · 钱还在路上</div>
                </div>
                <div class="bridge__stock-card bridge__stock-card--gap">
                    <div class="bridge__stock-lab">现金缺口</div>
                    <div class="bridge__stock-val oa-num">{{ money(stock.cashGap) }}</div>
                    <div class="bridge__stock-sub">预付余额 + 应收未收 · 被占用的现金总量</div>
                </div>
            </div>

            <p class="bridge__note">
                瀑布图看的是<strong>本期流量</strong>的差异来源；预付余额与应收未收看的是<strong>累计存量</strong>的现金占用。二者不相等是正常的——存量还包含历史期间累积的未消耗与未回收。
            </p>

            <!-- 区块 4 · 一句话结论 -->
            <div class="bridge__conclusion" :class="`bridge__conclusion--${conclusion.tone}`">
                <span class="bridge__conclusion-tag">{{ conclusion.tag }}</span>
                <span class="bridge__conclusion-text">{{ conclusion.text }}</span>
            </div>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, watch } from 'vue';
    import type { EChartsOption } from 'echarts';
    import { store } from '@/domain/store';
    import type { AnalysisFilter } from '@/domain/types';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { money, toWan } from '@/utils/format';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';

    defineOptions({ name: 'OverviewProfitBridge' });

    const { filter } = useAnalysisFilter();

    /**
     * ECharts 在 canvas 上渲染，**不解析 CSS 变量**（`var(--oa-book)` 会退化成黑色），
     * 因此图表内色值用与 design token 一一对应的常量（数值与 theme.scss 保持一致）；
     * DOM 样式一律继续使用 `var(--oa-*)`。
     */
    const C = {
        book: '#4d94fa', // = --oa-book
        operating: '#12b566', // = --oa-operating
        success: '#12b566', // = --oa-success
        danger: '#fd6464', // = --oa-danger
        gap: '#ff9140', // = --oa-gap
        other: '#9ca3af', // = --oa-text-4
        axis: '#e2e8f0',
        axisText: '#94a3b8',
        split: '#f1f5f9',
        text2: '#4b5563',
        text3: '#6b7280',
    } as const;

    /** 全公司指标（filter 变化自动重算） */
    const m = computed(() => store.metricsOf(filter as AnalysisFilter, 'company', 'company'));

    /** 空数据兜底：指标缺失或本期没有任何收支金额 */
    const isEmpty = computed(() => {
        const v = m.value;
        if (!v) return true;
        const sums = [
            Math.abs(v.cashRevenue),
            Math.abs(v.accrualRevenue),
            Math.abs(v.spend),
            Math.abs(v.prepay),
            Math.abs(v.laborCost),
            Math.abs(v.adminCost),
        ];
        return Math.max(...sums) < 1;
    });

    // ============================================================
    // 桥接项
    //   ① 收入确认差 = 应确认收入 − 已到账收入      （应收未收，本期新增）
    //   ② 支出确认差 = 充值支出 − 投放消耗 = prepay − spend（预付净增）
    //   ③ 其他差异   = profitGap − ① − ②            （理论为 0，非零即期间错配）
    // ============================================================
    const bridge = computed(() => {
        const v = m.value;
        if (!v) {
            return { bookProfit: 0, item1: 0, item2: 0, item3: 0, operatingProfit: 0, gap: 0 };
        }
        const item1 = v.accrualRevenue - v.cashRevenue;
        const item2 = v.prepay - v.spend;
        // 残差保留原始小数（不再二次取整），保证「上列合计 = 经营利润」恒等成立
        const item3 = v.profitGap - item1 - item2;
        return {
            bookProfit: v.bookProfit,
            item1,
            item2,
            item3,
            operatingProfit: v.operatingProfit,
            gap: v.profitGap,
        };
    });

    /** 瀑布柱子：起始柱/结束柱/差额柱从 0 画，桥接项柱浮在累计高度上 */
    interface BridgeBar {
        key: string;
        name: string;
        /** 柱子自身取值（带符号的业务值） */
        value: number;
        /** 'total' 从 0 画起；'delta' 浮在累计高度上 */
        kind: 'total' | 'delta';
        color: string;
        formula: string;
        meaning: string;
        badge?: string;
        badgeTone?: 'success' | 'warning' | 'danger' | 'info';
        /** 表格金额着色 tone */
        tone: 'book' | 'success' | 'danger' | 'gap' | 'muted' | 'operating';
    }

    const bars = computed<BridgeBar[]>(() => {
        const b = bridge.value;
        const v = m.value;
        const colorOf = (n: number): string => (n >= 0 ? C.success : C.danger);
        const toneOf = (n: number): BridgeBar['tone'] => (n >= 0 ? 'success' : 'danger');
        const mismatch = Math.abs(b.item3) > 1;

        return [
            {
                key: 'book',
                name: '账面利润',
                value: b.bookProfit,
                kind: 'total',
                color: C.book,
                formula: v
                    ? `已到账收入 ${money(v.cashRevenue)} − 充值支出 ${money(v.prepay)} − 人工 ${money(
                          v.laborCost,
                      )} − 管理 ${money(v.adminCost)}`
                    : '—',
                meaning: '银行账户真实流水：钱已经收进来、也已经付出去了',
                tone: 'book',
            },
            {
                key: 'item1',
                name: '① 收入确认差',
                value: b.item1,
                kind: 'delta',
                color: colorOf(b.item1),
                formula: v ? `应确认收入 ${money(v.accrualRevenue)} − 已到账收入 ${money(v.cashRevenue)}` : '—',
                meaning: '已投放、已回收但还没到账的钱（结算周期滞后）',
                tone: toneOf(b.item1),
            },
            {
                key: 'item2',
                name: '② 支出确认差',
                value: b.item2,
                kind: 'delta',
                color: colorOf(b.item2),
                formula: v ? `充值支出 ${money(v.prepay)} − 投放消耗 ${money(v.spend)}` : '—',
                meaning: '已充值但还没消耗掉的钱（预付净增，正数 = 本期多充了值）',
                tone: toneOf(b.item2),
            },
            {
                key: 'item3',
                name: '③ 期间错配',
                value: b.item3,
                kind: 'delta',
                color: mismatch ? colorOf(b.item3) : C.other,
                formula: mismatch ? `口径差额 ${money(b.gap)} − ① ${money(b.item1)} − ② ${money(b.item2)}` : '恒等式残差，理论为 0',
                meaning: '结算周期与投放节奏的错配，正常应接近 0',
                badge: mismatch ? '期间错配' : '已平衡',
                badgeTone: mismatch ? 'warning' : 'info',
                tone: mismatch ? toneOf(b.item3) : 'muted',
            },
            {
                key: 'operating',
                name: '经营利润',
                value: b.operatingProfit,
                kind: 'total',
                color: C.operating,
                formula: v
                    ? `应确认收入 ${money(v.accrualRevenue)} − 投放消耗 ${money(v.spend)} − 人工 ${money(
                          v.laborCost,
                      )} − 管理 ${money(v.adminCost)}`
                    : '—',
                meaning: '权责发生制 + 预估回收：这段时间做的生意最终赚不赚钱',
                tone: 'operating',
            },
            {
                key: 'gap',
                name: '口径差额',
                value: b.gap,
                kind: 'total',
                color: C.gap,
                formula: m.value ? `经营利润 ${money(b.operatingProfit)} − 账面利润 ${money(b.bookProfit)}` : '—',
                meaning: '两个口径的整体差额，= ① + ② + ③',
                tone: 'gap',
            },
        ];
    });

    /** 桥接明细表行 */
    const rows = computed(() => bars.value);

    /** 时点存量三指标（null 兜底为 0，仅用于展示） */
    const stock = computed(() => ({
        prepayBalance: m.value?.prepayBalance ?? 0,
        receivable: m.value?.receivable ?? 0,
        cashGap: m.value?.cashGap ?? 0,
    }));

    // ============================================================
    // 开发期断言：恒等式 经营利润 − 账面利润 = ① + ② + ③
    //   （即 (accrualRevenue − cashRevenue) − (spend − prepay) = profitGap）
    //   只告警，不 throw、不影响渲染
    // ============================================================
    if (import.meta.env.DEV) {
        watch(bridge, () => {
            const v = m.value;
            if (!v) return;
            const lhs = v.accrualRevenue - v.cashRevenue - (v.spend - v.prepay);
            const diff = lhs - v.profitGap;
            if (Math.abs(diff) >= 1) {
                console.warn(
                    '[OverviewProfitBridge] 桥接恒等式不成立：' +
                        `(应确认收入 − 已到账收入) − (投放消耗 − 充值支出) = ${lhs.toFixed(2)}，` +
                        `profitGap = ${v.profitGap.toFixed(2)}，残差 = ${diff.toFixed(2)}`,
                );
            }
        });
    }

    // ============================================================
    // ECharts 瀑布图（bar + 透明占位系列 stack 实现）
    // ============================================================
    const option = computed<EChartsOption>(() => {
        const list = bars.value;
        const labels = list.map((b) => b.name);

        // 占位段：起始/结束柱段高 = |值|（从 0 起），桥接项柱浮在「本项之前的累计高度」上。
        // 链路起点必须是「账面利润」（第 1 个 total），否则桥接项会从 0 起浮，与起始柱对不上。
        const placeholders: number[] = [];
        const deltas: number[] = [];
        let run = 0;
        for (const b of list) {
            if (b.kind === 'total') {
                placeholders.push(Math.min(0, toWan(b.value)));
                // 可见段高取绝对值：配合 stackStrategy:'all'，负值 total 才会从 0 向下画到该值
                deltas.push(Math.abs(toWan(b.value)));
                // 起始柱同时是桥接链的起点（结束柱的赋值在链尾，不再被使用）
                run = b.value;
            } else {
                const from = run;
                const to = run + b.value;
                placeholders.push(Math.min(toWan(from), toWan(to)));
                deltas.push(Math.abs(toWan(to) - toWan(from)));
                run = to;
            }
        }

        /**
         * 连接线端点：桥接链路上「本条柱之后」的累计高度（账面利润 → 经营利润 逐段抬升）。
         * 必须累计而不是取本条柱自身值，否则连接线会在 0 附近锯齿跳动、不落在柱边。
         */
        const pivots: number[] = [];
        let cum = 0;
        for (const b of list.slice(0, 5)) {
            cum = b.kind === 'total' ? b.value : cum + b.value;
            pivots.push(toWan(cum));
        }
        // 显式标注为二元组，满足 ECharts markLine 的 2D 端点类型
        const connectors: Array<[{ coord: [string, number] }, { coord: [string, number] }]> = pivots
            .slice(0, -1)
            .map((_, i) => [
                { coord: [labels[i], pivots[i]] },
                { coord: [labels[i + 1], pivots[i]] },
            ]);

        return {
            animationDuration: 420,
            grid: { left: 62, right: 22, top: 42, bottom: 30 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(77, 148, 250, 0.06)' } },
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                borderColor: C.axis,
                borderWidth: 1,
                padding: [8, 10],
                textStyle: { color: C.text2, fontSize: 12, lineHeight: 18 },
                extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(31,41,55,0.12); max-width: 360px;',
                formatter: (params: unknown) => {
                    const arr = params as Array<{ dataIndex: number }>;
                    const idx = Array.isArray(arr) && arr.length ? arr[0].dataIndex : -1;
                    const b = bars.value[idx];
                    if (!b) return '';
                    return [
                        `<div style="font-weight:600;color:#1f2937;margin-bottom:4px;">${b.name}</div>`,
                        `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px;">
                            <span style="color:#6b7280;">${b.kind === 'total' ? '金额' : '影响口径差额'}</span>
                            <span style="font-weight:600;color:${b.color};font-variant-numeric:tabular-nums;">${money(b.value)}</span>
                        </div>`,
                        `<div style="color:#6b7280;">计算：${b.formula}</div>`,
                        `<div style="margin-top:4px;padding-top:4px;border-top:1px dashed #eef1f7;color:#4b5563;">${b.meaning}</div>`,
                    ].join('');
                },
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: C.axis } },
                axisTick: { show: false },
                axisLabel: { color: C.axisText, fontSize: 11, interval: 0, margin: 12 },
            },
            yAxis: {
                type: 'value',
                splitNumber: 5,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: C.axisText, fontSize: 11, formatter: (v: number) => `${Math.round(v)}万` },
                splitLine: { lineStyle: { color: C.split } },
            },
            series: [
                {
                    name: '占位',
                    type: 'bar',
                    stack: 'w',
                    // ECharts 默认 stackStrategy='samesign'：占位段为负、变动段为正时不叠加，
                    // 会导致「下降型」桥接柱被画成上升柱。必须显式允许异号堆叠。
                    stackStrategy: 'all',
                    silent: true,
                    barMaxWidth: 34,
                    itemStyle: { color: 'transparent' },
                    emphasis: { disabled: true },
                    data: placeholders,
                },
                {
                    name: '变动',
                    type: 'bar',
                    stack: 'w',
                    stackStrategy: 'all',
                    barMaxWidth: 34,
                    itemStyle: { borderRadius: [3, 3, 0, 0] },
                    data: list.map((b, i) => ({
                        // 段高一律取绝对值：究竟向上还是向下由「占位段 + 本段」堆叠后的区间决定
                        value: deltas[i],
                        itemStyle: { color: b.color },
                    })),
                    label: {
                        show: true,
                        position: 'top',
                        distance: 5,
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: C.text3,
                        formatter: (p: { dataIndex: number }) => {
                            const b = bars.value[p.dataIndex];
                            return b ? money(b.value) : '';
                        },
                    },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        data: [
                            // 零线
                            [
                                { coord: ['账面利润', 0], lineStyle: { color: C.axis, width: 1, type: 'solid' } },
                                { coord: ['口径差额', 0], lineStyle: { color: C.axis, width: 1, type: 'solid' } },
                            ],
                            // 相邻柱之间的瀑布连接线
                            ...connectors,
                        ],
                        label: { show: false },
                        lineStyle: { color: C.other, width: 1, type: 'dashed', opacity: 0.8 },
                        emphasis: { disabled: true },
                    },
                },
            ],
        };
    });

    // ============================================================
    // 一句话结论
    // ============================================================
    const conclusion = computed(() => {
        const v = m.value;
        const b = bridge.value;
        if (!v || Math.abs(b.gap) < 1) {
            return {
                tone: 'flat' as const,
                tag: '口径基本一致',
                text: '本期经营利润与账面利润基本一致，收入到账节奏与投放充值节奏基本同步，无需特别解释。',
            };
        }
        const abs = money(Math.abs(b.gap));
        if (b.gap > 0) {
            return {
                tone: 'up' as const,
                tag: '经营好于账面',
                text:
                    `经营利润比账面利润高 ${abs}：其中 ${money(b.item1)} 来自收入确认差（钱在路上，` +
                    `应确认收入 ${money(v.accrualRevenue)} vs 已到账 ${money(v.cashRevenue)}），` +
                    `${money(b.item2)} 来自支出确认差（值还没消耗，充值支出 ${money(v.prepay)} vs 投放消耗 ${money(v.spend)}）。` +
                    '说明公司处于放量投入期，账面数字低估了真实经营成果。',
            };
        }
        return {
            tone: 'down' as const,
            tag: '账面好于经营',
            text:
                `账面利润高于经营利润 ${abs}：收入确认差 ${money(b.item1)}、支出确认差 ${money(b.item2)} 合计为负，` +
                '说明本期回收兑现好于本期投入（或历史应收集中到账），也可能是本期多充了值、成本被延后到未来消耗，' +
                '需关注应付未付（如投放款未结、奖金未发）。',
        };
    });
</script>

<style scoped lang="scss">
    .bridge__chart {
        min-height: 0;
    }

    .bridge__table {
        margin-top: 10px;

        :deep(.el-table__cell) {
            padding: 5px 0;
        }

        :deep(.el-table__inner-wrapper::before) {
            display: none;
        }
    }

    .bridge__strong {
        font-weight: 600;
    }

    .bridge__amt {
        font-weight: 600;
    }

    .bridge__tone--book {
        color: var(--oa-book);
    }

    .bridge__tone--operating,
    .bridge__tone--success {
        color: var(--oa-success);
    }

    .bridge__tone--danger {
        color: var(--oa-danger);
    }

    .bridge__tone--gap {
        color: var(--oa-gap-color);
    }

    .bridge__tone--muted {
        color: var(--oa-text-4);
    }

    .bridge__formula {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .bridge__stock-title {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin: 14px 0 8px;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .bridge__stock-tip {
        font-size: var(--oa-fs-xs);
        font-weight: 400;
    }

    .bridge__stock {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--oa-gap);
    }

    .bridge__stock-card {
        min-width: 0;
        padding: 8px 10px;
        background: var(--oa-hover);
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius-sm);

        &--gap {
            border-color: var(--oa-border);
        }
    }

    .bridge__stock-lab {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .bridge__stock-val {
        margin-top: 2px;
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .bridge__stock-sub {
        margin-top: 2px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        line-height: 1.45;
    }

    .bridge__note {
        margin: 8px 0 0;
        padding: 7px 10px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        line-height: 1.6;
        background: var(--oa-hover);
        border-left: 2px solid var(--oa-border);
        border-radius: var(--oa-radius-sm);

        strong {
            color: var(--oa-text-1);
            font-weight: 600;
        }
    }

    .bridge__conclusion {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 10px;
        padding: 8px 10px;
        border-radius: var(--oa-radius-sm);
        font-size: var(--oa-fs-sm);
        line-height: 1.6;

        &--up {
            background: var(--oa-success-soft);
            border-left: 2px solid var(--oa-success);
        }

        &--down {
            background: var(--oa-danger-soft);
            border-left: 2px solid var(--oa-danger);
        }

        &--flat {
            background: var(--oa-primary-soft);
            border-left: 2px solid var(--oa-primary);
        }
    }

    .bridge__conclusion-tag {
        flex: 0 0 auto;
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .bridge__conclusion-text {
        color: var(--oa-text-2);
    }
</style>
