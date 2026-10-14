// ============================================================
// 经营分析看板 · 领域模型（全站唯一契约，页面模块只读不改）
// ============================================================

// ---------- 时间 / 口径 ----------
export type Granularity = 'year' | 'quarter' | 'month';

/** 利润口径：账面（银行流水） / 经营（投资+预估回报） */
export type ProfitBasis = 'book' | 'operating';

/** 组织层级 */
export type OrgLevel = 'company' | 'center' | 'department' | 'group' | 'pitcher';

/** 可下钻的维度 */
export type DimKey =
    | 'company'
    | 'center'
    | 'department'
    | 'group'
    | 'pitcher'
    | 'platform'
    | 'project'
    | 'game'
    | 'month';

// ---------- 维度节点 ----------
export interface OrgNode {
    id: string;
    name: string;
    level: OrgLevel;
    parentId: string | null;
    /** 中心/部门负责人；叶子为本人姓名 */
    owner: string;
    /** 该节点下人头数（叶子 = 1） */
    headcount: number;
    /** 是否为可直接投放的投手（仅 pitcher 层级可能为 true） */
    isPitcher: boolean;
    /** 入职月份 YYYY-MM，用于人力成本按月计 */
    joinMonth: string;
}

export interface PlatformMeta {
    id: string;
    name: string;
    /** 图表固定色 */
    color: string;
    /** 结算滞后天数（决定账面收入到账时间） */
    settleLagDays: number;
    /** 平台返点率（广告金来源之一） */
    rebateRate: number;
}

export interface ProjectMeta {
    id: string;
    name: string;
    /** 业务归属中心 */
    centerId: string;
    /** 该项目主投平台 */
    platformIds: string[];
}

export interface GameMeta {
    id: string;
    name: string;
    projectId: string;
    /** 变现类型：IAA 广告变现 / IAP 内购 / 混合 */
    monetize: 'iaa' | 'iap' | 'mix';
    /** 总回收中 IAA（流量主+广告金）占比 0~1 */
    iaaShare: number;
    /** IAA 内部「流量主收入」占比 0~1，其余为广告金 */
    liuliangzhuShare: number;
    /** 预估回收曲线参数：累计ROI(n) = curveA * ln(n) + curveB */
    curveA: number;
    curveB: number;
    /** 目标回本周期（天） */
    paybackDays: number;
    /** ROI 红线（低于则预警） */
    redLineRoi: number;
    /** 上线月份 YYYY-MM */
    onlineMonth: string;
    /** 生命周期阶段 */
    stage: '测试期' | '成长期' | '成熟期' | '衰退期';
    /** 是否为重点游戏 */
    keyGame: boolean;
}

/** 投放组合：投手 × 平台 × 游戏 */
export interface CampaignMeta {
    id: string;
    pitcherId: string;
    groupId: string;
    platformId: string;
    projectId: string;
    gameId: string;
    /** 开始投放月份 / 结束投放月份（null = 仍在投） */
    startMonth: string;
    endMonth: string | null;
    /** 该组合的投放强度系数 */
    intensity: number;
}

// ---------- 收入 / 成本科目 ----------
/** 收入三科目 */
export interface RevenueBreakdown {
    /** 流量主收入（小游戏内广告分成） */
    liuliangzhu: number;
    /** 广告金（平台返点/返还广告金） */
    adGold: number;
    /** 分成收入（IAP 渠道分成净额） */
    iapShare: number;
}

/** 成本科目 */
export interface CostBreakdown {
    /** 业务成本 · 投放成本（媒体后台实际消耗） */
    adSpend: number;
    /** 业务成本 · 预付成本（已充值未消耗，账面口径的现金流出） */
    prepay: number;
    /** 人工成本 · 工资 */
    salary: number;
    /** 人工成本 · 医社保 */
    socialInsurance: number;
    /** 人工成本 · 个税 */
    individualTax: number;
    /** 人工成本 · 项目奖金 */
    projectBonus: number;
    /** 管理费用 · 福利费 */
    welfare: number;
    /** 管理费用 · 办公费 */
    office: number;
}

// ---------- 聚合结果 ----------
/** 指标集合（所有页面统一使用这一份结构） */
export interface Metrics {
    // 收入
    /** 当前口径收入：operating = 应计确认收入；book = 已到账收入 */
    revenue: number;
    /** 应计确认收入（经营口径） */
    accrualRevenue: number;
    /** 已到账收入（账面口径） */
    cashRevenue: number;
    revenueByType: RevenueBreakdown;

    // 成本
    /** 当前口径业务成本：operating = 投放消耗；book = 充值支出 */
    businessCost: number;
    laborCost: number;
    adminCost: number;
    totalCost: number;
    costByType: CostBreakdown;

