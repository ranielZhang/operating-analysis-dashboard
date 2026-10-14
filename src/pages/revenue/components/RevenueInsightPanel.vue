<template>
    <PanelCard title="收入质量洞察" subtitle="由当前筛选区间的真实数据按固定阈值自动生成，非人工文案">
        <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无可分析的收入数据" />

        <div v-else class="ins">
            <article
                v-for="item in insights"
                :key="item.key"
                class="ins__item"
                :class="`ins__item--${item.level}`"
            >
                <header class="ins__head">
                    <span class="ins__title">{{ item.title }}</span>
                    <span class="ins__tag oa-num">{{ item.tag }}</span>
                </header>
                <p class="ins__text">{{ item.text }}</p>
                <p class="ins__rule">判定规则：{{ item.rule }}</p>
            </article>

            <p class="ins__note">
                以上比例阈值（75% / 45% / 70% / 50% / 15% / 1.0）均为页面内固定常量，随全局筛选条件实时重算；
                金额单位与口径同上方各卡片（应确认收入为权责发生制口径，已到账收入为银行流水口径）。
            </p>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAME_MAP, PLATFORM_MAP } from '@/domain/dimensions';
    import { store } from '@/domain/store';
    import { money, percent, ratio } from '@/utils/format';
    import { hasRevenue, safeRatio, subjectAmount } from './revenueTheme';

    /** 收入质量洞察：结构依赖度 / 投产比 / 平台集中度 / 到账节奏，四条自动结论 */
    defineOptions({ name: 'RevenueInsightPanel' });

    const { filter, hasFilter } = useAnalysisFilter();

    /** 结论主语：全公司 or 当前筛选范围（避免在筛选后仍写「公司整体」造成误读） */
    const subject = computed(() => (hasFilter.value ? '当前筛选范围' : '公司整体'));

    /** 阈值集中在此，便于评审与后续调整（页面文案与判定同源） */
    const THRESHOLD = {
        /** IAA 合计占比 ≥ 75% 视为以广告变现为主 */
        iaaHeavy: 0.75,
        /** IAA 合计占比 ≥ 45% 视为广告与内购并重 */
        iaaBalanced: 0.45,
        /** 前两大平台合计占比 ≥ 70% 视为高度集中 */
        platformHigh: 0.7,
        /** ≥ 50% 视为中等集中 */
        platformMedium: 0.5,
        /** 账面到账缺口占应确认收入 ≥ 15% 视为到账明显滞后 */
        cashGapWarn: 0.15,
        /** 收入/消耗 比 1.0 = 当期收入覆盖当期消耗 */
        breakEven: 1,
        /** 结算滞后 ≥ 45 天视为长滞后渠道 */
        longSettleLag: 45,
    };

    type InsightLevel = 'info' | 'success' | 'warn' | 'danger';

    interface InsightItem {
        key: string;
        level: InsightLevel;
        title: string;
        tag: string;
        text: string;
        rule: string;
    }

    const metrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    const hasData = computed(() => hasRevenue(metrics.value));

    /** 有收入或有投放的游戏（用于投产比与变现结构计数） */
    const games = computed(() =>
        store.queryRows(filter, 'game').filter((row) => row.accrualRevenue > 0 || row.spend > 0),
    );

    /** 有收入的平台（用于集中度与结算滞后加权） */
    const platforms = computed(() =>
        store.queryRows(filter, 'platform')
            .filter((row) => row.accrualRevenue > 0)
            .sort((a, b) => b.accrualRevenue - a.accrualRevenue),
    );

    const insights = computed<InsightItem[]>(() => {
        const m = metrics.value;
        if (!hasRevenue(m)) return [];
        const list: InsightItem[] = [];

        const accrual = m?.accrualRevenue ?? 0;
        const llz = subjectAmount(m?.revenueByType, 'liuliangzhu');
        const adGold = subjectAmount(m?.revenueByType, 'adGold');
        const iap = subjectAmount(m?.revenueByType, 'iapShare');
        const iaa = llz + adGold;
        const iaaRate = safeRatio(iaa, accrual);
        const gameList = games.value;

        /* ---------- ① 变现结构：IAA / IAP 依赖度 ---------- */
        if (accrual > 0) {
            const struct = iaaRate >= THRESHOLD.iaaHeavy
                ? { name: 'IAA 广告变现为主', level: 'warn' as InsightLevel, suffix: '，收入对媒体 eCPM 与广告填充率高度敏感，媒体侧一次降价就会直接打到收入大盘' }
                : iaaRate >= THRESHOLD.iaaBalanced
                  ? { name: 'IAA 与内购分成并重', level: 'info' as InsightLevel, suffix: '，广告变现与内购分成互为缓冲，单一变现方式波动不至于击穿整体' }
                  : { name: '以内购分成（IAP）为主', level: 'info' as InsightLevel, suffix: '，收入更依赖用户付费深度与渠道分成比例，需要盯 LTV 与渠道结算口径' };
            const iaaGames = gameList.filter((row) => GAME_MAP.get(row.key)?.monetize === 'iaa');
            const iaaGameRevenue = iaaGames.reduce((sum, row) => sum + row.accrualRevenue, 0);
            list.push({
                key: 'structure',
                level: struct.level,
                title: '变现结构：IAA 与 IAP 的依赖度',
                tag: `IAA 占 ${percent(iaaRate)}`,
                text:
                    `流量主收入 ${money(llz)}（占应确认收入 ${percent(safeRatio(llz, accrual))}）、广告金 ${money(adGold)}（占 ${percent(safeRatio(adGold, accrual))}），` +
                    `IAA 合计 ${money(iaa)} 占 ${percent(iaaRate)}，分成收入 ${money(iap)} 占 ${percent(safeRatio(iap, accrual))}，` +
                    `${subject.value}的变现以「${struct.name}」为主${struct.suffix}。` +
                    `${gameList.length} 个有收入的游戏中有 ${iaaGames.length} 个为纯 IAA 变现，合计贡献应确认收入 ${money(iaaGameRevenue)}（占 ${percent(safeRatio(iaaGameRevenue, accrual))}）。`,
                rule: `IAA 合计（流量主 + 广告金）占应确认收入 ≥ ${percent(THRESHOLD.iaaHeavy, 0)} 记为「以广告变现为主」，${percent(THRESHOLD.iaaBalanced, 0)}~${percent(THRESHOLD.iaaHeavy, 0)} 为「两者并重」，< ${percent(THRESHOLD.iaaBalanced, 0)} 为「以内购分成为主」。`,
            });
        }

        /* ---------- ② 收入 / 消耗 比 ---------- */
        const companyRatio = safeRatio(accrual, m?.spend ?? 0);
        const gameRatios = gameList
            .filter((row) => row.spend > 0)
            .map((row) => ({ name: row.name, value: safeRatio(row.accrualRevenue, row.spend) }));
        const above = gameRatios.filter((item) => item.value > companyRatio);
        const belowOne = gameRatios.filter((item) => item.value < THRESHOLD.breakEven);
        const worst = belowOne.slice().sort((a, b) => a.value - b.value)[0];
        list.push({
            key: 'ratio',
            level: companyRatio >= THRESHOLD.breakEven ? 'success' : 'warn',
            title: '收入 / 消耗 比：当期回收效率',
            tag: `${ratio(companyRatio)} 倍`,
            text:
                `本期收入 / 消耗 比为 ${ratio(companyRatio)}（每投放 1 元消耗，当期确认 ${ratio(companyRatio)} 元应确认收入）。` +
                `${gameRatios.length} 个有投放的游戏中有 ${above.length} 个高于公司平均${gameRatios.length ? `（公司平均 ${ratio(companyRatio)}）` : ''}，` +
                `${belowOne.length} 个仍低于 ${ratio(THRESHOLD.breakEven)}${worst ? `，最低的是 ${worst.name}（${ratio(worst.value)}）` : ''}；` +
                `低于 1.0 说明当期收入尚未覆盖当期消耗，要靠后续月份的延迟回收补回，属于放量期的正常现象但需要盯住回收进度。`,
            rule: `游戏口径「应确认收入 ÷ 投放消耗」> 公司整体比值记为「高于平均」；< ${ratio(THRESHOLD.breakEven)} 记为「当期消耗未被当期收入覆盖」。`,
        });

        /* ---------- ③ 平台收入集中度 ---------- */
        const platformList = platforms.value;
        const platformTotal = platformList.reduce((sum, row) => sum + row.accrualRevenue, 0);
        if (platformList.length) {
            const top2 = platformList.slice(0, 2);
            const top2Share = safeRatio(top2.reduce((sum, row) => sum + row.accrualRevenue, 0), platformTotal);
            const top1 = platformList[0];
            const top1Share = safeRatio(top1.accrualRevenue, platformTotal);
            const conc =
                top2Share >= THRESHOLD.platformHigh
                    ? { level: 'danger' as InsightLevel, verdict: '高度集中', suffix: '平台返点率、结算周期或审核口径一变，收入与到账节奏会同步受冲击，建议补充第二梯队平台的收入占比' }
                    : top2Share >= THRESHOLD.platformMedium
                      ? { level: 'warn' as InsightLevel, verdict: '中等集中', suffix: '需要持续跟踪第一大平台的返点与结算政策变化' }
                      : { level: 'success' as InsightLevel, verdict: '较为分散', suffix: '单一平台波动对整体收入影响有限' };
            /** 已按平台筛选时，集中度只在所选平台范围内成立，必须显式提示 */
            const caveat = filter.platformIds.length ? '（当前已按平台筛选，集中度仅反映所选平台范围）' : '';
            list.push({
                key: 'platform',
                level: conc.level,
                title: '平台收入集中度',
                tag: `前二占 ${percent(top2Share)}`,
                text:
                    `${subject.value}内当期有收入的平台共 ${platformList.length} 个，` +
                    `${top2.map((row) => `${row.name} ${percent(safeRatio(row.accrualRevenue, platformTotal))}`).join(' + ')} 合计占应确认收入 ${percent(top2Share)}，` +
                    `其中 ${top1.name} 一家占 ${percent(top1Share)}；判定为「${conc.verdict}」，${conc.suffix}。${caveat}`,
                rule: `前两大平台收入合计占比 ≥ ${percent(THRESHOLD.platformHigh, 0)} 记为高度集中，${percent(THRESHOLD.platformMedium, 0)}~${percent(THRESHOLD.platformHigh, 0)} 为中等集中，< ${percent(THRESHOLD.platformMedium, 0)} 为分散。`,
            });
        }

        /* ---------- ④ 到账节奏与结算滞后 ---------- */
        const cashGap = accrual - (m?.cashRevenue ?? 0);
        const cashGapShare = safeRatio(cashGap, accrual);
        const gapClause =
            cashGap >= 0
                ? `比应确认收入少 ${money(cashGap)}（相当于应确认收入的 ${percent(cashGapShare)}），这部分正是结算滞后压住的应收款`
                : `比应确认收入多 ${money(-cashGap)}（相当于应确认收入的 ${percent(Math.abs(cashGapShare))}），本期到账领先于收入确认，通常是前期投放的延迟结算在本期集中到账`;
        if (platformList.length) {
            const weightedLag = Math.round(
                platformList.reduce(
                    (sum, row) => sum + safeRatio(row.accrualRevenue, platformTotal) * (PLATFORM_MAP.get(row.key)?.settleLagDays ?? 0),
                    0,
                ),
            );
            const longLagRows = platformList.filter(
                (row) => (PLATFORM_MAP.get(row.key)?.settleLagDays ?? 0) >= THRESHOLD.longSettleLag,
            );
            const longLagShare = safeRatio(
                longLagRows.reduce((sum, row) => sum + row.accrualRevenue, 0),
                platformTotal,
            );
            const longest = platformList
                .slice()
                .sort((a, b) => (PLATFORM_MAP.get(b.key)?.settleLagDays ?? 0) - (PLATFORM_MAP.get(a.key)?.settleLagDays ?? 0))[0];
            const longestLag = PLATFORM_MAP.get(longest.key)?.settleLagDays ?? 0;
            list.push({
                key: 'settlement',
                level: cashGap >= 0 && cashGapShare >= THRESHOLD.cashGapWarn ? 'warn' : 'info',
                title: '到账节奏：结算滞后造成的确认差',
                tag: `加权滞后 ${weightedLag} 天`,
                text:
                    `已到账收入 ${money(m?.cashRevenue ?? 0)}，${gapClause}；` +
                    `按平台收入加权的平均结算滞后约 ${weightedLag} 天，其中 ${longest.name} 最长、滞后 ${longestLag} 天（占收入 ${percent(safeRatio(longest.accrualRevenue, platformTotal))}），` +
                    `结算滞后 ≥ ${THRESHOLD.longSettleLag} 天的平台合计占收入 ${percent(longLagShare)}。` +
                    `时点存量「应收未收」${money(m?.receivable ?? 0)}，是存量用户的未来价值，与到账缺口共同构成现金与利润的时间差。`,
                rule: `加权滞后 = Σ(平台收入占比 × 平台结算滞后天数，取自 PLATFORM_MAP)；账面到账缺口（应确认 − 已到账）占应确认收入 ≥ ${percent(THRESHOLD.cashGapWarn, 0)} 记为「到账明显滞后」；缺口为负表示本期到账领先于收入确认。`,
            });
        }

        return list;
    });
</script>

<style scoped lang="scss">
    .ins {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
    }

    .ins__item {
        padding: 9px 12px;
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
    }

    .ins__item--success {
        border-left-color: var(--oa-success);
    }

    .ins__item--warn {
        border-left-color: var(--oa-warning);
        background: var(--oa-warning-soft);
    }

    .ins__item--danger {
        border-left-color: var(--oa-danger);
        background: var(--oa-danger-soft);
    }

    .ins__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    }

    .ins__title {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .ins__tag {
        flex: 0 0 auto;
        padding: 1px 6px;
        border-radius: 8px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        font-size: 11px;
        color: var(--oa-text-2);
    }

    .ins__text {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.75;
        color: var(--oa-text-2);
    }

    .ins__rule {
        margin: 4px 0 0;
        font-size: 11px;
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    .ins__note {
        margin: 2px 0 0;
        font-size: 11px;
        line-height: 1.7;
        color: var(--oa-text-4);
    }
</style>
