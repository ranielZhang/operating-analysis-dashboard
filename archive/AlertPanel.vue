<template>
    <PanelCard title="预警与洞察" body-class="alert-panel__body">
        <template #actions>
            <el-radio-group v-model="levelFilter" size="small">
                <el-radio-button v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                </el-radio-button>
            </el-radio-group>
        </template>

        <!-- 顶部：三档统计卡（点击卡片即筛选列表） -->
        <div class="stat-row">
            <button
                v-for="s in levelStats"
                :key="s.level"
                type="button"
                class="stat"
                :class="[`stat--${s.level}`, { 'is-active': levelFilter === s.level }]"
                :aria-pressed="levelFilter === s.level"
                @click="toggleLevel(s.level)"
            >
                <span class="stat__dot" />
                <span class="stat__label">{{ s.label }}</span>
                <span class="stat__num oa-num">{{ s.count }}</span>
                <span class="stat__unit">条</span>
            </button>
        </div>

        <!-- 主体：预警列表 -->
        <div v-if="alerts.length" class="alert-list oa-scroll">
            <article v-for="a in visibleAlerts" :key="a.id" class="alert" :class="`alert--${a.level}`">
                <div class="alert__top">
                    <el-tag :type="TAG_TYPE[a.level]" size="small" effect="light" disable-transitions>
                        {{ LEVEL_TEXT[a.level] }}
                    </el-tag>
                    <span class="alert__type">{{ a.type }}</span>
                    <span class="alert__obj">{{ a.dimName }}</span>
                </div>

                <h4 class="alert__title">{{ a.title }}</h4>
                <p v-if="a.desc" class="alert__desc">{{ a.desc }}</p>

                <!-- 阈值对比 -->
                <div class="alert__compare" :title="gapText(a)">
                    <div class="cmp">
                        <span class="cmp__k">当前</span>
                        <span class="cmp__v oa-num" :class="`cmp__v--${a.level}`">{{ displayValue(a) }}</span>
                        <span class="cmp__sign oa-num" :class="trendClass(a.value - a.threshold)">
                            {{ trendArrow(a.value - a.threshold) }}
                        </span>
                    </div>
                    <div class="cmp">
                        <span class="cmp__k">阈值</span>
                        <span class="cmp__v oa-num cmp__v--threshold">{{ displayThreshold(a) }}</span>
                    </div>
                </div>
                <div v-if="hasScale(a)" class="alert__track">
                    <div class="alert__fill" :class="`alert__fill--${a.level}`" :style="{ width: barWidth(a) }" />
                </div>

                <!-- 建议动作（文案只能来自 suggestion 字段） -->
                <div class="alert__suggest">
                    <span class="alert__suggest-tag">建议</span>
                    <span class="alert__suggest-text">{{ a.suggestion }}</span>
                </div>
            </article>

            <p v-if="!visibleAlerts.length" class="alert-list__none">当前等级下没有预警，可切换筛选查看其他等级。</p>
        </div>

        <!-- 空态：无预警 -->
        <div v-else class="safe">
            <span class="safe__check" aria-hidden="true">✓</span>
            <p class="safe__text">本周期未发现异常，各项指标在阈值内</p>
        </div>

        <!-- 底部：洞察结语 -->
        <p v-if="alerts.length" class="insight">
            <span class="insight__tag">洞察</span>
            <span class="insight__text">{{ insightSummary }}</span>
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { GAME_MAP, PROJECT_MAP } from '@/domain/dimensions';
    import { money, percent, ratio, trendArrow, trendClass } from '@/utils/format';
    import type { AlertItem } from '@/domain/types';

    defineOptions({ name: 'OverviewAlertPanel' });

    type Level = AlertItem['level'];
    /** 等级筛选值：'all' = 全部 */
    type LevelFilter = Level | 'all';

    const { filter } = useAnalysisFilter();

    /** 全量预警（随全局筛选条件重算） */
    const alerts = computed<AlertItem[]>(() => store.alerts(filter));

    // ---------- 等级筛选 ----------
    const levelFilter = ref<LevelFilter>('all');

    const LEVEL_TEXT: Record<Level, string> = { high: '高风险', medium: '中风险', low: '低风险' };
    const TAG_TYPE: Record<Level, 'danger' | 'warning' | 'info'> = {
        high: 'danger',
        medium: 'warning',
        low: 'info',
    };
    const LEVELS: Level[] = ['high', 'medium', 'low'];

    const LEVEL_OPTIONS: Array<{ value: LevelFilter; label: string }> = [
        { value: 'all', label: '全部' },
        { value: 'high', label: '高风险' },
        { value: 'medium', label: '中风险' },
        { value: 'low', label: '低风险' },
    ];

    /** 三档条数统计 */
    const levelStats = computed(() =>
        LEVELS.map((level) => ({
            level,
            label: LEVEL_TEXT[level],
            count: alerts.value.filter((a) => a.level === level).length,
        })),
    );

    function toggleLevel(level: Level) {
        levelFilter.value = levelFilter.value === level ? 'all' : level;
    }

    const visibleAlerts = computed<AlertItem[]>(() =>
        levelFilter.value === 'all' ? alerts.value : alerts.value.filter((a) => a.level === levelFilter.value),
    );

    // ---------- 数值格式化（按 unit 智能选择） ----------
    function formatByUnit(value: number, unit: string): string {
        if (!Number.isFinite(value)) return '—';
        if (unit === '倍') return ratio(value);
        if (unit === '%') return percent(value);
        if (unit === '元') return money(value);
        return value.toFixed(2);
    }

    /** 当前值：带单位后缀（倍 / % 已含在格式化结果里，元用「元」标注） */
    function displayValue(a: AlertItem): string {
        const text = formatByUnit(a.value, a.unit);
        return a.unit === '元' ? `${text} 元` : text;
    }

    function displayThreshold(a: AlertItem): string {
        const text = formatByUnit(a.threshold, a.unit);
        return a.unit === '元' ? `${text} 元` : text;
    }

    /** 与阈值的差额原文（小数位与展示位对齐，不引入新数字） */
    function gapText(a: AlertItem): string {
        const d = a.value - a.threshold;
        const abs = formatByUnit(Math.abs(d), a.unit);
        const suffix = a.unit === '元' ? ' 元' : '';
        if (!Number.isFinite(d) || d === 0) return `与阈值持平${suffix}`;
        return d > 0 ? `高于阈值 ${abs}${suffix}` : `低于阈值 ${abs}${suffix}`;
    }

    // ---------- 阈值进度条（纯展示：当前值相对阈值的比例） ----------
    /**
     * 阈值是否为「有意义的比例基准」。
     * 「单游戏经营亏损」这类预警的阈值是 0（含义是"利润应大于 0"），
     * 拿 0 当分母算不出百分比，早期实现只能兜底成 50% 宽度，
     * 在界面上表现为一条没有信息的整行色带 —— 这种情形直接不画进度条。
     */
    function hasScale(a: AlertItem): boolean {
        return Number.isFinite(a.threshold) && Math.abs(a.threshold) > 1e-9;
    }

    function barWidth(a: AlertItem): string {
        const base = Math.abs(a.threshold);
        if (!Number.isFinite(a.value) || base <= 1e-9) return '0%';
        const pct = Math.min(100, Math.max(0, (Math.abs(a.value) / base) * 100));
        return `${pct.toFixed(1)}%`;
    }

    // ---------- 底部洞察结语 ----------
    const DIM_PHRASE: Record<string, string> = {
        game: '游戏',
        pitcher: '投手',
        group: '小组',
        project: '项目',
        platform: '平台',
        center: '中心',
        department: '部门',
        company: '公司',
        month: '月份',
    };

    function uniq(list: string[]): string[] {
        return Array.from(new Set(list));
    }

    /** 去重后的对象名称（按出现频次降序，最多 4 个） */
    function topNames(names: string[], limit = 4): { list: string[]; more: number } {
        const counter = new Map<string, number>();
        for (const n of names) counter.set(n, (counter.get(n) ?? 0) + 1);
        const sorted = Array.from(counter.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([n]) => n);
        return { list: sorted.slice(0, limit), more: Math.max(0, sorted.length - limit) };
    }

    /** 预警涉及的「游戏所属项目」——由 dimKey 经 GAME_MAP 反查，不新增业务数字 */
    function projectsOfGameAlerts(list: AlertItem[]): string[] {
        return uniq(
            list
                .filter((a) => a.dim === 'game')
                .map((a) => PROJECT_MAP.get(GAME_MAP.get(a.dimKey)?.projectId ?? '')?.name ?? '')
                .filter((n) => n.length > 0),
        );
    }

    /** 一句中文总结：全部数字均由预警集合本身聚合而来 */
    const insightSummary = computed(() => {
        const list = alerts.value;
        if (!list.length) return '';

        const parts: string[] = [`本周期共 ${list.length} 条预警`];

        // 出现最多的预警类型
        const typeCounter = new Map<string, number>();
        for (const a of list) typeCounter.set(a.type, (typeCounter.get(a.type) ?? 0) + 1);
        const topType = Array.from(typeCounter.entries()).sort((a, b) => b[1] - a[1])[0];
        if (topType && topType[1] > 1) parts.push(`其中 ${topType[1]} 条为${topType[0]}`);

        // 集中对象：同类型预警涉及的名称（按维度分别措辞，避免把投手说成游戏）
        const sameType = list.filter((a) => a.type === topType?.[0]);
        if (sameType.length >= 2) {
            for (const dim of uniq(sameType.map((a) => a.dim))) {
                const phrase = DIM_PHRASE[dim] ?? '对象';
                const names = topNames(
                    sameType.filter((a) => a.dim === dim).map((a) => a.dimName),
                );
                if (names.list.length >= 2) {
                    parts.push(
                        `涉及${phrase} ${names.list.join('、')}${names.more ? ` 等 ${names.list.length + names.more} 个` : ''}`,
                    );
                }
            }
            // 项目集中度只从「同类型游戏预警」反查，保证与上一句指向同一批对象
            const sameTypeProjects = projectsOfGameAlerts(sameType);
            if (sameTypeProjects.length) {
                const proj = topNames(sameTypeProjects, 3);
                parts.push(`集中在${proj.list.join('、')}${proj.more ? ` 等 ${proj.list.length + proj.more} 个` : ''}`);
            }
        }

        // 等级构成
        const highN = list.filter((a) => a.level === 'high').length;
        parts.push(highN ? `其中高风险 ${highN} 条，建议优先处理` : '暂无高风险项，可按中低风险顺序跟进');

        return `${parts.join('，')}。`;
    });
