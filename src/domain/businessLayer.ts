import type { BusinessType, GameMeta, Metrics } from './types';
import {
    AVAILABLE_CASH,
    BUSINESS_DEALS,
    BUSINESS_TYPE_LABEL,
    FLOW_GROSS_FACTOR,
    GAMES,
    MAX_MONTH,
    MIN_MONTH,
    MONTHLY_BUDGET_PROFIT,
    OTHER_DIRECT_PER_GAME,
    PROJECT_MAP,
    type BusinessDeal,
} from './dimensions';

export { BUSINESS_TYPE_LABEL };

function monthCount(start: string, end: string): number {
    const [ys, ms] = start.split('-').map(Number);
    const [ye, me] = end.split('-').map(Number);
    return (ye - ys) * 12 + (me - ms) + 1;
}

/** 演示数据覆盖的月份数，业务记录按这个长度摊 */
export const DATA_MONTH_COUNT = monthCount(MIN_MONTH, MAX_MONTH);

export type BizLevel = 'company' | 'org' | 'businessType' | 'platform' | 'project' | 'game';

export interface BizNode {
    level: BizLevel;
    type?: BusinessType;
    id?: string;
}

export interface SelfGameStat {
    id: string;
    projectId: string;
    accrual: number;
    cash: number;
    labor: number;
    spend: number;
    admin: number;
    operatingProfit: number;
    monetize: GameMeta['monetize'];
    stage: GameMeta['stage'];
}

export function wantsSelf(types: BusinessType[]): boolean {
    return types.length === 0 || types.includes('self_op');
}

export function activeTypes(types: BusinessType[]): BusinessType[] {
    return types.length ? types : ['self_op', 'sale', 'external'];
}

export function emptyBusiness(): Pick<
    Metrics,
    | 'grossAmount'
    | 'cashCollection'
    | 'rdInvest'
    | 'otherDirectCost'
    | 'projectProfit'
    | 'rdShare'
    | 'issueShare'
    | 'budgetProfit'
    | 'profitAttainment'
    | 'availableCash'
    | 'runwayMonths'
    | 'matureProfit'
    | 'newProjectNeed'
    | 'accrualSelf'
    | 'accrualSale'
    | 'accrualExternal'
> {
    return {
        grossAmount: 0,
        cashCollection: 0,
        rdInvest: 0,
        otherDirectCost: 0,
        projectProfit: 0,
        rdShare: 0,
        issueShare: 0,
        budgetProfit: 0,
        profitAttainment: 0,
        availableCash: null,
        runwayMonths: null,
        matureProfit: 0,
        newProjectNeed: 0,
        accrualSelf: 0,
        accrualSale: 0,
        accrualExternal: 0,
    };
}

export function zeroMoney(metrics: Metrics): Metrics {
    const blank = emptyBusiness();
    return {
        ...metrics,
        ...blank,
        revenue: 0,
        accrualRevenue: 0,
        cashRevenue: 0,
        revenueByType: { liuliangzhu: 0, adGold: 0, iapShare: 0 },
        businessCost: 0,
        laborCost: 0,
        adminCost: 0,
        totalCost: 0,
        costByType: {
            adSpend: 0,
            prepay: 0,
            salary: 0,
            socialInsurance: 0,
            individualTax: 0,
            projectBonus: 0,
            welfare: 0,
            office: 0,
        },
        profit: 0,
        margin: 0,
        bookProfit: 0,
        operatingProfit: 0,
        profitGap: 0,
        bookMargin: 0,
        operatingMargin: 0,
        spend: 0,
        prepay: 0,
        prepayBalance: 0,
        receivable: 0,
        cashGap: 0,
        forecastRoi: 0,
        actualRoi: 0,
        recoveryRate: 0,
        cumSpend: 0,
        cumExp: 0,
        efficiencyRatio: 0,
        perCapitaProfit: 0,
    };
}

function ratioOf(monthCount: number): number {
    return DATA_MONTH_COUNT > 0 ? monthCount / DATA_MONTH_COUNT : 0;
}

function dealMatches(deal: BusinessDeal, filterTypes: BusinessType[], gameIds: string[], projectIds: string[], platformIds: string[]): boolean {
    if (filterTypes.length && !filterTypes.includes(deal.businessType)) return false;
    if (gameIds.length && !gameIds.includes(deal.gameId)) return false;
    if (projectIds.length && !projectIds.includes(deal.projectId)) return false;
    if (platformIds.length) {
        const project = PROJECT_MAP.get(deal.projectId);
        if (!project || !project.platformIds.some((id) => platformIds.includes(id))) return false;
    }
    return true;
}

function dealOnNode(deal: BusinessDeal, node: BizNode): boolean {
    if (node.level === 'org') return false;
    if (node.level === 'company') return true;
    if (node.type && deal.businessType !== node.type) return false;
    if (node.level === 'businessType') return true;
    if (node.level === 'game') return deal.gameId === node.id;
    if (node.level === 'project') return deal.projectId === node.id;
    if (node.level === 'platform') {
        const project = PROJECT_MAP.get(deal.projectId);
        return Boolean(project?.platformIds.includes(node.id ?? ''));
    }
    return false;
}

function selfGameOnNode(game: SelfGameStat, node: BizNode): boolean {
    if (node.level === 'company' || node.level === 'org' || node.level === 'businessType') return node.level !== 'businessType' || node.type === 'self_op';
    if (node.type && node.type !== 'self_op') return false;
    if (node.level === 'game') return game.id === node.id;
    if (node.level === 'project') return game.projectId === node.id;
    if (node.level === 'platform') {
        const project = PROJECT_MAP.get(game.projectId);
        return Boolean(project?.platformIds.includes(node.id ?? ''));
    }
    return false;
}

