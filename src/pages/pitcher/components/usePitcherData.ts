import { computed } from 'vue';
import { store } from '@/domain/store';
import { CAMPAIGNS, CENTERS, DEPARTMENTS, GAME_MAP, ORG_MAP, PLATFORMS } from '@/domain/dimensions';
import type { AnalysisFilter, CampaignMeta, MetricRow } from '@/domain/types';
import { useAnalysisFilter } from '@/composables/useAnalysisFilter';

/**
 * 投手人效页共享数据层（页面内单例）
 *
 * 为什么独立成一层：
 *   1) 页面里有 6 个区块都要用「投手行 + 团队汇总 + 中位数」这几个量，
 *      放在模块级 computed 里只算一次，避免每个组件各自重复调 store；
 *   2) 所有组件依然「无 props、自读 useAnalysisFilter()」——筛选条件一变，
 *      这一层的 computed 自动重算，各组件全部跟着变。
 */

const { filter } = useAnalysisFilter();

// ------------------------------------------------------------------
// 组织锚点：一律「按名称查找」，绝不硬编码 id（id 属实现细节，可能被调整）
// ------------------------------------------------------------------
/** 发行中心（唯一有投放投手的中心） */
export const ISSUE_CENTER = CENTERS.find((c) => c.name === '发行中心') ?? null;
/** 投放部（投手所在部门；其子树口径 = 全部投手的合计） */
const AD_DEPARTMENT = DEPARTMENTS.find((d) => d.name === '投放部') ?? null;

// ------------------------------------------------------------------
// 投手行
// ------------------------------------------------------------------
/** 个人层的全部节点行（含研发 / 运营 / 素材 / 中台 / 职能等非投放岗位） */
const pitcherLevelRows = computed<MetricRow[]>(() => store.queryRows(filter, 'pitcher'));

/**
 * 真正的投手（`OrgNode.isPitcher === true`）
 *
 * 注意：`store.queryRows(filter, 'pitcher')` 返回的是「个人」这一层的**全部**成员。
 * 研发 / 中台 / 职能 / 运营 / 素材的员工同样是 pitcher 层级，但他们没有投放：
 * 消耗恒为 0、经营利润 = −人力成本、人效比为 −1。
 * 若不过滤，本页的「投手人数 / 平均人效比 / 排行榜 / 四象限」全部会算错，
 * 因此统一按 isPitcher 收口，全页共用这一份数据。
 */
const pitcherRows = computed<MetricRow[]>(() =>
    pitcherLevelRows.value.filter((r) => ORG_MAP.get(r.key)?.isPitcher === true),
);

/** 个人层总人数（含非投放岗），用于向用户解释人数口径 */
const levelRowCount = computed(() => pitcherLevelRows.value.length);

export interface PitcherTotals {
    /** 投手人数 */
    count: number;
    /** 投手合计人工成本 */
    laborCost: number;
    /** 投手合计经营利润 */
    operatingProfit: number;
    /** 投手合计应确认收入 */
    accrualRevenue: number;
    /** 投手合计投放消耗 */
    spend: number;
    /** 平均人效比（各投手人效比的算术平均） */
    avgEfficiency: number;
    /** 合计人效比 = 合计经营利润 ÷ 合计人力成本（与 store 的聚合口径一致） */
    teamEfficiency: number;
    /** 人均经营利润 */
    perCapitaProfit: number;
    /** 人效比 > 1 的投手数 */
    overOne: number;
    /** 人效比 < 1（含亏损）的投手数 */
    underOne: number;
    /** 当期零投放的投手 */
    idlePitchers: MetricRow[];
}

const sum = (list: MetricRow[], pick: (r: MetricRow) => number): number => list.reduce((s, r) => s + pick(r), 0);

const totals = computed<PitcherTotals>(() => {
    const rows = pitcherRows.value;
    const count = rows.length;
    const laborCost = sum(rows, (r) => r.laborCost);
    const operatingProfit = sum(rows, (r) => r.operatingProfit);
    const accrualRevenue = sum(rows, (r) => r.accrualRevenue);
    const spend = sum(rows, (r) => r.spend);
    return {
        count,
        laborCost,
        operatingProfit,
        accrualRevenue,
        spend,
        avgEfficiency: count ? sum(rows, (r) => r.efficiencyRatio) / count : 0,
        teamEfficiency: laborCost > 0 ? operatingProfit / laborCost : 0,
        perCapitaProfit: count ? operatingProfit / count : 0,
        // 阈值：人效比 1.0 = 该投手创造的经营利润刚好覆盖自身人力成本
        overOne: rows.filter((r) => r.efficiencyRatio > 1).length,
        underOne: rows.filter((r) => r.efficiencyRatio < 1).length,
        idlePitchers: rows.filter((r) => r.spend <= 0),
    };
});

