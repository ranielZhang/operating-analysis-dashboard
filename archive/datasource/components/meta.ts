import { PLATFORMS } from '@/domain/dimensions';
import { hash01 } from '@/domain/store';

/**
 * 经营数据源与质量页 · 共用元数据与确定性演示数据生成器
 *
 * 设计原则（对齐契约 §1 铁律 2）：
 * 1. 数据源「清单本身」（名称 / 类别 / 覆盖指标 / 提供方 / 频率 / 粒度 / 接入状态 / 备注）
 *    是调研现有系统后的事实结论，属于业务事实，直接以常量维护；
 * 2. 凡是页面上「不是来自 store 真实计算」的数字（数据完整度、最近更新时间、
 *    今日待处理问题数、月度完整度趋势），一律用 hash01() 确定性生成，
 *    并由调用方用 <el-tag type="info">演示数据</el-tag> 明确标注；
 * 3. 不使用 Math.random()，保证刷新 / 重进页面数字完全一致。
 */

export type SourceCategory = '业务数据' | '管理数据' | '财务数据' | '归因数据';

/** 接入状态（unconfigured 即第三方归因的 unconfigured 未配置） */
export type SourceStatus = 'connected' | 'partial' | 'manual' | 'unavailable' | 'unconfigured';

export interface DataSourceMeta {
    id: string;
    name: string;
    category: SourceCategory;
    /** 覆盖的看板指标 */
    metrics: string[];
    /** 提供方 / 接口 */
    provider: string;
    /** 更新频率 */
    frequency: string;
    /** 数据粒度 */
    granularity: '日' | '月' | '手工';
    status: SourceStatus;
    /** 是否已有真实接口（非手工、非导出） */
    realApi: boolean;
    /** 完整度基准（确定性演示值，0~1，仅用于生成展示百分比） */
    base: number;
    /** 备注 / 对看板的影响 */
    note: string;
    /** 是否参与完整度趋势图（业务数据源） */
    inTrend: boolean;
}

export const CATEGORY_COLOR: Record<SourceCategory, string> = {
    业务数据: '#4d94fa',
    管理数据: '#8b5cf6',
    财务数据: '#12b566',
    归因数据: '#ff9140',
};

export const CATEGORY_OPTIONS: SourceCategory[] = ['业务数据', '管理数据', '财务数据', '归因数据'];

export const STATUS_LABEL: Record<SourceStatus, string> = {
    connected: '已接入',
    partial: '部分接入',
    manual: '手工维护',
    unavailable: '未接入',
    unconfigured: '未配置',
};

export const STATUS_TYPE: Record<SourceStatus, 'success' | 'warning' | 'info' | 'danger'> = {
    connected: 'success',
    partial: 'warning',
    manual: 'info',
    unavailable: 'danger',
    unconfigured: 'danger',
};

export const STATUS_OPTIONS: Array<{ value: SourceStatus; label: string }> = (
    ['connected', 'partial', 'manual', 'unavailable', 'unconfigured'] as SourceStatus[]
).map((s) => ({ value: s, label: STATUS_LABEL[s] }));

/** 媒体平台结算滞后天数文案（取自 dimensions.ts 的真实常量，不是编的） */
const SETTLE_LAG_TEXT = PLATFORMS.map((p) => `「${p.name}」${p.settleLagDays} 天`).join(' / ');

