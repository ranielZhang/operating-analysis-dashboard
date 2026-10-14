<template>
    <div class="drill-page">
        <!-- 操作行：只保留必要操作，页面名称由左侧菜单承担，不重复写标题与说明 -->
        <div class="drill-page__bar">
            <el-button size="small" @click="backToCompany">回到全公司</el-button>
        </div>

        <!-- 范围提示条：存在组织/业务范围筛选时提示，避免误读下钻结果 -->
        <div v-if="hasFilter" class="drill-page__scope">
            <span class="drill-page__scope-tag">已过滤</span>
            <span class="drill-page__scope-text">当前已按范围过滤：{{ scopeText }}（全局筛选栏可调整）</span>
        </div>

        <!-- 主区域：左侧节点详情、右侧树形下钻表，左右各占一半；两侧各自内部滚动 -->
        <section class="drill-page__main">
            <div class="drill-page__detail">
                <DrillDetailPanel />
            </div>
            <div class="drill-page__tree">
                <DrillTreeTable />
            </div>
        </section>

        <!-- 模拟预估：当月实时预估 + 未来滚动预估 + Cohort 回收曲线 -->
        <section class="drill-page__forecast">
            <div class="drill-page__section-head">
                <h3>模拟预估</h3>
                <p>
                    把当前筛选范围当成一笔投资来推演：本月最终会是多少、未来 6 个月会怎样、每个月投出去的钱回收得怎么样。
                    算法与参数说明见「预估参数配置」。
                </p>
            </div>
            <CurrentMonthForecast />
            <RollingForecast />
            <CohortRecovery />
        </section>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import DrillTreeTable from './components/DrillTreeTable.vue';
    import DrillDetailPanel from './components/DrillDetailPanel.vue';
    import CurrentMonthForecast from '@/pages/forecast/components/CurrentMonthForecast.vue';
    import RollingForecast from '@/pages/forecast/components/RollingForecast.vue';
    import CohortRecovery from '@/pages/forecast/components/CohortRecovery.vue';
    import { selectCompany } from './useDrillSelection';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { CENTERS, DEPARTMENTS, GROUPS, PITCHERS, PLATFORMS, PROJECTS, GAMES } from '@/domain/dimensions';

    /**
     * 经营数据看板（原「逐层下钻」）页面组装：只做布局，不取数。
     * 结构：主区域（节点详情 | 树表）+ 模拟预估板块（复用月度预估页的三个模块）。
     * 轴切换由 DrillTreeTable 内部负责，此处不重复放置。
     */
    defineOptions({ name: 'DrilldownPage' });

    const { filter, hasFilter } = useAnalysisFilter();

    /** 每个范围维度最多展示几个名字，超出折叠为「等 N 项」 */
    const MAX_SHOW = 3;

    /** 把一组 id 按维度元数据翻译成可读名称 */
    function nameText(ids: string[], source: Array<{ id: string; name: string }>): string {
        const map = new Map(source.map((item) => [item.id, item.name]));
        const names = ids.map((id) => map.get(id) ?? id);
        if (names.length <= MAX_SHOW) return names.join('、');
        return `${names.slice(0, MAX_SHOW).join('、')} 等 ${names.length} 项`;
    }

    /** 当前生效的组织 / 业务范围描述 */
    const scopeText = computed(() => {
        const parts: string[] = [];
        if (filter.centerIds.length) parts.push(`中心 ${nameText(filter.centerIds, CENTERS)}`);
        if (filter.departmentIds.length) parts.push(`部门 ${nameText(filter.departmentIds, DEPARTMENTS)}`);
        if (filter.groupIds.length) parts.push(`小组 ${nameText(filter.groupIds, GROUPS)}`);
        if (filter.pitcherIds.length) parts.push(`投手 ${nameText(filter.pitcherIds, PITCHERS)}`);
        if (filter.platformIds.length) parts.push(`平台 ${nameText(filter.platformIds, PLATFORMS)}`);
        if (filter.projectIds.length) parts.push(`项目 ${nameText(filter.projectIds, PROJECTS)}`);
        if (filter.gameIds.length) parts.push(`游戏 ${nameText(filter.gameIds, GAMES)}`);
        return parts.join('；') || '部分范围';
    });

    function backToCompany() {
        selectCompany();
    }
</script>

<style scoped lang="scss">
    .drill-page {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    .drill-page__bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--oa-gap);
        min-height: 24px;
    }

    .drill-page__scope {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px solid var(--oa-border-light);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .drill-page__scope-tag {
        flex: 0 0 auto;
        padding: 1px 6px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary);
        color: #fff;
    }

    .drill-page__scope-text {
        min-width: 0;
        line-height: 1.5;
    }

    /* 主区域：详情 1/2 + 树表 1/2，固定高度让两侧内部各自滚动 */
    .drill-page__main {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--oa-gap);
        align-items: stretch;
        min-height: 0;
        height: min(720px, calc(100vh - 260px));
    }

    .drill-page__tree,
    .drill-page__detail {
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;

        > * {
            flex: 1 1 auto;
            min-height: 0;
        }
    }

    /* 模拟预估板块：与上方主区域拉开层次 */
    .drill-page__forecast {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-width: 0;
        padding-top: var(--oa-gap);
        border-top: 1px solid var(--oa-border);
    }

    .drill-page__section-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;

        h3 {
            position: relative;
            margin: 0;
            padding-left: 10px;
            font-size: var(--oa-fs-lg);
            font-weight: 600;
            color: var(--oa-text-1);

            &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 15px;
                border-radius: 2px;
                background: var(--oa-primary);
            }
        }

        p {
            margin: 0;
            font-size: var(--oa-fs-xs);
            color: var(--oa-text-4);
        }
    }

    /* 窄屏：主区域降为单列并取消固定高度 */
    @media (max-width: 1400px) {
        .drill-page__main {
            grid-template-columns: 1fr;
            height: auto;
        }

        .drill-page__tree,
        .drill-page__detail {
            height: auto;
        }
    }
</style>