/** 发行中心的经营指标（人工成本口径：工资 + 医社保 + 个税 + 项目奖金） */
const issueCenterMetrics = computed(() =>
    ISSUE_CENTER ? store.metricsOf(filter, 'center', ISSUE_CENTER.id) : null,
);

/**
 * 投手团队合计的「累计口径」指标（累计预估 ROI / 回收完成度 / 人效比）
 * 取投放部（投手所在部门）的组织口径：其子树恰好是全部投手 + 他们的组，
 * 是这几个比率型指标唯一可靠的合计来源（比率不能逐行相加）。
 * 筛选范围把投放部排除在 scope 之外时返回 null，调用方需要兜底。
 */
const teamMetrics = computed(() => (AD_DEPARTMENT ? store.metricsOf(filter, 'department', AD_DEPARTMENT.id) : null));

// ------------------------------------------------------------------
// 小组行（区块 4）
// ------------------------------------------------------------------
/** 小组行：只保留当期有投放的小组，按经营利润降序 */
const groupRows = computed<MetricRow[]>(() =>
    store.queryRows(filter, 'group')
        .filter((r) => r.spend > 0)
        .sort((a, b) => b.operatingProfit - a.operatingProfit),
);

// ------------------------------------------------------------------
// 投手 → 投放组合 / 游戏
// ------------------------------------------------------------------
const CAMPAIGNS_BY_PITCHER = new Map<string, CampaignMeta[]>();
for (const c of CAMPAIGNS) {
    const arr = CAMPAIGNS_BY_PITCHER.get(c.pitcherId);
    if (arr) arr.push(c);
    else CAMPAIGNS_BY_PITCHER.set(c.pitcherId, [c]);
}

/** 该投手的投放组合（配置口径，不随期间筛选变化） */
export function campaignsOf(pitcherId: string): CampaignMeta[] {
    return CAMPAIGNS_BY_PITCHER.get(pitcherId) ?? [];
}

/** 该投手负责的游戏 id（去重） */
export function gameIdsOf(pitcherId: string): string[] {
    return [...new Set(campaignsOf(pitcherId).map((c) => c.gameId))];
}

/** 该投手负责的游戏名（去重，按游戏表顺序） */
export function gameNamesOf(pitcherId: string): string[] {
    return gameIdsOf(pitcherId).map((id) => GAME_MAP.get(id)?.name ?? id);
}

// ------------------------------------------------------------------
// 投手 → 各平台消耗（区块 3「主投平台」、区块 5 对比）
// ------------------------------------------------------------------
export interface PlatformSpend {
    id: string;
    name: string;
    color: string;
    spend: number;
    /** 占该投手当期消耗的比例 */
    share: number;
}

/**
 * 每个投手在各平台的**真实当期消耗**（降序）。
 * CampaignMeta 里只有 intensity 配置系数、没有金额，用系数猜消耗量级不严谨；
 * 这里改走 store：把范围收窄到「该投手 + 该平台」取平台指标的 spend。
 * 成本：19 人 × 4 平台 = 76 次 metricsOf，实测 < 2ms，且只在筛选变化时算一次。
 */
const platformSpendMap = computed<Map<string, PlatformSpend[]>>(() => {
    const map = new Map<string, PlatformSpend[]>();
    const platforms = filter.platformIds.length
        ? PLATFORMS.filter((p) => filter.platformIds.includes(p.id))
        : PLATFORMS;
    for (const row of pitcherRows.value) {
        const list: PlatformSpend[] = [];
        for (const p of platforms) {
            const scoped: AnalysisFilter = { ...filter, pitcherIds: [row.key], platformIds: [p.id] };
            const spend = store.metricsOf(scoped, 'platform', p.id)?.spend ?? 0;
            if (spend > 0) {
                list.push({ id: p.id, name: p.name, color: p.color, spend, share: row.spend > 0 ? spend / row.spend : 0 });
            }
        }
        list.sort((a, b) => b.spend - a.spend);
        map.set(row.key, list);
    }
    return map;
});

/** 该投手的主投平台（当期消耗最大者；无投放返回 null） */
export function mainPlatformOf(pitcherId: string): PlatformSpend | null {
    return platformSpendMap.value.get(pitcherId)?.[0] ?? null;
}

/** 该投手的分平台消耗明细 */
export function platformSpendsOf(pitcherId: string): PlatformSpend[] {
    return platformSpendMap.value.get(pitcherId) ?? [];
}

