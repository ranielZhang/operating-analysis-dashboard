import { computed, reactive, watch } from 'vue';
import { store } from '@/domain/store';
import type { AnalysisFilter, DimKey, Granularity, ProfitBasis } from '@/domain/types';

/**
 * 全局分析筛选器（模块级单例）
 * 所有页面通过 useAnalysisFilter() 读取同一份筛选条件，实现跨模块联动。
 */
const state = reactive<AnalysisFilter>(store.defaultFilter());

/** 下钻路径（组织轴 / 业务轴），用于「逐层下钻」页与面包屑 */
export const drillState = reactive({
    /** 'org' = 组织轴（中心→部门→小组→投手）；'biz' = 业务轴（平台→项目→游戏） */
    axis: 'org' as 'org' | 'biz',
    /** 已下钻的层级路径：每项 = { dim, key, name } */
    path: [] as Array<{ dim: DimKey; key: string; name: string }>,
});

export const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
    { value: 'year', label: '按年' },
    { value: 'quarter', label: '按季度' },
    { value: 'month', label: '按月' },
];

/*
 * 利润口径说明（不再提供全局切换，仅在此备查）
 *
 *   经营利润（主口径）= 权责发生制 + 预估回收曲线：收入为本期应确认收入，
 *                       成本为本期投放消耗 + 人工 + 管理费用。含预估成分，及时反映经营质量。
 *   账面利润          = 银行账户实时流水：收入为已到账，成本为已支付。
 *                       精确可审计，但受结算周期影响滞后 30~60 天。
 *
 * 两者不是二选一的视图，而是必须同屏对照的一组指标：
 * 经营总览并排给出「经营利润 / 账面利润 / 口径差额」，并用双口径趋势图与差额桥接图解释其关系；
 * 逐层下钻表同时给出两列。因此全站固定以经营口径为主口径，不再暴露全局切换。
 */

export const ROI_WINDOW_OPTIONS: Array<{ value: 90 | 180 | 360; label: string }> = [
    { value: 90, label: '预估 90 日' },
    { value: 180, label: '预估 180 日' },
    { value: 360, label: '预估 360 日' },
];

/** 期间快捷选项 */
export function presetRanges(): Array<{ key: string; label: string; startMonth: string; endMonth: string }> {
    const cur = store.currentMonth;
    const y = Number(cur.slice(0, 4));
    const m = Number(cur.slice(5));
    const shift = (months: number) => {
        const t = y * 12 + (m - 1) - months;
        return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
    };
    return [
        { key: 'last12', label: '近 12 个月', startMonth: shift(11), endMonth: cur },
        { key: 'thisYear', label: `${y}年至今`, startMonth: `${y}-01`, endMonth: cur },
        { key: 'thisQuarter', label: '本季度', startMonth: shift(((m - 1) % 3) + 0), endMonth: cur },
        { key: 'last6', label: '近 6 个月', startMonth: shift(5), endMonth: cur },
        { key: 'lastMonth', label: '上月', startMonth: shift(1), endMonth: shift(1) },
        { key: 'all', label: '全部历史', startMonth: store.months[0], endMonth: cur },
    ];
}

export function useAnalysisFilter() {
    const filter = state;

    /** 把期间换算成可比区间标签 */
    const periodLabel = computed(() => {
        const len = monthSpan(filter.startMonth, filter.endMonth);
        return `${filter.startMonth} ~ ${filter.endMonth}（${len} 个月）`;
    });

    const hasFilter = computed(
        () =>
            filter.centerIds.length +
                filter.departmentIds.length +
                filter.groupIds.length +
                filter.pitcherIds.length +
                filter.platformIds.length +
                filter.projectIds.length +
                filter.gameIds.length +
                filter.businessTypes.length >
            0,
    );

    function reset() {
        Object.assign(state, store.defaultFilter());
    }

    function applyPreset(r: { startMonth: string; endMonth: string }) {
        state.startMonth = r.startMonth;
        state.endMonth = r.endMonth;
    }

    /** 组织/业务范围变化时，同步清空下钻路径 */
    watch(
        () => [
            filter.centerIds.length,
            filter.departmentIds.length,
            filter.groupIds.length,
            filter.pitcherIds.length,
            filter.platformIds.length,
            filter.projectIds.length,
            filter.gameIds.length,
            filter.businessTypes.length,
        ],
        () => {
            drillState.path = [];
        },
    );

    return { filter, periodLabel, hasFilter, reset, applyPreset, drillState };
}

export function monthSpan(startMonth: string, endMonth: string): number {
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    return Math.max(1, ey * 12 + em - (sy * 12 + sm) + 1);
}

/** 当前口径对应的利润字段名（用于文案） */
export function basisLabel(basis: ProfitBasis): string {
    return basis === 'book' ? '账面利润' : '经营利润';
}

/** 维度 → 中文名 */
export const DIM_LABEL: Record<string, string> = {
    company: '公司',
    center: '中心',
    department: '部门',
    group: '小组',
    pitcher: '投手',
    platform: '平台',
    project: '项目',
    game: '游戏',
    businessType: '业务类型',
    month: '月份',
};
