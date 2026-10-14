<template>
    <PanelCard title="数据完整度趋势" :subtitle="subtitle">
        <template #title>
            <el-tag size="small" type="info" effect="plain">演示数据</el-tag>
        </template>

        <template #actions>
            <span class="trend__legend-line" /> <span class="trend__legend-text">完整度目标线 95%</span>
        </template>

        <div class="trend">
            <EChart :option="option" style="height: 280px" />

            <p class="trend__conclusion">
                <span class="trend__tag">结论</span>
                <span class="trend__conclusion-text">{{ conclusion }}</span>
            </p>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import { COMPLETENESS_TARGET, DATA_SOURCES, belowTargetMonths, lastMonths, lowestCompleteness, monthlyCompleteness } from './meta';

    /**
     * 区块 3 · 各业务数据源月度完整度趋势
     * 数值由 hash01(数据源名 + 月份) 确定性生成并锚定各源完整度基准（约 80%~100%），已在标题标注「演示数据」；
     * 水平目标线用 markLine 标出 95%。X 轴月份取自 store.months（不写死）。
     */
    defineOptions({ name: 'CompletenessTrend' });

    const sources = computed(() => DATA_SOURCES.filter((s) => s.inTrend));
    const months = computed(() => lastMonths(store.months, 12));
    const labels = computed(() => months.value.map((m) => `${Number(m.slice(5))}月`));

    /** 各源标记：近 3 个月低于目标线的月份数 + 近 3 个月最低完整度（低者在前） */
    const offenders = computed(() =>
        sources.value
            .map((s) => ({
                name: s.name,
                monthCount: belowTargetMonths(s.id, months.value, 3),
                min: lowestCompleteness(s.id, months.value, 3),
            }))
            .filter((o) => o.monthCount > 0)
            .sort((a, b) => a.min - b.min),
    );

    const conclusion = computed(() => {
        const list = offenders.value;
        const total = sources.value.length;
        if (list.length === 0) {
            return `近 3 个月 ${total} 个业务数据源完整度均不低于 95% 目标线（演示数据）。`;
        }
        const names = list.map((o) => o.name);
        const focus = names.length <= 2 ? names.join(' 与 ') : `${names.slice(0, 2).join(' 与 ')} 等 ${names.length} 个源`;
        const worst = Math.round(Math.min(...list.map((o) => o.min)) * 100);
        return `有 ${list.length} 个数据源近 3 个月完整度低于 95% 目标线，主要集中在 ${focus}（近 3 个月最低完整度 ${worst}%）。`;
    });

    const option = computed<EChartsOption>(() => ({
        grid: { left: 52, right: 24, top: 34, bottom: 26 },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
        },
        legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 11 } },
        xAxis: {
            type: 'category',
            data: labels.value,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#94a3b8', fontSize: 11 },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            // 下限压到 50% 是刻意的：手工维护的数据源基准完整度只有 60% 上下，且要保证 95% 目标线始终在可视区内
            min: 50,
            max: 105,
            splitNumber: 5,
            axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v}%` },
            splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series: sources.value.map((s, idx) => ({
            name: s.name,
            type: 'bar',
            // 分组柱（不是堆叠柱）：本图要横向对比「各数据源的完整度差异」，
            // 堆叠会把 6 个源的数值累加（6 × 50%~98% 远超 yAxis max 105），导致除首个源外全部被裁掉。
            barMaxWidth: 12,
            itemStyle: { color: categoryColorOf(idx) },
            data: months.value.map((m) => Number((monthlyCompleteness(s.id, m) * 100).toFixed(1))),
            ...(idx === 0
                ? {
                      markLine: {
                          silent: true,
                          symbol: 'none',
                          label: {
                              formatter: '完整度目标线 95%',
                              position: 'insideEndTop',
                              color: '#c96a1c',
                              fontSize: 11,
                          },
                          lineStyle: { color: '#ff9140', type: 'dashed', width: 1.5 },
                          data: [{ yAxis: COMPLETENESS_TARGET * 100 }],
                      },
                  }
                : {}),
        })),
    }));

    /** 业务数据源固定用主色系（与区块 4 的「业务=蓝」一致），保证同屏语义一致 */
    const BIZ_PALETTE = ['#4d94fa', '#2f7ce8', '#06b6d4', '#8b5cf6', '#f472b6', '#12b566'];
    function categoryColorOf(idx: number): string {
        return BIZ_PALETTE[idx % BIZ_PALETTE.length];
    }

    const subtitle = computed(
        () =>
            `${sources.value.length} 个业务数据源的月度完整度（近 12 个月）· 目标线 ${Math.round(COMPLETENESS_TARGET * 100)}% · 柱高差异体现各源接入质量差异 · 统计基准 ${store.currentMonth}`,
    );
</script>

<style scoped lang="scss">
    .trend {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
    }

    .trend__legend-line {
        display: inline-block;
        width: 14px;
        height: 0;
        border-top: 2px dashed var(--oa-warning);
        vertical-align: middle;
    }

    .trend__legend-text {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .trend__conclusion {
        display: flex;
        align-items: flex-start;
        gap: var(--oa-gap);
        margin: 0;
        padding: 9px 12px;
        background: var(--oa-primary-soft);
        border: 1px solid var(--oa-border);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius);
        min-height: 0;
    }

    .trend__tag {
        flex: 0 0 auto;
        padding: 1px 8px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-card);
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        line-height: 18px;
        color: var(--oa-text-1);
    }

    .trend__conclusion-text {
        font-size: var(--oa-fs-sm);
        line-height: 20px;
        color: var(--oa-text-2);
    }
</style>