</script>

<style scoped lang="scss">
    .alert-panel__body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        padding: 12px;
        overflow: hidden;
    }

    // ---------- 顶部统计卡 ----------
    .stat-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        flex: 0 0 auto;
    }

    .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 10px;
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-card);
        cursor: pointer;
        text-align: left;
        font: inherit;
        transition: background 0.15s, border-color 0.15s;

        &:hover {
            background: var(--oa-hover);
        }

        &.is-active {
            border-color: currentColor;
            background: var(--oa-hover);
        }
    }

    .stat__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: 0 0 auto;
    }

    .stat__label {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
        white-space: nowrap;
    }

    .stat__num {
        margin-left: auto;
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        line-height: 1.1;
    }

    .stat__unit {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .stat--high {
        color: var(--oa-danger);
    }

    .stat--medium {
        color: var(--oa-warning);
    }

    .stat--low {
        color: var(--oa-text-4);
    }

    .stat--high .stat__dot {
        background: var(--oa-danger);
    }

    .stat--medium .stat__dot {
        background: var(--oa-warning);
    }

    .stat--low .stat__dot {
        background: var(--oa-text-4);
    }

    .stat--high .stat__num {
        color: var(--oa-danger);
    }

    .stat--medium .stat__num {
        color: var(--oa-warning);
    }

    .stat--low .stat__num {
        color: var(--oa-text-3);
    }

    // ---------- 预警列表 ----------
    .alert-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1 1 auto;
        min-height: 0;
        max-height: 440px;
        padding-right: 4px;
    }

    .alert-list__none {
        margin: 16px 0;
        text-align: center;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .alert {
        padding: 8px 10px 9px;
        border: 1px solid var(--oa-border-light);
        border-left-width: 3px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-card);

        &:hover {
            background: var(--oa-hover);
        }
    }

    .alert--high {
        border-left-color: var(--oa-danger);
    }

    .alert--medium {
        border-left-color: var(--oa-warning);
    }

    .alert--low {
        border-left-color: var(--oa-info, var(--oa-primary));
    }

    .alert__top {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .alert__type {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
        white-space: nowrap;
    }

    .alert__obj {
        margin-left: auto;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 45%;
    }

    .alert__title {
        margin: 5px 0 0;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        line-height: 1.45;
        color: var(--oa-text-1);
    }

    .alert__desc {
        margin: 3px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.5;
        color: var(--oa-text-3);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .alert__compare {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
    }

    .cmp {
        display: flex;
        align-items: baseline;
        gap: 4px;
        min-width: 0;
    }

    .cmp__k {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .cmp__v {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
    }

    .cmp__v--high {
        color: var(--oa-danger);
    }

    .cmp__v--medium {
        color: var(--oa-warning);
    }

    .cmp__v--low {
        color: var(--oa-info, var(--oa-primary));
    }

    .cmp__v--threshold {
        font-weight: 500;
        color: var(--oa-text-3);
    }

    .cmp__sign {
        font-size: var(--oa-fs-xs);
    }

    .alert__track {
        height: 4px;
        margin-top: 5px;
        border-radius: 2px;
        background: var(--oa-border-light);
        overflow: hidden;
    }

    .alert__fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.2s;
    }

    .alert__fill--high {
        background: var(--oa-danger);
    }

    .alert__fill--medium {
        background: var(--oa-warning);
    }

    .alert__fill--low {
        background: var(--oa-info, var(--oa-primary));
    }

    .alert__suggest {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        margin-top: 7px;
        padding: 5px 8px;
        border-left: 2px solid var(--oa-primary);
        border-radius: 0 var(--oa-radius-sm) var(--oa-radius-sm) 0;
        background: var(--oa-primary-soft);
    }

    .alert__suggest-tag {
        flex: 0 0 auto;
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        color: var(--oa-primary-deep);
    }

    .alert__suggest-text {
        font-size: var(--oa-fs-xs);
        line-height: 1.5;
        color: var(--oa-text-2);
    }

    // ---------- 空态 ----------
    .safe {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex: 1 1 auto;
        min-height: 160px;
        border: 1px solid var(--oa-success-soft);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-success-soft);
    }

    .safe__check {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--oa-success);
        color: #fff;
        font-size: var(--oa-fs-lg);
        line-height: 1;
    }

    .safe__text {
        margin: 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-success);
    }

    // ---------- 洞察结语 ----------
    .insight {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        flex: 0 0 auto;
        margin: 0;
        padding: 7px 10px;
        border: 1px dashed var(--oa-border);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-hover);
    }

    .insight__tag {
        flex: 0 0 auto;
        font-size: var(--oa-fs-xs);
        font-weight: 600;
        color: var(--oa-primary-deep);
    }

    .insight__text {
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-2);
    }
</style>