function isMature(stage: GameMeta['stage']): boolean {
    return stage === '成熟期' || stage === '衰退期';
}

function isNew(stage: GameMeta['stage']): boolean {
    return stage === '测试期' || stage === '成长期';
}

/**
 * 把三类业务叠到一份已经算好的自研指标上。
 * 经营利润只加上出售和外部服务的确认收入，并减去它们的研发与其他直接成本。
 * 内部归属不加进经营利润，也不从里面扣。
 */
export function applyBusiness(
    metrics: Metrics,
    node: BizNode,
    monthCount: number,
    basis: 'book' | 'operating',
    filter: { businessTypes: BusinessType[]; gameIds: string[]; projectIds: string[]; platformIds: string[] },
    selfGames: SelfGameStat[],
    runwayMonths: number | null,
): Metrics {
    const types = activeTypes(filter.businessTypes);
    const includeSelf = wantsSelf(filter.businessTypes);
    const out = includeSelf ? { ...metrics, ...emptyBusiness(), costByType: { ...metrics.costByType } } : zeroMoney(metrics);
    const k = ratioOf(monthCount);
    const useSelf = includeSelf && node.level !== 'org' && (node.level === 'company' || node.type === 'self_op' || !node.type);

    if (includeSelf && node.level === 'org') {
        out.grossAmount = out.accrualRevenue * 1.25;
        out.cashCollection = out.cashRevenue;
        out.rdInvest = out.laborCost;
        out.projectProfit = out.accrualRevenue - out.laborCost - out.spend;
        out.accrualSelf = out.accrualRevenue;
    }

    if (useSelf) {
        const games = selfGames.filter((game) => selfGameOnNode(game, node));
        let gross = 0;
        let other = 0;
        let projectProfit = 0;
        let rdShare = 0;
        let issueShare = 0;
        let mature = 0;
        let freshNeed = 0;
        let accrual = 0;
        for (const game of games) {
            const gameOther = OTHER_DIRECT_PER_GAME * k;
            const pp = game.accrual - game.labor - game.spend - gameOther;
            gross += game.accrual * FLOW_GROSS_FACTOR[game.monetize];
            other += gameOther;
            projectProfit += pp;
            accrual += game.accrual;
            if (pp > 0) {
                rdShare += pp / 2;
                issueShare += pp / 2;
            }
            if (isMature(game.stage)) mature += game.operatingProfit;
            if (isNew(game.stage)) freshNeed += game.labor + game.spend;
        }
        out.grossAmount += gross;
        out.cashCollection += out.cashRevenue;
        out.rdInvest += out.laborCost;
        out.otherDirectCost += other;
        out.projectProfit += projectProfit;
        out.rdShare += rdShare;
        out.issueShare += issueShare;
        out.matureProfit += mature;
        out.newProjectNeed += freshNeed;
        out.accrualSelf += accrual;
    }

    const deals = BUSINESS_DEALS.filter(
        (deal) => dealMatches(deal, filter.businessTypes, filter.gameIds, filter.projectIds, filter.platformIds) && dealOnNode(deal, node),
    );
    for (const deal of deals) {
        if (!types.includes(deal.businessType)) continue;
        const recognized = deal.contractOrBudget * deal.recognizeRatio * k;
        const collected = recognized * deal.collectRatio;
        const rd = deal.rdInvest * k;
        const other = deal.otherDirect * k;
        const projectProfit = recognized - rd - other;
        const game = GAMES.find((item) => item.id === deal.gameId);
        out.grossAmount += deal.contractOrBudget * k;
        out.cashCollection += collected;
        out.rdInvest += rd;
        out.otherDirectCost += other;
        out.projectProfit += projectProfit;
        out.accrualRevenue += recognized;
        out.cashRevenue += collected;
        out.revenue += basis === 'book' ? collected : recognized;
        out.laborCost += rd;
        out.totalCost += rd;
        out.costByType = { ...out.costByType, salary: out.costByType.salary + rd };
        out.operatingProfit += recognized - rd - other;
        out.bookProfit += collected - rd - other;
        out.profit = basis === 'book' ? out.bookProfit : out.operatingProfit;
        if (deal.businessType === 'sale') out.accrualSale += recognized;
        else out.accrualExternal += recognized;
        if (game && isNew(game.stage)) out.newProjectNeed += rd;
        if (game && isMature(game.stage)) out.matureProfit += projectProfit;
    }

    if (node.level === 'company' || node.level === 'businessType') {
        const budgetTypes = node.level === 'businessType' && node.type ? [node.type] : types;
        out.budgetProfit = budgetTypes.reduce((sum, type) => sum + MONTHLY_BUDGET_PROFIT[type], 0) * monthCount;
        out.profitAttainment = out.budgetProfit > 0 ? out.operatingProfit / out.budgetProfit : 0;
    }
    if (node.level === 'company') {
        out.availableCash = AVAILABLE_CASH;
        out.runwayMonths = runwayMonths;
    }
    out.profitGap = out.operatingProfit - out.bookProfit;
    out.margin = out.revenue > 0 ? out.profit / out.revenue : 0;
    out.operatingMargin = out.accrualRevenue > 0 ? out.operatingProfit / out.accrualRevenue : 0;
    out.bookMargin = out.cashRevenue > 0 ? out.bookProfit / out.cashRevenue : 0;
    return out;
}