/** 数据源清单：内容来源 = 需求文档 §2「数据源盘点」+ 现有系统调研结论 */
export const DATA_SOURCES: DataSourceMeta[] = [
    // ---------------- 业务数据 · 成本侧 ----------------
    {
        id: 'ds_tencent_api',
        name: '腾讯广告报表 API',
        category: '业务数据',
        metrics: ['投放成本', '投放消耗', '预估 ROI（累计）'],
        provider: 'daily_reports/get',
        frequency: '每 5 分钟 + T-1 日报重刷',
        granularity: '日',
        status: 'connected',
        realApi: true,
        base: 0.975,
        note: `唯一有真实接口的成本项。返回字段 cost，单位是「分」，入库需保留原始分字段并在展示层统一换算成元（漏换算会出现 100 倍误差）。平台结算滞后 ${SETTLE_LAG_TEXT.split(' / ')[0]}。`,
        inTrend: true,
    },
    {
        id: 'ds_social_ins',
        name: '社保申报表',
        category: '管理数据',
        metrics: ['医社保'],
        provider: '社保申报表 / 月度申报回单',
        frequency: '每月 3 号',
        granularity: '月',
        status: 'connected',
        realApi: false,
        base: 0.838,
        note: `公司承担部分口径（占薪资 ${Math.round(0.28 * 100)}%）。月度粒度，无法按天/按游戏归集，只能按人归集到部门后再分摊。`,
        inTrend: false,
    },
    {
        id: 'ds_ocean_api',
        name: '巨量引擎报表 API',
        category: '业务数据',
        metrics: ['投放成本', '投放消耗'],
        provider: 'report/ad/get（媒体开放平台）',
        frequency: '每 5 分钟 + T-1 日报重刷',
        granularity: '日',
        status: 'connected',
        realApi: true,
        base: 0.955,
        note: `与腾讯广告同为投放成本的来源平台，单位元。平台返点率 ${Math.round(0.05 * 100)}%，是广告金收入的来源之一，但返点结算单目前仍需手工取。`,
        inTrend: true,
    },
    {
        id: 'ds_kuaishou_api',
        name: '快手磁力报表 API',
        category: '业务数据',
        metrics: ['投放成本', '投放消耗'],
        provider: '磁力引擎报表接口',
        frequency: '每日 06:30',
        granularity: '日',
        status: 'connected',
        realApi: true,
        base: 0.918,
        note: '投放成本来源平台之一，结算滞后 30 天。投放量占比低于腾讯/巨量，接口稳定性一般，偶有当日缺数需次日补偿。',
        inTrend: true,
    },
    {
        id: 'ds_xiaomi_api',
        name: '小米营销报表 API',
        category: '业务数据',
        metrics: ['投放成本', '投放消耗'],
        provider: '小米营销开放接口',
        frequency: '每日 06:30',
        granularity: '日',
        status: 'connected',
        realApi: true,
        base: 0.888,
        note: '投放成本来源平台之一，结算滞后 60 天（四平台中最长），返点率 3%。投放量小但直接影响传奇/休闲竞技项目口径。',
        inTrend: true,
    },
    // ---------------- 业务数据 · 收入侧（无真实外部接口） ----------------
    {
        id: 'ds_wx_liuliangzhu',
        name: '微信小游戏流量主后台',
        category: '业务数据',
        metrics: ['流量主收入', '广告金'],
        provider: '流量主后台导出',
        frequency: '手工',
        granularity: '手工',
        status: 'manual',
        realApi: false,
        base: 0.665,
        note: '目前无真实外部数据源，只能靠人工导出后台数据或按月取结算单。媒体结算周期 T+30~T+60，导致流量主收入无法做到日粒度。',
        inTrend: true,
    },
    {
        id: 'ds_douyin_liuliangzhu',
        name: '抖音小游戏流量主后台',
        category: '业务数据',
        metrics: ['流量主收入'],
        provider: '流量主后台导出',
        frequency: '手工',
        granularity: '手工',
        status: 'manual',
        realApi: false,
        base: 0.632,
        note: '同微信流量主，纯手工维护，且与中台手工配置字段（shareMode / liuliangzhuShare）需要人工核对，存在滞后与错漏风险。',
        inTrend: true,
    },
    {
        id: 'ds_adgold_settle',
        name: '广告金平台结算单',
        category: '业务数据',
        metrics: ['广告金', '返点'],
        provider: '平台结算单 + 中台广告金方案（手工配置）',
        frequency: '手工',
        granularity: '手工',
        status: 'manual',
        realApi: false,
        base: 0.618,
        note: `返点率按平台配置（腾讯 ${Math.round(0.06 * 100)}% / 巨量 ${Math.round(0.05 * 100)}%），需区分「可提现」与「仅可抵扣投放」两类，目前靠会计口径手工区分。`,
        inTrend: true,
    },
    {
        id: 'ds_appstore_bill',
        name: '应用商店渠道对账单',
        category: '业务数据',
        metrics: ['分成收入'],
        provider: '渠道后台导出 / 对账单',
        frequency: '手工',
        granularity: '手工',
        status: 'manual',
        realApi: false,
        base: 0.685,
        note: 'IAP 内购经渠道抽成 30%~50% 后的净收入，目前无接口，只能靠月度结算单回填，无法做到日粒度。',
        inTrend: true,
    },
    {
        id: 'ds_prepay_ledger',
        name: '媒体账户余额 / 预付台账',
        category: '业务数据',
        metrics: ['预付成本', '充值额', '预付余额'],
        provider: '手工维护',
        frequency: '手工',
        granularity: '手工',
        status: 'unavailable',
        realApi: false,
        base: 0.52,
        note: '预付成本目前没有真实外部数据源，只有中台手工配置字段 prepayAmount（预付金额）；账面利润的充值支出依赖手工维护，存在滞后与错漏。',
        inTrend: false,
    },
    // ---------------- 管理数据（按月产生，必须分摊） ----------------
    {
        id: 'ds_hr_payroll',
        name: '人事薪酬系统',
        category: '管理数据',
        metrics: ['工资', '项目奖金'],
        provider: '薪酬表导入 / 月度接口',
        frequency: '每月 3 号',
        granularity: '月',
        status: 'partial',
        realApi: false,
        base: 0.885,
        note: '工资按当月应发（基本+绩效）取数；项目奖金是唯一能直接归集到项目/游戏的管理数据。粒度天然比业务数据粗，必须建立分摊规则才能落到项目。',
        inTrend: false,
    },
    {
        id: 'ds_tax_filing',
        name: '个税申报表',
        category: '管理数据',
        metrics: ['个税'],
        provider: '个税申报表 / 自然人电子税务局回单',
        frequency: '每月 3 号',
        granularity: '月',
        status: 'partial',
        realApi: false,
        base: 0.862,
        note: `代扣代缴个税（公司现金流口径，约薪资的 ${Math.round(0.06 * 100)}%）。仅月度粒度，只能随人工成本一起分摊。`,
        inTrend: false,
    },
    {
        id: 'ds_expense',
        name: '费用报销系统',
        category: '管理数据',
        metrics: ['福利费', '办公费'],
        provider: '费用报销单 / 合同台账',
        frequency: '每月 3 号',
        granularity: '月',
        status: 'partial',
        realApi: false,
        base: 0.845,
        note: '福利费与办公费为间接费用，按月归集后向下分摊（默认按投放消耗占比，可切按人头占比）；无法按天/按游戏直接归集。',
        inTrend: false,
    },
    // ---------------- 财务数据 ----------------
    {
        id: 'ds_bank_flow',
        name: '银行流水',
        category: '财务数据',
        metrics: ['账面利润', '已到账收入', '充值支出'],
        provider: '财务系统银行流水接口',
        frequency: '实时',
        granularity: '日',
        status: 'connected',
        realApi: true,
        base: 0.985,
        note: '账面利润的数据基础，精确可审计；但收入按结算到账确认，结算滞后 30~60 天，账面利润天然滞后于经营利润。',
        inTrend: false,
    },
    // ---------------- 归因数据 ----------------
    {
        id: 'ds_internal_attr',
        name: '内部归因系统',
        category: '归因数据',
        metrics: ['LTV', '90/180/360 日 ROI', '实际 ROI（累计）', '回收完成度（累计）'],
        provider: '内部归因结果表 / 字段清单',
        frequency: '每日 06:30',
        granularity: '日',
        status: 'partial',
        realApi: true,
        base: 0.845,
        note: '累计 ROI / LTV / 回收曲线的来源。当前为内部归因口径，与第三方归因（AppsFlyer）存在口径差，跨渠道重复归因未做扣减。',
        inTrend: false,
    },
    {
        id: 'ds_appsflyer',
        name: 'AppsFlyer',
        category: '归因数据',
        metrics: ['LTV', 'ROI 校验', '渠道归因'],
        provider: 'AppsFlyer API（未配置）',
        frequency: '未配置',
        granularity: '日',
        status: 'unconfigured',
        realApi: false,
        base: 0,
        note: '状态 unconfigured（未配置）：缺少 API Token / App ID / 权限。未配置将影响 ROI / 收入 / LTV 口径的完整性（无法做第三方交叉校验）。',
        inTrend: false,
    },
];

