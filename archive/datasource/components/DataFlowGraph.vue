<template>
    <PanelCard title="数据流转链路" :subtitle="subtitle">
        <template #actions>
            <div class="flow__legend">
                <span v-for="c in CATEGORY_OPTIONS" :key="c" class="flow__legend-item">
                    <i class="flow__legend-dot" :style="{ background: CATEGORY_COLOR[c] }" />
                    {{ c }}
                </span>
            </div>
        </template>

        <div class="flow">
            <EChart :option="option" style="height: 380px" />
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import { CATEGORY_COLOR, CATEGORY_OPTIONS, DATA_SOURCES, FLOW_LINKS, FLOW_NODES, type SourceCategory } from './meta';

    /**
     * 区块 4 · 数据流转链路（ECharts 桑基图，非图片）
     * 链路：各数据源 → 数据中台 ETL → 经营分析宽表 → 经营分析看板 / 账面利润（银行流水口径）。
     * 连边带宽 = 该来源贡献的看板指标数量；节点按类别着色（业务=蓝 / 管理=紫 / 财务=绿 / 归因=橙），
     * tooltip 显示每个环节的说明（说明文字由数据源清单的备注派生，不是另编一套）。
     */
    defineOptions({ name: 'DataFlowGraph' });

    /** 链路层节点 → 清单里的数据源 id（说明由这些源的备注合并而来，保证两块内容一致） */
    const LINK_NODE_SOURCES: Record<string, string[]> = {
        '媒体投放 API': ['ds_tencent_api', 'ds_ocean_api', 'ds_kuaishou_api', 'ds_xiaomi_api'],
        流量主后台: ['ds_wx_liuliangzhu', 'ds_douyin_liuliangzhu'],
        渠道对账单: ['ds_appstore_bill'],
        中台手工配置: ['ds_prepay_ledger', 'ds_adgold_settle'],
        薪酬系统: ['ds_hr_payroll', 'ds_social_ins', 'ds_tax_filing', 'ds_expense'],
        银行流水: ['ds_bank_flow'],
        归因系统: ['ds_internal_attr', 'ds_appsflyer'],
    };

    /** 合并后的节点说明：多条源备注用「；」拼接，截断到 320 字以免 tooltip 过长 */
    function descOf(nodeName: string): string {
        const ids = LINK_NODE_SOURCES[nodeName];
        if (!ids) return FLOW_NODES.find((n) => n.name === nodeName)?.desc ?? '';
        const parts = DATA_SOURCES.filter((s) => ids.includes(s.id)).map((s) => `${s.name}（${s.provider}）：${s.note}`);
        const merged = parts.join('\n');
        return merged.length > 320 ? `${merged.slice(0, 320)}…` : merged;
    }

    const nodes = computed(() =>
        FLOW_NODES.map((n) => ({
            name: n.name,
            itemStyle: n.category === '中台处理' ? { color: '#94a3b8' } : { color: CATEGORY_COLOR[n.category as SourceCategory] },
            // ECharts 会保留自定义字段，供 tooltip 使用
            desc: n.kind === 'source' ? descOf(n.name) : n.desc,
        })),
    );

    const links = computed(() =>
        FLOW_LINKS.map((l) => ({ source: l.source, target: l.target, value: l.value })),
    );

    type SankeyTooltipParam = {
        dataType?: string;
        name?: string;
        data?: { source?: string; target?: string; value?: number; desc?: string };
    };

    const option = computed<EChartsOption>(() => ({
        tooltip: {
            trigger: 'item',
            confine: true,
            textStyle: { fontSize: 12 },
            formatter: (raw: unknown) => {
                const p = raw as SankeyTooltipParam;
                const d = p.data ?? {};
                if (p.dataType === 'edge') {
                    return `<b>${d.source} → ${d.target}</b><br/>贡献看板指标数：<b>${d.value}</b> 个<br/><span style="color:#6b7280">带宽 = 该来源贡献的看板指标数量</span>`;
                }
                const desc = (d.desc ?? '').split('\n').join('<br/>');
                return `<b>${p.name ?? ''}</b><br/>${desc}`;
            },
        },
        series: [
            {
                type: 'sankey',
                left: 12,
                right: 130,
                top: 14,
                bottom: 14,
                nodeWidth: 14,
                nodeGap: 14,
                nodeAlign: 'justify',
                emphasis: { focus: 'adjacency' },
                data: nodes.value,
                links: links.value,
                label: { color: '#4b5563', fontSize: 11 },
                lineStyle: { color: 'gradient', opacity: 0.34, curveness: 0.5 },
            },
        ],
    }));

    const subtitle = computed(
        () =>
            `数据从哪来 → 经过什么 → 变成看板上的什么指标（带宽 = 贡献指标数）· 链路含 ${DATA_SOURCES.length} 个数据源 · 统计基准 ${store.currentMonth}`,
    );
</script>

<style scoped lang="scss">
    .flow {
        min-height: 0;
    }

    .flow__legend {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .flow__legend-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .flow__legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    @media (max-width: 1280px) {
        .flow__legend {
            display: none;
        }
    }
</style>
