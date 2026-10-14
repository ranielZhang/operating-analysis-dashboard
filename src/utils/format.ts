/**
 * 数值格式化工具（全站统一口径）
 * 金额单位默认「元」，展示时按需压缩为 万 / 亿
 */

/** 千分位整数 */
export function comma(n: number, digits = 0): string {
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 自动单位金额：元 → 万 → 亿 */
export function money(n: number, digits = 1): string {
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e8) return `${(n / 1e8).toFixed(digits)} 亿`;
    if (abs >= 1e4) return `${(n / 1e4).toFixed(digits)} 万`;
    return comma(n);
}

/** 带符号金额 */
export function moneySigned(n: number, digits = 1): string {
    if (!Number.isFinite(n)) return '—';
    const s = money(Math.abs(n), digits);
    if (n > 0) return `+${s}`;
    if (n < 0) return `-${s}`;
    return s;
}

/** 万元数值（用于图表 Y 轴） */
export function toWan(n: number): number {
    return Number((n / 1e4).toFixed(2));
}

/** 百分比 */
export function percent(n: number, digits = 1): string {
    if (!Number.isFinite(n)) return '—';
    return `${(n * 100).toFixed(digits)}%`;
}

/** 比值（ROI / 倍数），保留两位 */
export function ratio(n: number, digits = 2): string {
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(digits);
}

/** 同比 / 环比变化率文本 */
export function changeText(rate: number, digits = 1): string {
    if (!Number.isFinite(rate)) return '—';
    const v = (rate * 100).toFixed(digits);
    if (rate > 0) return `+${v}%`;
    return `${v}%`;
}

/** 涨跌 class：正 up / 负 down / 零 flat */
export function trendClass(n: number): string {
    if (!Number.isFinite(n) || n === 0) return 'oa-flat';
    return n > 0 ? 'oa-up' : 'oa-down';
}

/** 涨跌箭头 */
export function trendArrow(n: number): string {
    if (!Number.isFinite(n) || n === 0) return '—';
    return n > 0 ? '▲' : '▼';
}

/** 2026-03 → 2026年3月 */
export function monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
}

/** 2026-03-08 → 3/8 */
export function shortDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${Number(m)}/${Number(d)}`;
}