/** 数据质量问题与待办清单：内容全部来自需求文档 §2 调研结论与既有系统真实问题，未新增编造项 */
export type IssueLevel = 'high' | 'medium' | 'low';

export interface QualityIssue {
    id: string;
    problem: string;
    impact: string;
    action: string;
    level: IssueLevel;
}

export const LEVEL_LABEL: Record<IssueLevel, string> = { high: '高', medium: '中', low: '低' };
export const LEVEL_TYPE: Record<IssueLevel, 'danger' | 'warning' | 'info'> = { high: 'danger', medium: 'warning', low: 'info' };

export const QUALITY_ISSUES: QualityIssue[] = [
    {
        id: 'q1',
        problem: '预付成本无外部数据源',
        impact: '账面利润的充值支出依赖手工维护，存在滞后与错漏',
        action: '对接媒体账户余额接口 / 建立预付台账',
        level: 'high',
    },
    {
        id: 'q2',
        problem: '三项收入无接口（流量主 / 广告金 / 分成）',
        impact: '收入只能靠月度结算单，无法做到日粒度',
        action: '对接流量主后台与渠道对账单',
        level: 'high',
    },
    {
        id: 'q3',
        problem: 'AppsFlyer 未配置（unconfigured）',
        impact: 'ROI / 收入 / LTV 口径不完整，缺少第三方交叉校验',
        action: '补齐 API Token、App ID 与权限',
        level: 'medium',
    },
    {
        id: 'q4',
        problem: '腾讯广告金额单位为分',
        impact: '展示层若忘记换算会出现 100 倍误差',
        action: '入库保留原始分字段，展示层统一换算',
        level: 'medium',
    },
    {
        id: 'q5',
        problem: '管理数据只有月度粒度',
        impact: '无法按天/按游戏直接归集，必须分摊',
        action: '建立分摊规则并固化到 ETL',
        level: 'medium',
    },
    {
        id: 'q6',
        problem: '收入结算滞后 30~60 天',
        impact: '账面利润滞后于经营利润，双口径差额被放大',
        action: '用预付余额与应收未收做口径桥接（见经营总览）',
        level: 'medium',
    },
    {
        id: 'q7',
        problem: '预占/预付口径与消耗口径混用',
        impact: '容易被误读为真实成本',
        action: '看板全站区分「消耗」与「充值」两个字段',
        level: 'low',
    },
];

