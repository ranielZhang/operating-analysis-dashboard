<template>
    <PanelCard title="成本分析洞察" subtitle="按当前筛选范围自动生成，判断阈值已标注">
        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无成本数据，无法生成洞察" />

        <ol v-else class="ins">
            <li v-for="(it, i) in insights" :key="it.id" class="ins__item">
                <span class="ins__idx">{{ i + 1 }}</span>
                <div class="ins__body">
                    <div class="ins__head">
                        <span class="ins__tag" :class="`ins__tag--${it.level}`">{{ levelText(it.level) }}</span>
                        <span class="ins__title">{{ it.title }}</span>
                    </div>
                    <p class="ins__text">{{ it.text }}</p>
                    <p class="ins__threshold">判断阈值：{{ it.threshold }}</p>
                </div>
            </li>
        </ol>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import type { Metrics } from '@/domain/types';
    import { comma, money, percent } from '@/utils/format';
    import { EMPTY_METRICS, COST_LEAVES, isEmptyMetrics, leafValue, share, structTotal } from './costModel';

    /**
     * 区块 6 · 成本分析洞察
     * 全部结论由当前筛选范围的数据算出，判断阈值集中在下方常量，改阈值即改结论。
     */
    defineOptions({ name: 'CostInsights' });

    // ---------------- 判断阈值（管理层约定 / 行业常见水平，不是业务数据） ----------------
    /** 管理费用占应确认收入比的行业常见水平 */
    const ADMIN_RATIO_BENCHMARK = 0.05;
    /** 管理费用占比超过基准 1.6 倍（8%）视为需要整改 */
    const ADMIN_RATIO_RISK = ADMIN_RATIO_BENCHMARK * 1.6;
    /** 刚性成本（人工 + 管理）占收入比的警戒线 */
    const RIGID_RATIO_WARN = 0.5;
    /** 业务成本（投放消耗 + 充值额）占结构合计比：≥ 该值视为支出高度集中于投放侧 */
    const BUSINESS_SHARE_CONCENTRATION = 0.85;
    /** 预付余额缓冲月数：< 1 个月偏紧，> 3 个月资金沉淀偏多 */
    const BUFFER_TIGHT_MONTHS = 1;
    const BUFFER_HEAVY_MONTHS = 3;
    /** 亏损游戏数 ≥ 该值视为需要干预 */
    const LOSS_GAME_WARN = 3;
    /** 预付缓冲按月消耗估算取的最近月数 */
    const BUFFER_LOOKBACK_MONTHS = 3;

    type InsightLevel = 'risk' | 'watch' | 'info';

    interface CostInsight {
        id: string;
        level: InsightLevel;
        title: string;
        text: string;
        threshold: string;
    }

    const { filter } = useAnalysisFilter();

    const company = computed<Metrics | null>(() => store.metricsOf(filter, 'company', 'company'));
    const m = computed<Metrics>(() => company.value ?? EMPTY_METRICS);
    const cb = computed(() => m.value.costByType);
    const isEmpty = computed(() => !company.value || isEmptyMetrics(company.value));

    const levelText = (level: InsightLevel): string => (level === 'risk' ? '需干预' : level === 'watch' ? '需关注' : '正常');

    /** 各中心人工成本（判断成本中心 / 经营中心占比） */
    const centerMetrics = computed(() =>
        store.queryRows(filter, 'center').map((r) => ({ name: r.name, m: r })),
    );

    /** 各游戏成本与收入（判断亏损游戏） */
    const gameRows = computed(() => store.queryRows(filter, 'game'));

    /** 逐月序列（估算预付余额可支撑的消耗月数） */
    const monthPoints = computed(() => store.queryMonthSeries(filter));

    const insights = computed<CostInsight[]>(() => {
        const list: CostInsight[] = [];
        const cur = m.value;
        const cost = cb.value;
        const structural = structTotal(cost);

        // ---------- ① 成本结构：最大成本项 / 业务 vs 人工 / 经营中心占比 ----------
        const adShare = share(cost.adSpend, structural);
        const prepayShare = share(cost.prepay, structural);
        const businessShare = share(cost.adSpend + cost.prepay, structural);
        const laborShare = share(cur.laborCost, structural);
        const adminShare = share(cur.adminCost, structural);
        const largest = COST_LEAVES.map((l) => ({ name: l.name, amount: leafValue(cost, l.key) })).sort(
            (a, b) => b.amount - a.amount,
        )[0] ?? { name: '—', amount: 0 };
        const opCenters = centerMetrics.value.filter((c) => c.m.spend > 0 || c.m.accrualRevenue > 0);
        const opCenterLabor = opCenters.reduce((s, c) => s + c.m.laborCost, 0);
        const opCenterLaborShare = share(opCenterLabor, cur.laborCost);
        const opCenterNames = opCenters.map((c) => c.name).join(' / ');
        list.push({
            id: 'structure',
            level: businessShare >= BUSINESS_SHARE_CONCENTRATION ? 'watch' : 'info',
            title: '成本结构：最大成本项与人工占比',
            text:
                `结构口径下最大成本项是${largest.name}（${money(largest.amount)}，占 ${percent(share(largest.amount, structural))}）；` +
                `投放消耗占 ${percent(adShare)}、充值额占 ${percent(prepayShare)}、人工成本占 ${percent(laborShare)}、管理费用占 ${percent(adminShare)}；` +
                (opCenters.length
                    ? `人工成本中${opCenterNames}占 ${percent(opCenterLaborShare)}（${money(opCenterLabor)}）。`
                    : '当前范围内没有产生投放消耗或收入的经营中心。'),
            threshold: `占比口径为结构合计（投放消耗 + 充值额 + 人工 + 管理，真实发生额）；业务成本（投放 + 充值）占结构合计 ≥ ${percent(BUSINESS_SHARE_CONCENTRATION, 0)} 判定为支出高度集中于投放侧（需关注）。`,
        });

        // ---------- ② 预付余额的消耗缓冲 ----------
        const used = monthPoints.value.slice(-BUFFER_LOOKBACK_MONTHS).filter((p) => p.metrics.costByType.adSpend > 0);
        const avgSpend = used.length ? used.reduce((s, p) => s + p.metrics.costByType.adSpend, 0) / used.length : 0;
        const bufferMonths = avgSpend > 0 ? cur.prepayBalance / avgSpend : 0;
        const bufferLevel: InsightLevel =
            avgSpend <= 0 ? 'info' : bufferMonths < BUFFER_TIGHT_MONTHS ? 'risk' : bufferMonths > BUFFER_HEAVY_MONTHS ? 'watch' : 'info';
        list.push({
            id: 'prepay',
            level: bufferLevel,
            title: '预付余额：还能撑几个月',
            text:
                avgSpend > 0
                    ? `预付余额 ${money(cur.prepayBalance)}，相当于当前消耗速度下约 ${bufferMonths.toFixed(1)} 个月的缓冲` +
                      `（近 ${used.length} 个月平均月消耗 ${money(avgSpend)}，月均充值 ${money(
                          used.reduce((s, p) => s + p.metrics.costByType.prepay, 0) / used.length,
                      )}）。`
                    : `预付余额 ${money(cur.prepayBalance)}，但当前区间内没有投放消耗，无法换算成缓冲月数。`,
            threshold: `缓冲月数 = 预付余额 ÷ 近 ${BUFFER_LOOKBACK_MONTHS} 个月平均投放消耗；< ${BUFFER_TIGHT_MONTHS} 个月=偏紧（需干预），${BUFFER_TIGHT_MONTHS}~${BUFFER_HEAVY_MONTHS} 个月=合理，> ${BUFFER_HEAVY_MONTHS} 个月=资金沉淀偏多（需关注）。`,
        });

        // ---------- ③ 管理费用与刚性成本占收入比 ----------
        const adminRatio = cur.accrualRevenue > 0 ? cur.adminCost / cur.accrualRevenue : 0;
        const rigidRatio = cur.accrualRevenue > 0 ? (cur.laborCost + cur.adminCost) / cur.accrualRevenue : 0;
        const adminLevel: InsightLevel =
            cur.accrualRevenue <= 0
                ? 'info'
                : adminRatio > ADMIN_RATIO_RISK
                  ? 'risk'
                  : adminRatio > ADMIN_RATIO_BENCHMARK
                    ? 'watch'
                    : 'info';
        list.push({
            id: 'admin',
            level: adminLevel,
            title: '管理费用与刚性成本占收入比',
            text:
                cur.accrualRevenue > 0
                    ? `管理费用 ${money(cur.adminCost)} 占应确认收入 ${percent(adminRatio)}，` +
                      `${adminRatio > ADMIN_RATIO_BENCHMARK ? '高于' : '低于'} ${percent(ADMIN_RATIO_BENCHMARK, 0)} 的行业常见水平；` +
                      `人工 + 管理费用（刚性成本）合计 ${money(cur.laborCost + cur.adminCost)}，占应确认收入 ${percent(rigidRatio)}。`
                    : `本区间应确认收入为 0，管理费用 ${money(cur.adminCost)} 无法计算占收入比。`,
            threshold: `管理费用占收入比基准 ${percent(ADMIN_RATIO_BENCHMARK, 0)}（行业常见水平）：低于=正常，高于=需关注，超过 ${percent(ADMIN_RATIO_RISK, 0)}（基准 1.6 倍）=需干预；刚性成本占收入比 > ${percent(RIGID_RATIO_WARN, 0)} 表示收入下滑时成本难以下压。`,
        });

        // ---------- ④ 亏损游戏 ----------
        const lossGames = gameRows.value.filter((g) => g.spend > 0 && g.totalCost > g.accrualRevenue);
        const lossAmount = lossGames.reduce((s, g) => s + (g.totalCost - g.accrualRevenue), 0);
        const lossNames = lossGames.slice(0, 3).map((g) => g.name).join('、');
        const lossLevel: InsightLevel = lossGames.length >= LOSS_GAME_WARN ? 'risk' : lossGames.length > 0 ? 'watch' : 'info';
        list.push({
            id: 'loss',
            level: lossLevel,
            title: '成本超过收入的游戏',
            text:
                lossGames.length > 0
                    ? `有 ${lossGames.length} 个游戏的总成本超过其应确认收入，处于亏损状态（${lossNames}${lossGames.length > 3 ? ' 等' : ''}），` +
                      `合计成本超出收入 ${money(lossAmount)}；按当前口径总成本 ${money(cur.totalCost)} 计，占公司总成本 ${percent(
                          share(lossAmount, cur.totalCost),
                      )}。`
                    : `当前筛选范围内 ${comma(gameRows.value.length)} 个游戏中，没有游戏的总成本超过其应确认收入（0 个亏损）。`,
            threshold: `判定条件：该游戏本期总成本（当前口径）> 应确认收入，且本期有投放消耗；亏损游戏数 ≥ ${LOSS_GAME_WARN} 个=需干预，1~2 个=需关注，0 个=正常。`,
        });

        return list;
    });
</script>

<style scoped lang="scss">
    .ins {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .ins__item {
        display: flex;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
    }

    .ins__idx {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
        font-size: var(--oa-fs-xs);
        font-weight: 700;
        line-height: 20px;
        text-align: center;
    }

    .ins__body {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .ins__head {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .ins__tag {
        padding: 0 6px;
        border-radius: 8px;
        font-size: 11px;
        line-height: 16px;
        font-weight: 600;
    }

    .ins__tag--risk {
        background: var(--oa-danger-soft);
        color: #d64545;
    }

    .ins__tag--watch {
        background: var(--oa-warning-soft);
        color: #c96a1c;
    }

    .ins__tag--info {
        background: var(--oa-success-soft);
        color: #0e9455;
    }

    .ins__title {
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .ins__text {
        margin: 0;
        font-size: var(--oa-fs-sm);
        line-height: 1.8;
        color: var(--oa-text-2);
    }

    .ins__threshold {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }
</style>
