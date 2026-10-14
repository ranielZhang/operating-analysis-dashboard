<template>
    <PanelCard title="组织 × 平台 交叉矩阵" :subtitle="panelSubtitle" plain>
        <template #actions>
            <el-radio-group v-model="metricKey" size="small">
                <el-radio-button v-for="o in METRIC_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="orgDim" size="small">
                <el-radio-button value="group">小组层级</el-radio-button>
                <el-radio-button value="pitcher">投手层级</el-radio-button>
            </el-radio-group>
        </template>

        <PanelEmptyState v-if="isEmpty" text="当前筛选条件下暂无组织或平台数据，请调整筛选范围" />
        <template v-else>
            <div class="cm-scroll oa-scroll">
                <table class="cm-table">
                    <thead>
                        <tr>
                            <th class="cm-corner">组织 \ 平台</th>
                            <th v-for="p in platformList" :key="p.id" class="cm-head">
                                <span class="cm-head__dot" :style="{ background: p.color }" />
                                <span class="cm-head__name">{{ p.name }}</span>
                            </th>
                            <th class="cm-head cm-head--sum">合计</th>
                        </tr>
                        <tr>
                            <th class="cm-corner cm-corner--sub">
                                <span class="cm-head__unit">指标：{{ currentMetric.label }}</span>
                            </th>
                            <th v-for="p in platformList" :key="`u-${p.id}`" class="cm-head--sub">单位：{{ currentMetric.unit }}</th>
                            <th class="cm-head--sub cm-head--sum">单位：{{ currentMetric.unit }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in matrix.rows" :key="row.id">
                            <th class="cm-org">
                                <span class="cm-org__name">{{ row.name }}</span>
                                <span class="cm-org__meta">{{ row.meta }}</span>
                            </th>
                            <td v-for="cell in row.cells" :key="`${row.id}-${cell.platformId}`" class="cm-cell-wrap">
                                <el-tooltip
                                    placement="top"
                                    effect="dark"
                                    :show-after="80"
                                    :disabled="!cell.metrics"
                                    popper-class="cm-tip"
                                >
                                    <template #content>
                                        <div class="cm-tip__title">{{ cell.orgName }} · {{ cell.platformName }}</div>
                                        <div class="cm-tip__row">
                                            <span>经营利润</span>
                                            <b :class="cell.metrics ? trendClass(cell.metrics.operatingProfit) : ''">{{
                                                cell.metrics ? money(cell.metrics.operatingProfit) : '—'
                                            }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>投放消耗</span><b>{{ cell.metrics ? money(cell.metrics.spend) : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>累计预估 ROI</span>
                                            <b>{{ cell.metrics ? `${ratio(cell.metrics.forecastRoi)} 倍` : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>人数</span><b>{{ cell.metrics ? `${cell.metrics.headcount} 人` : '—' }}</b>
                                        </div>
                                    </template>
                                    <div class="cm-cell" :style="{ background: cell.bg, color: cell.color }">
                                        {{ cell.text }}
                                    </div>
                                </el-tooltip>
                            </td>
                            <td class="cm-cell-wrap cm-cell-wrap--sum">
                                <el-tooltip
                                    placement="top"
                                    effect="dark"
                                    :show-after="80"
                                    :disabled="!row.sum.metrics"
                                    popper-class="cm-tip"
                                >
                                    <template #content>
                                        <div class="cm-tip__title">{{ row.name }} · 全平台合计</div>
                                        <div class="cm-tip__row">
                                            <span>经营利润</span>
                                            <b :class="row.sum.metrics ? trendClass(row.sum.metrics.operatingProfit) : ''">{{
                                                row.sum.metrics ? money(row.sum.metrics.operatingProfit) : '—'
                                            }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>投放消耗</span><b>{{ row.sum.metrics ? money(row.sum.metrics.spend) : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>累计预估 ROI</span>
                                            <b>{{ row.sum.metrics ? `${ratio(row.sum.metrics.forecastRoi)} 倍` : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>人数</span><b>{{ row.sum.metrics ? `${row.sum.metrics.headcount} 人` : '—' }}</b>
                                        </div>
                                    </template>
                                    <div class="cm-cell cm-cell--sum" :style="{ background: row.sum.bg, color: row.sum.color }">
                                        {{ row.sum.text }}
                                    </div>
                                </el-tooltip>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <th class="cm-org cm-org--sum">
                                <span class="cm-org__name">平台合计</span>
                                <span class="cm-org__meta">矩阵内组织加总</span>
                            </th>
                            <td v-for="(c, i) in matrix.platformTotals" :key="`sum-${i}`" class="cm-cell-wrap cm-cell-wrap--sum">
                                <el-tooltip placement="top" effect="dark" :show-after="80" :disabled="!c.metrics" popper-class="cm-tip">
                                    <template #content>
                                        <div class="cm-tip__title">{{ platformList[i]?.name }} · 矩阵内合计</div>
                                        <div class="cm-tip__row">
                                            <span>经营利润</span>
                                            <b :class="c.metrics ? trendClass(c.metrics.operatingProfit) : ''">{{
                                                c.metrics ? money(c.metrics.operatingProfit) : '—'
                                            }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>投放消耗</span><b>{{ c.metrics ? money(c.metrics.spend) : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>累计预估 ROI</span><b>{{ c.metrics ? `${ratio(c.metrics.forecastRoi)} 倍` : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>人数</span><b>{{ c.metrics ? `${c.metrics.headcount} 人` : '—' }}</b>
                                        </div>
                                    </template>
                                    <div class="cm-cell cm-cell--sum" :style="{ background: c.bg, color: c.color }">{{ c.text }}</div>
                                </el-tooltip>
                            </td>
                            <td class="cm-cell-wrap cm-cell-wrap--sum cm-cell-wrap--grand">
                                <el-tooltip placement="top" effect="dark" :show-after="80" :disabled="!matrix.total.metrics" popper-class="cm-tip">
                                    <template #content>
                                        <div class="cm-tip__title">全公司合计 · 矩阵内加总</div>
                                        <div class="cm-tip__row">
                                            <span>经营利润</span>
                                            <b :class="matrix.total.metrics ? trendClass(matrix.total.metrics.operatingProfit) : ''">{{
                                                matrix.total.metrics ? money(matrix.total.metrics.operatingProfit) : '—'
                                            }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>投放消耗</span><b>{{ matrix.total.metrics ? money(matrix.total.metrics.spend) : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>累计预估 ROI</span>
                                            <b>{{ matrix.total.metrics ? `${ratio(matrix.total.metrics.forecastRoi)} 倍` : '—' }}</b>
                                        </div>
                                        <div class="cm-tip__row">
                                            <span>人数</span><b>{{ matrix.total.metrics ? `${matrix.total.metrics.headcount} 人` : '—' }}</b>
                                        </div>
                                    </template>
                                    <div class="cm-cell cm-cell--sum cm-cell--grand" :style="{ background: matrix.total.bg, color: matrix.total.color }">
                                        {{ matrix.total.text }}
                                    </div>
                                </el-tooltip>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="cm-legend">
                <span class="cm-legend__label">{{ currentMetric.label }}（{{ currentMetric.unit }}）</span>
                <span class="cm-legend__tick oa-num">{{ matrix.legend.minText }}</span>
                <span class="cm-legend__bar" :style="{ background: matrix.legend.gradient }" />
                <span class="cm-legend__tick oa-num">{{ matrix.legend.maxText }}</span>
                <span class="cm-legend__note">{{ matrix.legend.note }}</span>
            </div>
            <p class="cm-caliber">{{ matrix.legend.caliber }}</p>

            <p class="cm-insight">
                <span class="cm-insight__tag">一句话洞察</span>{{ matrix.insight }}
            </p>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { store } from '@/domain/store';
    import { GROUPS, PITCHERS, PLATFORMS, CAMPAIGNS, ORG_MAP, orgPath } from '@/domain/dimensions';
    import { useAnalysisFilter, DIM_LABEL } from '@/composables/useAnalysisFilter';
    import { money, ratio, comma, trendClass } from '@/utils/format';
    import type { AnalysisFilter, CampaignMeta, Metrics, OrgNode, PlatformMeta } from '@/domain/types';

    /**
     * 组织 × 平台 交叉矩阵
     * 组织轴（谁在赚钱）× 业务轴（什么在赚钱）：行 = 小组/投手，列 = 平台，格 = 交叉指标。
     * 取数：{ ...filter, platformIds:[平台] } + 组织过滤 → metricsOf(f,'company','company') 即该格合计。
     */
    defineOptions({ name: 'DrillCrossMatrix' });

    type MetricKey = 'operatingProfit' | 'forecastRoi' | 'spend' | 'efficiencyRatio';
    type OrgDim = 'group' | 'pitcher';
    type GradientKind = 'profit' | 'roi' | 'spend';

    interface MetricOption {
        key: MetricKey;
        label: string;
        unit: string;
        kind: GradientKind;
    }

    const METRIC_OPTIONS: MetricOption[] = [
        { key: 'operatingProfit', label: '经营利润', unit: '万元 / 亿元', kind: 'profit' },
        { key: 'forecastRoi', label: '累计预估 ROI', unit: '倍', kind: 'roi' },
        { key: 'spend', label: '投放消耗', unit: '万元 / 亿元', kind: 'spend' },
        { key: 'efficiencyRatio', label: '人效比', unit: '倍', kind: 'profit' },
    ];

    /** 小组 → 投放组合，用于标注「在投 N 人」并判断该组织是否参与投放 */
    const CAMPAIGNS_BY_GROUP = (() => {
        const m = new Map<string, CampaignMeta[]>();
        for (const c of CAMPAIGNS) {
            const arr = m.get(c.groupId) ?? [];
            arr.push(c);
            m.set(c.groupId, arr);
        }
        return m;
    })();

    const { filter } = useAnalysisFilter();

    const metricKey = ref<MetricKey>('operatingProfit');
    const orgDim = ref<OrgDim>('group');

    const currentMetric = computed<MetricOption>(
        () => METRIC_OPTIONS.find((o) => o.key === metricKey.value) ?? METRIC_OPTIONS[0],
    );

    /** 业务范围（平台 / 项目 / 游戏）过滤后的投放组合，用于判断行集合 */
    const scopeCampaigns = computed<CampaignMeta[]>(() => {
        const pf = new Set(filter.platformIds);
        const pj = new Set(filter.projectIds);
        const gm = new Set(filter.gameIds);
        return CAMPAIGNS.filter(
            (c) =>
                (!pf.size || pf.has(c.platformId)) &&
                (!pj.size || pj.has(c.projectId)) &&
                (!gm.size || gm.has(c.gameId)),
        );
    });

    /**
     * 组织轴的行集合 = 本期真实有投放的组织（投放小组 / 投手），并尊重筛选栏的组织范围与业务范围。
     * 只保留投放组织，是为了让「合计列 / 平台合计行 / 全公司合计」与格值口径一致：
     * 若把研发、职能等没有投放的组织也算进来，它们的人工成本会凭空拉低合计，出现行列对不平。
     */
    const orgNodes = computed<OrgNode[]>(() => {
        const scope = scopeCampaigns.value;
        const groupLevel = orgDim.value === 'group';
        const inScope = (gid: string): boolean => scope.some((c) => c.groupId === gid);
        const levelHit = (id: string): boolean =>
            groupLevel ? !filter.groupIds.length || filter.groupIds.includes(id) : !filter.pitcherIds.length || filter.pitcherIds.includes(id);
        const ancestorsHit = (gid: string): boolean => {
            const chain = orgPath(gid).map((n) => n.id);
            if (filter.centerIds.length && !chain.some((id) => filter.centerIds.includes(id))) return false;
            if (filter.departmentIds.length && !chain.some((id) => filter.departmentIds.includes(id))) return false;
            return true;
        };
        return orgDim.value === 'group'
            ? GROUPS.filter((g) => inScope(g.id) && levelHit(g.id) && ancestorsHit(g.id))
            : PITCHERS.filter((p) => inScope(p.parentId as string) && levelHit(p.id) && ancestorsHit(p.parentId as string));
    });
    const platformList = computed<PlatformMeta[]>(() => PLATFORMS);

    /** 交叉取数：组织过滤 + 平台过滤，company 维度即「该组织在该平台上的合计」 */
    const metricsCache = computed<Map<string, Metrics | null>>(() => {
        const base = filter;
        const orgKey = orgDim.value;
        const cache = new Map<string, Metrics | null>();
        for (const org of orgNodes.value) {
            for (const pf of platformList.value) {
                const f: AnalysisFilter = {
                    ...base,
                    centerIds: [],
                    departmentIds: [],
                    groupIds: [],
                    pitcherIds: [],
                    platformIds: [pf.id],
                };
                if (orgKey === 'group') f.groupIds = [org.id];
                else f.pitcherIds = [org.id];
                cache.set(`${org.id}|${pf.id}`, store.metricsOf(f, 'company', 'company'));
            }
        }
        return cache;
    });

    function pick(m: Metrics, key: MetricKey): number {
        return Number(m[key]);
    }

    /** 累加器：只累加可加字段与累计字段，比率类用累加结果重算，避免把比率相加 */
    interface Acc {
        accrual: number;
        cash: number;
        spend: number;
        prepay: number;
        cumSpend: number;
        cumExp: number;
        labor: number;
        admin: number;
        headcount: number;
    }
    type CellMetrics = Pick<
        Metrics,
        | 'accrualRevenue'
        | 'cashRevenue'
        | 'spend'
        | 'prepay'
        | 'laborCost'
        | 'adminCost'
        | 'headcount'
        | 'forecastRoi'
        | 'actualRoi'
        | 'recoveryRate'
        | 'receivable'
        | 'cumSpend'
        | 'cumExp'
    >;

    function zeroAcc(): Acc {
        return { accrual: 0, cash: 0, spend: 0, prepay: 0, cumSpend: 0, cumExp: 0, labor: 0, admin: 0, headcount: 0 };
    }

    function addMetrics(acc: Acc, m: CellMetrics): Acc {
        /*
         * 累计口径直接取 store 透出的 cumSpend / cumExp 求和，而不是从
         * forecastRoi / recoveryRate 反解 —— 反解只在「筛选区间 = 全历史」时成立，
         * 默认近 12 个月时会让行/列/总计的累计比率与格内真值不一致。
         */
        return {
            accrual: acc.accrual + m.accrualRevenue,
            cash: acc.cash + m.cashRevenue,
            spend: acc.spend + m.spend,
            prepay: acc.prepay + m.prepay,
            cumSpend: acc.cumSpend + m.cumSpend,
            cumExp: acc.cumExp + m.cumExp,
            labor: acc.labor + m.laborCost,
            admin: acc.admin + m.adminCost,
            headcount: acc.headcount + m.headcount,
        };
    }

    /** 由累加值导出小计指标（与 store.buildMetrics 同构） */
    function accMetrics(acc: Acc, basis: 'book' | 'operating'): Metrics | null {
        if (acc.spend === 0 && acc.accrual === 0 && acc.cash === 0 && acc.labor === 0) return null;
        const revenue = basis === 'book' ? acc.cash : acc.accrual;
        const businessCost = basis === 'book' ? acc.prepay : acc.spend;
        const bookProfit = acc.cash - acc.prepay - acc.labor - acc.admin;
        const operatingProfit = acc.accrual - acc.spend - acc.labor - acc.admin;
        const profit = basis === 'book' ? bookProfit : operatingProfit;
        return {
            revenue,
            accrualRevenue: acc.accrual,
            cashRevenue: acc.cash,
            revenueByType: { liuliangzhu: 0, adGold: 0, iapShare: revenue },
            businessCost,
            laborCost: acc.labor,
            adminCost: acc.admin,
            totalCost: businessCost + acc.labor + acc.admin,
            costByType: {
                adSpend: acc.spend,
                prepay: acc.prepay,
                salary: 0,
                socialInsurance: 0,
                individualTax: 0,
                projectBonus: 0,
                welfare: 0,
                office: 0,
            },
            profit,
            margin: revenue > 0 ? profit / revenue : 0,
            bookProfit,
            operatingProfit,
            profitGap: operatingProfit - bookProfit,
            bookMargin: acc.cash > 0 ? bookProfit / acc.cash : 0,
            operatingMargin: acc.accrual > 0 ? operatingProfit / acc.accrual : 0,
            spend: acc.spend,
            prepay: acc.prepay,
            prepayBalance: 0,
            receivable: Math.max(0, acc.cumExp - acc.accrual),
            cashGap: Math.max(0, acc.cumExp - acc.accrual),
            forecastRoi: acc.cumSpend > 0 ? acc.cumExp / acc.cumSpend : 0,
            actualRoi: acc.cumSpend > 0 ? acc.accrual / acc.cumSpend : 0,
            recoveryRate: acc.cumExp > 0 ? acc.accrual / acc.cumExp : 0,
            cumSpend: acc.cumSpend,
            cumExp: acc.cumExp,
            efficiencyRatio: acc.labor > 0 ? operatingProfit / acc.labor : 0,
            headcount: acc.headcount,
            perCapitaProfit: acc.headcount > 0 ? operatingProfit / acc.headcount : 0,
        };
    }

    /** 图例渐变色带（与格值着色同一套色相） */
    function legendGradient(kind: GradientKind): string {
        if (kind === 'spend') {
            return 'linear-gradient(90deg, rgba(77,148,250,0.10) 0%, rgba(77,148,250,0.44) 50%, rgba(77,148,250,0.80) 100%)';
        }
        const red = 'rgba(253, 100, 100, ';
        const green = 'rgba(18, 181, 102, ';
        return `linear-gradient(90deg, ${red}0.80) 0%, ${red}0.10) 50%, ${green}0.10) 50%, ${green}0.80) 100%)`;
    }

    const matrix = computed(() => {
        const base = filter;
        const key = metricKey.value;
        const kind = currentMetric.value.kind;
        const orgKey = orgDim.value;
        const platforms = platformList.value;

        // ---------- 1. 逐格取数 ----------
        const cache = metricsCache.value;
        const colAccs: Acc[] = platforms.map(() => zeroAcc());
        const grandAcc = zeroAcc();

        const rows = orgNodes.value.map((org) => {
            const groupId = orgKey === 'group' ? org.id : (org.parentId as string);
            const groupCampaigns = CAMPAIGNS_BY_GROUP.get(groupId) ?? [];
            const groupOfOrg = orgKey === 'group' ? org : ORG_MAP.get(groupId);
            const mine = orgKey === 'pitcher' ? groupCampaigns.filter((c) => c.pitcherId === org.id) : groupCampaigns;
            const invested = new Set(mine.map((c) => c.platformId));

            const rowAcc = zeroAcc();
            const cells = platforms.map((pf, i) => {
                const m = invested.has(pf.id) ? (cache.get(`${org.id}|${pf.id}`) ?? null) : null;
                if (m) {
                    addMetrics(rowAcc, m);
                    addMetrics(colAccs[i], m);
                    addMetrics(grandAcc, m);
                }
                return { platformId: pf.id, platformName: pf.name, orgName: org.name, metrics: m };
            });
            return {
                id: org.id,
                name: org.name,
                meta:
                    orgKey === 'group'
                        ? `${groupOfOrg?.name ?? ''} · 在投 ${new Set(mine.map((c) => c.pitcherId)).size} 人 · ${invested.size} 个平台`
                        : `${groupOfOrg?.name ?? ''} · ${invested.size} 个平台`,
                cells,
                sum: accMetrics(rowAcc, base.basis),
            };
        });

        // 本区间该组织在该平台无投放 → 该格为空（置灰）
        const flat: Array<{ org: string; platform: string; m: Metrics; v: number }> = [];
        for (const r of rows) {
            for (const c of r.cells) {
                if (!c.metrics) continue;
                flat.push({ org: r.name, platform: c.platformName, m: c.metrics, v: pick(c.metrics, key) });
            }
        }

        // ---------- 2. 归一化基准（只看格值，合计不参与，避免整行/整列被拉偏） ----------
        const values = flat.map((c) => c.v).filter((v) => Number.isFinite(v));
        const basis = (v: number): number => (kind === 'roi' ? v - 1 : v);
        const maxAbs = values.length ? Math.max(...values.map((v) => Math.abs(basis(v)))) : 0;
        const denom = kind === 'roi' ? Math.max(maxAbs, 0.15) : Math.max(maxAbs, 1e-9);
        const minV = values.length ? Math.min(...values) : 0;
        const maxV = values.length ? Math.max(...values) : 0;

        const tint = (v: number): { bg: string; color: string } => {
            if (!Number.isFinite(v)) return { bg: 'transparent', color: 'var(--oa-text-4)' };
            const alpha = 0.08 + 0.72 * Math.min(1, Math.abs(basis(v)) / denom);
            if (kind === 'spend') return { bg: `rgba(77, 148, 250, ${alpha.toFixed(3)})`, color: '#1f2937' };
            const positive = kind === 'roi' ? v >= 1 : v >= 0;
            return {
                bg: positive ? `rgba(18, 181, 102, ${alpha.toFixed(3)})` : `rgba(253, 100, 100, ${alpha.toFixed(3)})`,
                color: '#1f2937',
            };
        };
        const text = (v: number | null | undefined): string => {
            if (v === null || v === undefined || !Number.isFinite(v)) return '—';
            if (key === 'forecastRoi') return ratio(v);
            if (key === 'spend' || key === 'operatingProfit') return money(v);
            return comma(v, 2);
        };

        // ---------- 3. 合计（色与文案统一在 cellOf 里算） ----------
        interface CellView {
            text: string;
            bg: string;
            color: string;
            metrics: Metrics | null;
            value: number;
        }
        const cellOf = (m: Metrics | null): CellView => {
            const v = m ? pick(m, key) : Number.NaN;
            const t = tint(v);
            return { text: m ? text(v) : '—', bg: t.bg, color: t.color, metrics: m, value: v };
        };

        const views = rows.map((r) => ({
            id: r.id,
            name: r.name,
            meta: r.meta,
            sum: cellOf(r.sum),
            cells: r.cells.map((c) => {
                const v = c.metrics ? pick(c.metrics, key) : Number.NaN;
                const t = tint(v);
                return {
                    platformId: c.platformId,
                    platformName: c.platformName,
                    orgName: c.orgName,
                    metrics: c.metrics,
                    value: v,
                    text: c.metrics ? text(v) : '—',
                    bg: t.bg,
                    color: t.color,
                };
            }),
        }));

        const platformTotals = colAccs.map((a) => cellOf(accMetrics(a, base.basis)));
        const grand = cellOf(accMetrics(grandAcc, base.basis));

        // ---------- 4. 图例 ----------
        const gradient = legendGradient(kind);
        const legend = {
            gradient,
            minText: text(minV),
            maxText: text(maxV),
            note:
                kind === 'spend'
                    ? '蓝色越深＝该组合消耗越大'
                    : kind === 'roi'
                      ? '绿色＝累计预估 ROI ≥ 1（已回本），红色＝低于 1，颜色越深偏离越大'
                      : '绿色＝正值，红色＝负值，颜色越深绝对值越大',
            caliber: `口径：格值＝「${orgKey === 'group' ? '小组' : '投手'}范围 × 平台」的期间合计；行/列合计与右下角为矩阵内加总`,
        };

        // ---------- 5. 一句话洞察 ----------
        const sentences: string[] = [];
        if (flat.length) {
            const top = flat.reduce((a, b) => (b.v > a.v ? b : a));
            const bottom = flat.reduce((a, b) => (b.v < a.v ? b : a));
            // ROI 最低值只在「有累计消耗」的格里找，避免新组合 0 倍拉低结论
            const roiCandidates = flat.filter((c) => c.m.forecastRoi > 0);
            const roiBottom = roiCandidates.length
                ? roiCandidates.reduce((a, b) => (b.m.forecastRoi < a.m.forecastRoi ? b : a))
                : bottom;
            const worstProfit = flat.reduce((a, b) => (b.m.operatingProfit < a.m.operatingProfit ? b : a));
            const profitCells = flat.filter((c) => c.m.operatingProfit < 0).length;
            const roiCells = flat.filter((c) => c.m.forecastRoi > 0 && c.m.forecastRoi < 1).length;
            const grandV = grand.value;

            if (key === 'operatingProfit') {
                sentences.push(`${top.org}在${top.platform}的经营利润最高（${money(top.v)}）`);
                if (worstProfit.m.operatingProfit < 0) {
                    sentences.push(`${worstProfit.org}在${worstProfit.platform}为负（${money(worstProfit.m.operatingProfit)}）`);
                }
            } else if (key === 'forecastRoi') {
                sentences.push(`${roiBottom.org}在${roiBottom.platform}的累计预估 ROI 最低（${ratio(roiBottom.m.forecastRoi)}）`);
                sentences.push(`${top.org}在${top.platform}最高（${ratio(top.v)}）`);
            } else if (key === 'spend') {
                // 无投放期时矩阵内消耗合计为 0，占比无意义：不给伪造分母，直接降级为绝对额
                sentences.push(
                    grandV > 0
                        ? `${top.org}在${top.platform}的投放消耗最大（${money(top.v)}，占矩阵消耗 ${((top.v / grandV) * 100).toFixed(0)}%）`
                        : `${top.org}在${top.platform}的投放消耗最大（${money(top.v)}）；当期矩阵内无投放消耗，不计算占比`,
                );
            } else {
                sentences.push(`${top.org}在${top.platform}的人效比最高（${comma(top.v, 2)}）`);
                if (bottom.v < 0) sentences.push(`${bottom.org}在${bottom.platform}为负（${comma(bottom.v, 2)}）`);
            }

            const orgScopeText = orgKey === 'group' ? `${rows.length} 个投放小组` : `${rows.length} 名投手`;
            const scopeText = `${orgScopeText} × ${platforms.length} 个平台共 ${flat.length} 个组合`;
            const aggEfficiency =
                grandAcc.labor > 0 ? (grandAcc.accrual - grandAcc.spend - grandAcc.labor - grandAcc.admin) / grandAcc.labor : 0;
            const aggRoi = grandAcc.cumSpend > 0 ? grandAcc.cumExp / grandAcc.cumSpend : 0;
            const tail =
                key === 'operatingProfit'
                    ? `${scopeText}中有 ${profitCells} 个经营利润为负`
                    : key === 'forecastRoi'
                      ? roiCells > 0
                          ? `${scopeText}中有 ${roiCells} 个累计预估 ROI 仍低于 1 倍（未回本）`
                          : `${scopeText}累计预估 ROI 均已超过 1 倍（回本）`
                      : key === 'spend'
                        ? `${scopeText}合计消耗 ${money(grandAcc.spend)}，其中 ${profitCells} 个组合经营利润为负`
                        : `${scopeText}整体人效比（矩阵利润 / 矩阵人工）${comma(aggEfficiency, 2)}，其中 ${profitCells} 个组合经营利润为负`;
            const totalText =
                key === 'spend'
                    ? ''
                    : key === 'forecastRoi'
                      ? `；按消耗加权的整体累计 ROI ${ratio(aggRoi)}`
                      : key === 'efficiencyRatio'
                        ? `；各格区间 ${comma(bottom.v, 2)} ~ ${comma(top.v, 2)}`
                        : `，矩阵内经营利润合计 ${money(grand.value)}`;
            sentences.push(`${tail}${totalText}。`);
        }

        return { rows: views, platformTotals, total: grand, legend, insight: sentences.join('；') };
    });

    const panelSubtitle = computed(
        () =>
            `${orgDim.value === 'group' ? DIM_LABEL.group : DIM_LABEL.pitcher} × ${DIM_LABEL.platform}｜${filter.startMonth} ~ ${filter.endMonth}｜${
                filter.basis === 'book' ? '账面口径' : '经营口径'
            }｜格值 = 该组织在该平台上的期间合计`,
    );

    const isEmpty = computed(() => orgNodes.value.length === 0 || platformList.value.length === 0 || matrix.value.rows.length === 0);
</script>

<style scoped lang="scss">
    /* ---------- 矩阵容器：横向可滚动 ---------- */
    .cm-scroll {
        overflow: auto;
        max-height: 460px;
        min-height: 0;
        border-bottom: 1px solid var(--oa-border-light);
    }

    .cm-table {
        --cm-org-w: 152px;
        --cm-cell-w: 112px;

        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        width: 100%;
        font-size: var(--oa-fs-xs);
    }

    .cm-table th,
    .cm-table td {
        padding: 0;
        font-weight: 400;
        text-align: center;
    }

    /* ---------- 表头（sticky） ---------- */
    .cm-table thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        width: var(--cm-cell-w);
        min-width: var(--cm-cell-w);
        background: #f7f9fc;
        border-bottom: 1px solid var(--oa-border);
        color: var(--oa-text-2);
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        white-space: nowrap;
    }

    .cm-table thead tr:nth-child(2) th {
        top: 33px;
        background: #fbfcfe;
        border-bottom: 1px solid var(--oa-border);
        color: var(--oa-text-4);
        font-size: 11px;
        font-weight: 400;
        padding: 3px 0;
    }

    .cm-head {
        height: 33px;
        display: table-cell;
        vertical-align: middle;
        padding: 0 6px !important;
    }

    .cm-head__dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        margin-right: 5px;
        border-radius: 50%;
        vertical-align: middle;
    }

    .cm-head__name {
        vertical-align: middle;
        color: var(--oa-text-1);
    }

    .cm-head__unit {
        color: var(--oa-text-3);
        font-weight: 500;
    }

    .cm-head--sum {
        background: var(--oa-primary-soft) !important;
        color: var(--oa-primary);
    }

    /* ---------- 首列 sticky（组织名） ---------- */
    .cm-corner,
    .cm-org {
        position: sticky;
        left: 0;
        z-index: 1;
        width: var(--cm-org-w);
        min-width: var(--cm-org-w);
        max-width: var(--cm-org-w);
        text-align: left;
        background: #fbfcfe;
        border-right: 1px solid var(--oa-border);
        white-space: nowrap;
    }

    .cm-corner {
        z-index: 3;
        background: #f7f9fc;
        color: var(--oa-text-2);
        font-weight: 600;
        padding: 0 10px !important;
    }

    .cm-corner--sub {
        font-weight: 400;
    }

    .cm-org {
        height: 40px;
        padding: 5px 10px !important;
        border-bottom: 1px solid var(--oa-border-light);
        display: table-cell;
        vertical-align: middle;
    }

    .cm-org__name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--oa-text-1);
        font-size: var(--oa-fs-xs);
        font-weight: 600;
    }

    .cm-org__meta {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--oa-text-4);
        font-size: 11px;
    }

    .cm-org--sum {
        background: var(--oa-primary-soft);
        color: var(--oa-primary);
    }

    /* ---------- 数据格 ---------- */
    .cm-cell-wrap {
        width: var(--cm-cell-w);
        min-width: var(--cm-cell-w);
        padding: 2px !important;
        border-bottom: 1px solid var(--oa-border-light);
        border-right: 1px solid var(--oa-border-light);
    }

    .cm-cell-wrap--sum {
        background: rgba(77, 148, 250, 0.04);
    }

    .cm-cell-wrap--grand {
        border-right: 0;
    }

    .cm-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        border-radius: var(--oa-radius-sm);
        font-size: var(--oa-fs-xs);
        font-variant-numeric: tabular-nums;
        cursor: default;
        transition:
            box-shadow 0.12s ease,
            filter 0.12s ease;
    }

    .cm-cell:hover {
        box-shadow: inset 0 0 0 1px var(--oa-primary);
        filter: brightness(0.97);
    }

    .cm-cell--sum {
        font-weight: 600;
        background-image: linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35));
    }

    .cm-cell--grand {
        height: 38px;
        font-size: var(--oa-fs-sm);
    }

    /* ---------- 图例 ---------- */
    .cm-legend {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px 2px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .cm-legend__label {
        color: var(--oa-text-2);
        font-weight: 600;
    }

    .cm-legend__bar {
        position: relative;
        flex: 0 0 180px;
        height: 10px;
        border-radius: 5px;
        border: 1px solid var(--oa-border-light);
    }

    .cm-legend__tick {
        color: var(--oa-text-3);
    }

    .cm-legend__note {
        margin-left: 4px;
        color: var(--oa-text-4);
    }

    .cm-caliber {
        margin: 4px 12px 0;
        color: var(--oa-text-4);
        font-size: 11px;
        line-height: 1.6;
    }

    /* ---------- 一句话洞察 ---------- */
    .cm-insight {
        margin: 8px 12px 12px;
        padding: 8px 10px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        color: var(--oa-text-2);
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
    }

    .cm-insight__tag {
        display: inline-block;
        margin-right: 6px;
        padding: 1px 6px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary);
        color: #fff;
        font-size: 11px;
    }

    /* tooltip 内容被 teleport 到 body，scoped 下用 :deep 才能命中 */
    :deep(.cm-tip) {
        max-width: 240px;
    }

    :deep(.cm-tip__title) {
        margin-bottom: 4px;
        font-weight: 600;
    }

    :deep(.cm-tip__row) {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        line-height: 1.7;
    }
</style>