/** 数据字典速查 */
export interface DictField {
    cn: string;
    field: string;
    unit: string;
    from: string;
    estimated: boolean;
}

export interface DictGroup {
    name: string;
    fields: DictField[];
}

export const DICT_GROUPS: DictGroup[] = [
    {
        name: '成本类字段',
        fields: [
            { cn: '投放成本', field: 'spend', unit: '元', from: '腾讯广告 daily_reports/get（cost 分 → 元）+ 巨量/快手/小米报表 API', estimated: false },
            { cn: '预付成本', field: 'prepay', unit: '元', from: '中台手工配置 prepayAmount + 媒体账户余额（待接入）', estimated: false },
            { cn: '工资', field: 'salary', unit: '元', from: '人事薪酬系统（按月）', estimated: false },
            { cn: '医社保', field: 'socialInsurance', unit: '元', from: '社保申报表（公司承担部分）', estimated: false },
            { cn: '个税', field: 'individualTax', unit: '元', from: '个税申报表（代扣代缴现金流口径）', estimated: false },
            { cn: '项目奖金', field: 'projectBonus', unit: '元', from: '人事薪酬系统奖金核算表（可直归项目）', estimated: false },
            { cn: '福利费', field: 'welfare', unit: '元', from: '费用报销系统（按月，需分摊）', estimated: false },
            { cn: '办公费', field: 'office', unit: '元', from: '费用报销系统 / 合同台账（按月，需分摊）', estimated: false },
        ],
    },
    {
        name: '收入类字段',
        fields: [
            { cn: '应确认收入', field: 'accrualRevenue', unit: '元', from: '投放成本 × 回收曲线按天确认（经营口径）', estimated: true },
            { cn: '已到账收入', field: 'cashRevenue', unit: '元', from: '银行流水 + 平台结算到账单（账面口径）', estimated: false },
            { cn: '流量主收入', field: 'liuliangzhu', unit: '元', from: '微信/抖音小游戏流量主后台（手工，待接入）', estimated: false },
            { cn: '广告金', field: 'adGold', unit: '元', from: '平台结算单 + 平台返点率配置（手工）', estimated: false },
            { cn: '分成收入', field: 'iapShare', unit: '元', from: '应用商店渠道对账单（手工，待接入）', estimated: false },
        ],
    },
    {
        name: '预估与效率字段',
        fields: [
            { cn: '预估 ROI（累计）', field: 'forecastRoi', unit: '倍', from: '回收曲线 curveA·ln(n)+curveB，按平台×游戏拟合', estimated: true },
            { cn: '实际 ROI（累计）', field: 'actualRoi', unit: '倍', from: '内部归因系统（累计已回收 / 累计消耗）', estimated: false },
            { cn: '回收完成度（累计）', field: 'recoveryRate', unit: '%', from: '内部归因系统（已回收 / 预估总回收）', estimated: false },
        ],
    },
    {
        name: '资金与口径桥接字段',
        fields: [
            { cn: '现金缺口', field: 'cashGap', unit: '元', from: '预付余额 + 应收未收（派生指标）', estimated: false },
            { cn: '应收未收', field: 'receivable', unit: '元', from: '预估总回收 − 累计已回收（含预估成分）', estimated: true },
            { cn: '预付余额', field: 'prepayBalance', unit: '元', from: '累计充值 − 累计消耗（派生指标）', estimated: false },
            { cn: '人效比', field: 'efficiencyRatio', unit: '倍', from: '经营利润 / 人工成本（派生指标）', estimated: false },
        ],
    },
];