// ------------------------------------------------------------------
// 人效比分档与四象限
// ------------------------------------------------------------------
/**
 * 人效比着色阈值（全页统一）：
 *   ≥ 2   深绿 #0e9455  高杠杆：创造两倍以上自身人力成本的经营利润
 *   1~2   绿   #12b566  已覆盖自身人力成本
 *   0~1   橙   #ff9140  有利润但未覆盖自身人力成本
 *   < 0   红   #fd6464  经营亏损
 */
export function efficiencyColor(eff: number): string {
    if (!Number.isFinite(eff) || eff < 0) return '#fd6464';
    if (eff < 1) return '#ff9140';
    if (eff < 2) return '#12b566';
    return '#0e9455';
}

export type QuadrantKey = 'core' | 'efficient' | 'risk' | 'watch';

export interface QuadrantMeta {
    key: QuadrantKey;
    name: string;
    /** 角标 / 图例文字色 */
    color: string;
    /** markArea 浅色底 */
    bg: string;
    /** 业务含义（悬浮与图例说明用） */
    desc: string;
}

/**
 * 四象限定义（X = 投放消耗，分割线取团队消耗中位数；Y = 经营利润，分割线取盈亏平衡 0）
 *   右上 高消耗 + 正利润 → 核心投手
 *   左上 低消耗 + 正利润 → 高效小盘
 *   右下 高消耗 + 负利润 → 高风险
 *   左下 低消耗 + 负利润 → 待观察
 */
export const QUADRANTS: Record<QuadrantKey, QuadrantMeta> = {
    core: {
        key: 'core',
        name: '核心投手',
        color: '#0e9455',
        bg: 'rgba(18, 181, 102, 0.07)',
        desc: '消耗高于团队中位数且经营利润为正：团队利润的主力盘面，预算与素材优先保障。',
    },
    efficient: {
        key: 'efficient',
        name: '高效小盘',
        color: '#2f7ce8',
        bg: 'rgba(77, 148, 250, 0.07)',
        desc: '消耗不高于中位数但经营利润为正：单位投入产出效率高，可评估加预算测试规模化空间。',
    },
    risk: {
        key: 'risk',
        name: '高风险',
        color: '#fd6464',
        bg: 'rgba(253, 100, 100, 0.08)',
        desc: '消耗高于中位数且经营利润为负：投入大且不赚钱，需立即复盘负责的盘面与素材。',
    },
    watch: {
        key: 'watch',
        name: '待观察',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        desc: '消耗不高于中位数且经营利润为负：投入不大但已亏损（含当期完全没有投放的投手），观察期内无改善则调整盘面分配。',
    },
};

/** 中位数（偶数个取中间两值均值） */
export function medianOf(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 团队消耗中位数：四象限的横向分割线 */
const medianSpend = computed(() => medianOf(pitcherRows.value.map((r) => r.spend)));

/**
 * 判定某投手所属象限
 * 阈值：消耗**严格高于**团队消耗中位数 = 高消耗侧（用严格大于而不是 >=，
 * 否则当多数投手消耗为 0（单月 / 单游戏筛选）时，中位数 = 0 会把「零投放投手」
 * 全部算成高消耗，四象限与风险标签都会失真）。
 */
export function quadrantOf(row: MetricRow, median: number): QuadrantKey {
    const highSpend = row.spend > median;
    if (highSpend) return row.operatingProfit >= 0 ? 'core' : 'risk';
    return row.operatingProfit >= 0 ? 'efficient' : 'watch';
}

// ------------------------------------------------------------------
// 排序工具
// ------------------------------------------------------------------
const byOperatingProfitDesc = (a: MetricRow, b: MetricRow): number => b.operatingProfit - a.operatingProfit;
const byEfficiencyDesc = (a: MetricRow, b: MetricRow): number => b.efficiencyRatio - a.efficiencyRatio;
const bySpendDesc = (a: MetricRow, b: MetricRow): number => b.spend - a.spend;

/** 统一出口：组件里 `const { pitcherRows, totals, ... } = usePitcherData()` */
export function usePitcherData() {
    return {
        filter,
        ISSUE_CENTER,
        pitcherRows,
        levelRowCount,
        hasPitchers: computed(() => pitcherRows.value.length > 0),
        totals,
        issueCenterMetrics,
        teamMetrics,
        groupRows,
        medianSpend,
        platformSpendMap,
        byOperatingProfitDesc,
        byEfficiencyDesc,
        bySpendDesc,
    };
}