    // 利润
    /** 当前口径利润 */
    profit: number;
    /** 当前口径利润率 */
    margin: number;
    bookProfit: number;
    operatingProfit: number;
    /** 经营利润 − 账面利润 */
    profitGap: number;
    /** 账面利润率 */
    bookMargin: number;
    operatingMargin: number;

    // 业务量
    /** 投放消耗 */
    spend: number;
    /** 充值额 */
    prepay: number;
    /** 预付余额（累计充值 − 累计消耗） */
    prepayBalance: number;
    /** 应收未收（存量用户未来价值） */
    receivable: number;
    /** 现金缺口 = 预付余额 + 应收未收 */
    cashGap: number;

    // 效率
    /** 预估 ROI（按 N 日回收曲线，单位：倍） */
    forecastRoi: number;
    /** 实际 ROI = 累计已回收 / 累计消耗 */
    actualRoi: number;
    /** 回收完成度 = 已回收 / 预估总回收 */
    recoveryRate: number;
    /** 累计投放消耗（自数据起点）—— 多种聚合精确重算累计比率的分子/分母 */
    cumSpend: number;
    /** 累计预估总回收（自数据起点） */
    cumExp: number;
    /** 人效比 = 经营利润 / 人工成本 */
    efficiencyRatio: number;
    headcount: number;
    /** 人均经营利润 */
    perCapitaProfit: number;
}

/** 一行聚合结果：维度键 + 指标 */
export interface MetricRow extends Metrics {
    /** 维度 id（groupBy='month' 时为 YYYY-MM） */
    key: string;
    /** 展示名 */
    name: string;
    /** 父级 id（用于树形表格） */
    parentId: string | null;
    /** 层级（组织轴 0..4；业务轴 0..3；month 为 -1） */
    depth: number;
    /** 该行是否可继续下钻 */
    hasChildren: boolean;
    /** 环比（与上一期同维度比，无则为 null） */
    mom: number | null;
    /** 同比 */
    yoy: number | null;
}

// ---------- 查询参数 ----------
export interface AnalysisFilter {
    /** 起始月 YYYY-MM（含） */
    startMonth: string;
    /** 结束月 YYYY-MM（含） */
    endMonth: string;
    granularity: Granularity;
    basis: ProfitBasis;
    /** 预估周期（天）：90 / 180 / 360 */
    roiWindow: 90 | 180 | 360;
    /** 组织范围过滤（为空 = 全公司） */
    centerIds: string[];
    departmentIds: string[];
    groupIds: string[];
    pitcherIds: string[];
    /** 业务范围过滤 */
    platformIds: string[];
    projectIds: string[];
    gameIds: string[];
}

export interface QueryOptions {
    filter: AnalysisFilter;
    /** 聚合维度 */
    groupBy: DimKey;
    /** 限定父节点（下钻时传入），null = 顶层 */
    parentId?: string | null;
}

/** 月度序列点（趋势图用） */
export interface MonthlyPoint {
    month: string;
    label: string;
    metrics: Metrics;
}

/** 预估相关 */
export interface ForecastPoint {
    month: string;
    label: string;
    /** 是否为已发生月份 */
    actual: boolean;
    /** 中性预估 */
    revenue: number;
    cost: number;
    profit: number;
    /** 乐观 / 悲观（仅预估月份有值，实际月份 = profit） */
    optimistic: number;
    pessimistic: number;
    /** 预估置信度 0~1 */
    confidence: number;
}

/** Cohort 回收曲线点 */
export interface CohortPoint {
    /** 投放月 YYYY-MM */
    cohortMonth: string;
    /** 投放后天数 */
    day: number;
    /** 累计回收 ROI（倍） */
    roi: number;
    /** 该 cohort 的投放消耗 */
    spend: number;
    /** 是否仍在预估区间（未回收完） */
    projected: boolean;
}

/** 预警项 */
export interface AlertItem {
    id: string;
    level: 'high' | 'medium' | 'low';
    /** 预警类型 */
    type: string;
    /** 标题 */
    title: string;
    /** 描述 */
    desc: string;
    /** 关联对象维度 */
    dim: DimKey;
    dimKey: string;
    dimName: string;
    /** 指标值 / 阈值 */
    value: number;
    threshold: number;
    unit: string;
    /** 建议动作 */
    suggestion: string;
}

/** 预估曲线参数（可配置） */
export interface CurveParam {
    /** 作用范围：全局 / 平台 / 游戏 */
    scope: 'global' | 'platform' | 'game';
    scopeId: string;
    scopeName: string;
    curveA: number;
    curveB: number;
    /** 最近一次拟合的 MAPE */
    mape: number;
    /** 样本投放天数 */
    sampleDays: number;
    /** 是否启用 */
    enabled: boolean;
}