// ============================================================
// 确定性演示数据生成（一律 hash01，禁止 Math.random）
// ============================================================

/** 单个数据源的完整度（确定性演示值，稳定在其 base 附近，保留 2 位小数） */
export function completenessOf(src: DataSourceMeta): number {
    const noise = 0.96 + hash01(`ds:${src.id}:completeness`) * 0.07;
    return Math.min(1, Number((src.base * noise).toFixed(2)));
}

/** 数据源完整度是否低于 95% 目标线 */
export const COMPLETENESS_TARGET = 0.95;

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** 以 store.currentMonth 为基准做天数位移，返回 YYYY-MM-DD */
export function dayOffset(baseMonth: string, offsetDays: number): string {
    const [y, m] = baseMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 18);
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 最近更新时间（确定性演示值）
 * 已接入 / 部分接入：按更新频率回推 0~2 天（月度源回推到本月或上月 3 号）
 * 手工维护：回推到 6~40 天前（体现「手工 → 滞后」）
 * 未接入 / 未配置：'—'
 */
export function lastUpdatedOf(src: DataSourceMeta, baseMonth: string): string {
    if (src.status === 'unavailable' || src.status === 'unconfigured') return '—';
    if (src.granularity === '月' || src.frequency.startsWith('每月')) {
        return dayOffset(baseMonth, -Math.round(18 + hash01(`ds:${src.id}:lag`) * 12));
    }
    if (src.status === 'manual' || src.granularity === '手工') {
        return dayOffset(baseMonth, -Math.round(6 + hash01(`ds:${src.id}:lag`) * 34));
    }
    return dayOffset(baseMonth, -Math.round(hash01(`ds:${src.id}:lag`) * 2));
}

/** 近 12 个月（以 store.months 为准，不写死月份） */
export function lastMonths(months: string[], count = 12): string[] {
    return months.slice(Math.max(0, months.length - count));
}

