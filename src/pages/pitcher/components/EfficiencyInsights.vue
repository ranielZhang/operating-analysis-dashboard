<template>
    <PanelCard title="人效洞察" subtitle="按当前筛选范围自动生成 · 每条结论都带真实数字与姓名">
        <template v-if="insights.length">
            <ul class="ins__list">
                <li v-for="item in insights" :key="item.key" class="ins__item" :class="`ins__item--${item.tone}`">
                    <span class="ins__tag" :class="`ins__tag--${item.tone}`">{{ item.tag }}</span>
                    <p class="ins__text">
                        <span v-for="(part, i) in item.parts" :key="i" :class="{ ins__strong: part.strong }">{{ part.text }}</span>
                    </p>
                </li>
            </ul>

            <p class="ins__note">
                判断阈值：人效比 <b>1.00</b> = 刚好覆盖自身人力成本（&lt; 1 视为未覆盖，与全站「人效偏低」预警同一阈值）；
                消耗集中度按前 5 名占比 <b>40% / 60%</b> 分档；高低消耗组按团队消耗中位数二分，两组平均人效比差值 <b>≥ 1</b> 视为规模与人效显著相关。
            </p>
        </template>

        <PanelEmptyState v-else text="当前筛选范围内没有投手，暂无可生成的人效洞察" />
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { money, percent, ratio } from '@/utils/format';
    import { usePitcherData } from './usePitcherData';

    /**
     * 区块 6 · 人效洞察
     * 把散点图与排行榜里的数字直接翻译成「该动谁、动什么」的中文结论。
     * 所有阈值集中在每条洞察上方注释里，改口径只需要改这一处。
     */
    defineOptions({ name: 'PitcherEfficiencyInsights' });

    const { pitcherRows, medianSpend } = usePitcherData();

    type InsightTone = 'success' | 'danger' | 'warning' | 'primary';
    interface InsightPart {
        text: string;
        strong?: boolean;
    }
    interface Insight {
        key: string;
        tag: string;
        tone: InsightTone;
        parts: InsightPart[];
    }

    const insights = computed<Insight[]>(() => {
        const rows = pitcherRows.value;
        if (!rows.length) return [];

        const out: Insight[] = [];
        const totalProfit = rows.reduce((s, r) => s + r.operatingProfit, 0);
        const totalSpend = rows.reduce((s, r) => s + r.spend, 0);

        // ------------------------------------------------------------------
        // 洞察 1 · 人效标杆
        // 判断逻辑：按人效比降序取前 3（人数不足则取全部）；
        // 贡献占比 = 这几位投手的经营利润 ÷ 全部投手经营利润（团队合计为负时不给占比，避免误读）。
        // ------------------------------------------------------------------
        const byEff = [...rows].sort((a, b) => b.efficiencyRatio - a.efficiencyRatio);
        const top = byEff.slice(0, Math.min(3, rows.length));
        const topProfit = top.reduce((s, r) => s + r.operatingProfit, 0);
        // 阈值：连人效比最高的人都 <= 0，说明当期没有一个人覆盖了自身人力成本，
        // 这时不能再用「标杆」措辞，否则会把倒数第一读成第一名。
        if (top[0] && top[0].efficiencyRatio <= 0) {
            out.push({
                key: 'top',
                tag: '无标杆',
                tone: 'danger',
                parts: [
                    { text: '当期没有任何投手的人效比为正——最高的是 ' },
                    { text: `${top[0].name}（${ratio(top[0].efficiencyRatio)}）`, strong: true },
                    { text: `，${rows.length} 位投手合计经营利润 ` },
                    { text: money(totalProfit), strong: true },
                    { text: '，团队整体处于亏损状态，建议先解决「有人力成本、无投放盘面」的分配问题。' },
                ],
            });
        } else {
            out.push({
                key: 'top',
                tag: '人效标杆',
                tone: 'success',
                parts: [
                    { text: `人效比最高的 ${top.length} 位投手是 ` },
                    { text: top.map((r) => `${r.name}（${ratio(r.efficiencyRatio)}）`).join('、'), strong: true },
                    { text: '，合计贡献经营利润 ' },
                    { text: money(topProfit), strong: true },
                    totalProfit > 0
                        ? { text: `，占投手团队的 ${percent(topProfit / totalProfit, 1)}。` }
                        : { text: '（投手团队合计经营利润为负，占比不适用）。' },
                ],
            });
        }

        // ------------------------------------------------------------------
        // 洞察 2 · 人效不足与盘面空转
        // 阈值：人效比 < 1（含负值）= 未覆盖自身人力成本，与 store 「人效偏低」预警阈值一致；
        // 其中消耗为 0 的人属于「有人力成本、无投放盘面」，单独点名。
        // ------------------------------------------------------------------
        const low = rows.filter((r) => r.efficiencyRatio < 1);
        if (low.length) {
            const lowLabor = low.reduce((s, r) => s + r.laborCost, 0);
            const lowProfit = low.reduce((s, r) => s + r.operatingProfit, 0);
            const idle = low.filter((r) => r.spend <= 0);
            out.push({
                key: 'low',
                tag: '人效不足',
                tone: 'danger',
                parts: [
                    { text: `有 ${low.length} 位投手人效比低于 1，人力成本合计 ` },
                    { text: money(lowLabor), strong: true },
                    { text: '，经营利润合计 ' },
                    { text: money(lowProfit), strong: true },
                    idle.length
                        ? {
                              // 无投放投手可能很多（单月 / 单游戏筛选下常见），只点名前 3 位，避免洞察变成一长串名单
                              text:
                                  `；其中 ${idle
                                      .slice(0, 3)
                                      .map((r) => r.name)
                                      .join('、')}${idle.length > 3 ? ` 等 ${idle.length} 位` : ''}` +
                                  '当期没有任何投放消耗，人力成本照常发生，建议优先复核盘面分配。',
                          }
                        : { text: '，需要重点评估其负责的盘面与素材质量。' },
                ],
            });
        } else {
            out.push({
                key: 'low',
                tag: '人效健康',
                tone: 'success',
                parts: [
                    { text: `全部 ${rows.length} 位投手的人效比都在 1 以上，人力成本已完全被自身创造的经营利润覆盖；` },
                    { text: '下一步可评估把低效盘面的预算向高杠杆投手集中。' },
                ],
            });
        }

        // ------------------------------------------------------------------
        // 洞察 3 · 消耗集中度
        // 判断逻辑：按消耗降序取前 5（人数不足取全部）占总消耗比例；
        // 阈值：≥ 60% 高度集中、40%~60% 中等集中、< 40% 较为分散。
        // ------------------------------------------------------------------
        // 只在「当期有投放消耗」的投手里排名：否则零投放的人也会被算进「消耗前 5 名」，名单会失真。
        const spenders = [...rows].filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend);
        const topSpendRows = spenders.slice(0, Math.min(5, spenders.length));
        const topSpend = topSpendRows.reduce((s, r) => s + r.spend, 0);
        const share = totalSpend > 0 ? topSpend / totalSpend : 0;
        const level = share >= 0.6 ? '高度集中' : share >= 0.4 ? '中等集中' : '较为分散';
        const concentration =
            share >= 0.6
                ? '投放规模高度依赖头部投手，需要关注关键人风险并培养备手。'
                : share >= 0.4
                  ? '规模集中在少数投手，可把高分位测试盘向效率更高的投手倾斜。'
                  : '规模分布较均衡。';
        out.push({
            key: 'concentration',
            tag: '消耗集中度',
            tone: 'warning',
            parts: spenders.length
                ? [
                      { text: `当期有投放的 ${spenders.length} 位投手中，消耗前 ${topSpendRows.length} 名（` },
                      { text: topSpendRows.map((r) => r.name).join('、'), strong: true },
                      { text: '）占总消耗 ' },
                      { text: percent(share, 1), strong: true },
                      { text: `，团队消耗集中度${level}。${concentration}` },
                  ]
                : [
                      { text: '当期全部投手都没有发生投放消耗，消耗集中度不适用；' },
                      { text: `${rows.length} 位投手的人力成本 ${money(rows.reduce((s, r) => s + r.laborCost, 0))} 属于空转状态。`, strong: true },
                  ],
        });

        // ------------------------------------------------------------------
        // 洞察 4 · 规模与人效的相关性
        // 判断逻辑：按团队消耗中位数把投手二分为高消耗组（> 中位） / 低消耗组（≤ 中位，含零投放），
        // 比较两组平均人效比；
        // 阈值：差值 ≥ 1 视为显著相关（> 0 高消耗组更优，< 0 低消耗组更优），< 1 视为差异不显著。
        // ------------------------------------------------------------------
        const median = medianSpend.value;
        // 与四象限同口径：消耗严格高于中位数 = 高消耗组，其余（含零投放）= 低消耗组
        const highGroup = rows.filter((r) => r.spend > median);
        const lowGroup = rows.filter((r) => r.spend <= median);
        const avgEff = (list: typeof rows): number =>
            list.length ? list.reduce((s, r) => s + r.efficiencyRatio, 0) / list.length : 0;
        const highAvg = avgEff(highGroup);
        const lowAvg = avgEff(lowGroup);
        const gap = highAvg - lowAvg;
        const gapText = Math.abs(gap) >= 1 ? '差异显著' : '差异不显著';
        const gapConclusion =
            gap >= 1
                ? '高消耗组人效更高，说明规模化盘面能摊薄人力成本，可优先把预算集中给这一组。'
                : gap <= -1
                  ? '低消耗组人效反而更高，说明小盘精投更赚钱，扩量前应先验证边际回收能否守住。'
                  : '两组人效接近，人效差异主要来自个人操作与游戏选择，而不是投放规模。';
        // 退化场景：中位数落在边界上（例如单月筛选下多数投手消耗为 0），两组无法二分，此时不给结论
        const degenerate = !highGroup.length || !lowGroup.length;
        out.push({
            key: 'scale',
            tag: '规模 × 人效',
            tone: 'primary',
            parts: degenerate
                ? [
                      { text: '人效比与消耗规模的相关性：当期消耗中位数为 ' },
                      { text: money(median), strong: true },
                      { text: `，${highGroup.length === 0 ? '全部投手' : `${highGroup.length} 位投手`}落在同一侧，无法按中位数二分比较；` },
                      { text: '建议把期间拉长到 6 个月以上再看规模与人效的关系。' },
                  ]
                : [
                      {
                          text: `人效比与消耗规模的相关性：高消耗组（${highGroup.length} 人，消耗 > 中位 ${money(median)}）平均人效比 `,
                      },
                      { text: ratio(highAvg), strong: true },
                      { text: `，低消耗组（${lowGroup.length} 人）平均人效比 ` },
                      { text: ratio(lowAvg), strong: true },
                      { text: `，差值 ${ratio(gap)}，${gapText}。${gapConclusion}` },
                  ],
        });

        return out;
    });
</script>

<style scoped lang="scss">
    .ins__list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .ins__item {
        position: relative;
        padding: 8px 10px 8px 12px;
        background: var(--oa-hover);
        border-radius: var(--oa-radius-sm);
        border-left: 3px solid var(--oa-border);

        &--success {
            border-left-color: var(--oa-success);
            background: var(--oa-success-soft);
        }

        &--danger {
            border-left-color: var(--oa-danger);
            background: var(--oa-danger-soft);
        }

        &--warning {
            border-left-color: var(--oa-warning);
            background: var(--oa-warning-soft);
        }

        &--primary {
            border-left-color: var(--oa-primary);
            background: var(--oa-primary-soft);
        }
    }

    .ins__tag {
        display: inline-block;
        margin-bottom: 4px;
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.72);
        color: var(--oa-text-2);
    }

    .ins__text {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.75;
        color: var(--oa-text-2);
    }

    .ins__strong {
        font-weight: 700;
        color: var(--oa-text-1);
    }

    .ins__note {
        margin: 10px 0 0;
        font-size: 11px;
        line-height: 1.7;
        color: var(--oa-text-4);
        border-top: 1px dashed var(--oa-border);
        padding-top: 8px;

        b {
            color: var(--oa-text-3);
        }
    }
</style>
