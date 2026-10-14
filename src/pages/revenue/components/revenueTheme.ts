import type { Metrics } from '@/domain/types';
import { money, ratio } from '@/utils/format';

/**
 * 读取设计令牌的真实色值
 *
 * ⚠️ 必须校验「读到的确实是颜色」：`--oa-gap` 现在既是间距（12px）又是口径差额色，
 * 若拿它当颜色用，`'12px'` 这种非空字符串会通过 `value || fallback` 直接返回，
 * 最终被 canvas 静默忽略导致图表掉色。这里与 `components/EChart.vue` 的 `isValidColor()` 保持同一套判定。
 */
export function token(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!value) return fallback;
    const isColor =
        typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
            ? CSS.supports('color', value)
            : /^(#|rgb|hsl)/i.test(value);
    return isColor ? value : fallback;
}

export type RevenueSubjectKey = 'liuliangzhu' | 'adGold' | 'iapShare';

export interface RevenueSubject {
    key: RevenueSubjectKey;
    name: string;
    /** theme.scss 中的设计令牌名 */
    cssVar: string;
    /** 令牌缺失时的兜底色（与 theme.scss 保持一致） */
    fallback: string;
    /** 业务含义（页面说明 / tooltip 用） */
    desc: string;
}

/** 收入三科目：顺序 = 图表堆叠顺序 = 配色绑定顺序，不可随意调整 */
export const REVENUE_SUBJECTS: RevenueSubject[] = [
    {
        key: 'liuliangzhu',
        name: '流量主收入',
        cssVar: '--oa-rev-liuliangzhu',
        fallback: '#8b5cf6',
        desc: '小游戏内激励视频 / 插屏 / Banner 广告的分成收入',
    },
    {
        key: 'adGold',
        name: '广告金',
        cssVar: '--oa-rev-adgold',
        fallback: '#f472b6',
        desc: '平台返还的广告金 / 返点（微信小游戏广告金、腾讯广告返点等）',
    },
    {
        key: 'iapShare',
        name: '分成收入',
        cssVar: '--oa-rev-share',
        fallback: '#06b6d4',
        desc: 'IAP 内购流水经应用商店 / 渠道分成后的净额',
    },
];

/** 取某科目的图表色（来自设计令牌） */
export function revenueColor(key: RevenueSubjectKey): string {
    const subject = REVENUE_SUBJECTS.find((item) => item.key === key);
    return subject ? token(subject.cssVar, subject.fallback) : token('--oa-text-4', '#9ca3af');
}

/** 取某科目金额；字段缺失按 0 处理，避免极端筛选下出现 NaN */
export function subjectAmount(breakdown: Metrics['revenueByType'] | undefined, key: RevenueSubjectKey): number {
    const value = breakdown ? breakdown[key] : 0;
    return Number.isFinite(value) ? value : 0;
}

/** 安全除法：分母 <= 0 或非有限值一律返回 0（页面只展示 0，不展示 NaN / Infinity） */
export function safeRatio(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
}

/** 安全除法（折线用）：无意义时返回 null，让折线断点而不是掉到 0 */
export function ratioPoint(numerator: number, denominator: number): number | null {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
    return Number((numerator / denominator).toFixed(4));
}

/** 是否具备收入数据（空态兜底判定） */
export function hasRevenue(metrics: Metrics | null | undefined): boolean {
    if (!metrics) return false;
    return metrics.accrualRevenue > 0 || metrics.cashRevenue > 0 || metrics.spend > 0;
}

/** 月份轴标签：跨年度用「25/07」，单一年度内用「7月」 */
export function monthAxisLabels(months: string[]): string[] {
    const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
    return months.map((m) => (multiYear ? `${m.slice(2, 4)}/${m.slice(5, 7)}` : `${Number(m.slice(5, 7))}月`));
}

/** tooltip：入图数据单位是「万元」，提示时还原成「元」再格式化 */
export function wanTooltip(value: unknown): string {
    const raw = Array.isArray(value) ? value[0] : value;
    const num = Number(raw);
    return Number.isFinite(num) ? money(num * 1e4) : '—';
}

/** tooltip：比值（收入/消耗 比、ROI） */
export function ratioTooltip(value: unknown): string {
    const raw = Array.isArray(value) ? value[0] : value;
    const num = Number(raw);
    return Number.isFinite(num) ? ratio(num) : '—';
}

/** 金额轴刻度（数据已是万元） */
export function wanAxisLabel(value: string | number): string {
    const num = Number(value);
    return Number.isFinite(num) ? `${Math.round(num)}万` : '';
}

/** 比值轴刻度 */
export function ratioAxisLabel(value: string | number): string {
    const num = Number(value);
    return Number.isFinite(num) ? ratio(num, 1) : '';
}