function clamp01(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

/**
 * 月份级混音：hash01 对「只在末尾不同的字符串」（如 ...:2025-07 / ...:2025-08）区分度很低，
 * 直接用会导致月度完整度曲线近似一条水平线。这里再用正/反两次 hash01 做一次混音并取小数部分，
 * 让「数据源 × 月份」的取值充分散开 —— 仍然是纯确定性哈希，不涉及 Math.random。
 */
function monthMix(key: string): number {
    const a = hash01(key);
    const b = hash01(key.split('').reverse().join(''));
    return (a * 137.7 + b * 61.3) % 1;
}

/**
 * 某数据源在某月的完整度（确定性演示值）
 * = 该源完整度基准 ± 月份波动（约 ±3 个百分点）。
 * 之所以锚定基准，是为了让「接入良好的源完整度高、手工/未接入的源完整度低」这一业务关系在趋势里也成立，
 * 而不是所有源都随机散布（那会让「主要集中在哪两个源」的结论失去意义）。
 */
export function monthlyCompleteness(srcId: string, month: string): number {
    const src = DATA_SOURCES.find((s) => s.id === srcId);
    const base = src ? completenessOf(src) : 0.88;
    const wave = (monthMix(`${srcId}#${month}`) - 0.5) * 0.06;
    const v = clamp01(base + wave, 0.4, 1);
    return Number(v.toFixed(4));
}

/** 今日需处理的数据质量问题数（确定性演示值，3~6 条） */
export function todayIssueCount(): number {
    return 3 + Math.floor(hash01('ds:issues:today') * 4);
}

/** 某数据源近 n 个月完整度低于目标线的月份数 */
export function belowTargetMonths(srcId: string, months: string[], n = 3): number {
    return months.slice(-n).filter((m) => monthlyCompleteness(srcId, m) < COMPLETENESS_TARGET).length;
}

/** 某数据源近 n 个月的最低完整度 */
export function lowestCompleteness(srcId: string, months: string[], n = 3): number {
    const recent = months.slice(-n);
    if (recent.length === 0) return 1;
    return Math.min(...recent.map((m) => monthlyCompleteness(srcId, m)));
}


// ============================================================
// 数据流转链路（桑基图）节点与连边
// ============================================================

export interface FlowNode {
    name: string;
    category: SourceCategory | '中台处理';
    desc: string;
    /** 节点归类：数据源 / 处理环节 / 产出 */
    kind: 'source' | 'process' | 'output';
}

export const FLOW_NODES: FlowNode[] = [
    { name: '媒体投放 API', category: '业务数据', kind: 'source', desc: '腾讯广告 daily_reports/get（cost 单位：分）+ 巨量 / 快手 / 小米报表 API。唯一有真实数据源的成本项，约每 5 分钟 + T-1 日报重刷。' },
    { name: '流量主后台', category: '业务数据', kind: 'source', desc: '微信 / 抖音小游戏流量主后台，目前无接口，靠人工导出或月度结算单。媒体结算周期 T+30~T+60。' },
    { name: '渠道对账单', category: '业务数据', kind: 'source', desc: '应用商店（App Store / 华为 / OPPO / vivo）渠道对账单，IAP 分成后净收入，约 30%~50% 被渠道抽成，目前手工维护。' },
    { name: '中台手工配置', category: '业务数据', kind: 'source', desc: '预付金额（prepayAmount）、分成模式（shareMode）、分成比例（rdShare / publishShare）、广告金方案等手工配置字段 —— 预付成本与三项收入的当前唯一来源。' },
    { name: '薪酬系统', category: '管理数据', kind: 'source', desc: '人事薪酬系统 + 社保 / 个税申报表 + 费用报销系统：工资、医社保、个税、项目奖金、福利费、办公费，按月产生，粒度天然比业务数据粗，必须分摊。' },
    { name: '银行流水', category: '财务数据', kind: 'source', desc: '财务系统银行流水，账面利润的数据基础，精确可审计，但受结算滞后影响（30~60 天）。' },
    { name: '归因系统', category: '归因数据', kind: 'source', desc: '内部归因系统提供 LTV 与 90/180/360 日累计 ROI；AppsFlyer 状态 unconfigured（未配置），无法做第三方交叉校验。' },
    { name: '数据中台 ETL', category: '中台处理', kind: 'process', desc: '清洗与对齐：分→元换算、充值/消耗口径拆分、媒体口径与财务口径映射、管理数据分摊规则（按投放消耗或人头占比）固化。' },
    { name: '经营分析宽表', category: '中台处理', kind: 'process', desc: '按 组织轴（中心→部门→小组→投手）× 业务轴（平台→项目→游戏）× 月份 聚合的统一宽表，全站指标的唯一出口。' },
    { name: '经营分析看板', category: '中台处理', kind: 'output', desc: '7 个分析页面：经营总览 / 逐层下钻 / 月度经营预估 / 收入分析 / 成本分析 / 投手人效 / 预估参数配置，本页是它的数据源视图。' },
    { name: '账面利润（银行流水口径）', category: '财务数据', kind: 'output', desc: '银行流水直接核算的利润口径（已有业务财务看板支持），与经营利润的差额 = 预付余额 + 应收未收。' },
];

/** 连边：value = 该来源贡献的看板指标数量（决定桑基图带宽） */
export const FLOW_LINKS: Array<{ source: string; target: string; value: number }> = [
    { source: '媒体投放 API', target: '数据中台 ETL', value: 3 },
    { source: '流量主后台', target: '数据中台 ETL', value: 2 },
    { source: '渠道对账单', target: '数据中台 ETL', value: 1 },
    { source: '中台手工配置', target: '数据中台 ETL', value: 3 },
    { source: '薪酬系统', target: '数据中台 ETL', value: 6 },
    { source: '银行流水', target: '数据中台 ETL', value: 1 },
    { source: '归因系统', target: '数据中台 ETL', value: 4 },
    { source: '数据中台 ETL', target: '经营分析宽表', value: 20 },
    { source: '经营分析宽表', target: '经营分析看板', value: 18 },
    { source: '经营分析宽表', target: '账面利润（银行流水口径）', value: 2 },
    { source: '银行流水', target: '账面利润（银行流水口径）', value: 3 },
];
