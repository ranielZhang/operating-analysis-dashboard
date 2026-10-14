<template>
    <div class="drill-page">
        <!-- 标题区：说明两条下钻轴的业务含义（给管理者看的一句话） -->
        <header class="drill-page__head">
            <div class="drill-page__title">
                <h2>逐层下钻</h2>
                <p class="drill-page__sub">
                    按组织轴 <b>公司 → 中心 → 部门 → 小组 → 投手</b> 回答“谁在赚钱”；按业务轴
                    <b>公司 → 平台 → 项目 → 游戏</b> 回答“什么在赚钱”。点击任意一行即可在右侧查看该层级的完整经营画像。
                </p>
            </div>
            <div class="drill-page__actions">
                <el-button size="small" @click="backToCompany">回到全公司</el-button>
            </div>
        </header>

        <!-- 范围提示条：存在组织/业务范围筛选时提示，避免误读下钻结果 -->
        <div v-if="hasFilter" class="drill-page__scope">
            <span class="drill-page__scope-tag">已过滤</span>
            <span class="drill-page__scope-text">当前已按范围过滤：{{ scopeText }}（全局筛选栏可调整）</span>
        </div>

        <!-- 主区域：左侧树形下钻表（2/3），右侧节点详情（1/3）；两侧各自内部滚动 -->
        <section class="drill-page__main">
            <div class="drill-page__tree">
                <DrillTreeTable />
            </div>
            <div class="drill-page__detail">
                <DrillDetailPanel />
            </div>
        </section>

        <!-- 底部整行：组织 × 平台交叉矩阵 -->
        <section class="drill-page__matrix">
        </section>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import DrillTreeTable from './components/DrillTreeTable.vue';
    import DrillDetailPanel from './components/DrillDetailPanel.vue';
    import { selectCompany } from './useDrillSelection';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { CENTERS, DEPARTMENTS, GROUPS, PITCHERS, PLATFORMS, PROJECTS, GAMES } from '@/domain/dimensions';

    /** 逐层下钻页面组装：只做布局，不取数；轴切换由 DrillTreeTable 内部负责，此处不重复放置 */
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

    /** 当前生效的范围过滤条件描述（无筛选时不展示提示条） */
    const scopeText = computed(() => {
        const parts: string[] = [];
        if (filter.centerIds.length) parts.push(`中心：${nameText(filter.centerIds, CENTERS)}`);
        if (filter.departmentIds.length) parts.push(`部门：${nameText(filter.departmentIds, DEPARTMENTS)}`);
        if (filter.groupIds.length) parts.push(`小组：${nameText(filter.groupIds, GROUPS)}`);
        if (filter.pitcherIds.length) parts.push(`投手：${nameText(filter.pitcherIds, PITCHERS)}`);
        if (filter.platformIds.length) parts.push(`平台：${nameText(filter.platformIds, PLATFORMS)}`);
        if (filter.projectIds.length) parts.push(`项目：${nameText(filter.projectIds, PROJECTS)}`);
        if (filter.gameIds.length) parts.push(`游戏：${nameText(filter.gameIds, GAMES)}`);
        return parts.join('；');
    });

    /** 回到全公司节点（清空下钻选中，不改变全局筛选） */
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

    .drill-page__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
    }

    .drill-page__title {
        min-width: 0;

        h2 {
            margin: 0 0 4px;
            font-size: var(--oa-fs-xl);
            color: var(--oa-text-1);
            line-height: 1.3;
        }
    }

    .drill-page__sub {
        margin: 0;
        max-width: 900px;
        font-size: var(--oa-fs-sm);
        line-height: 1.6;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
            font-weight: 600;
        }
    }

    .drill-page__actions {
        flex: 0 0 auto;
        padding-top: 2px;
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

    /* 主区域：树表 2/3 + 详情 1/3，固定高度让两侧内部各自滚动 */
    .drill-page__main {
        display: grid;
        grid-template-columns: 2fr 1fr;
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

    .drill-page__matrix {
        min-width: 0;
    }

    /* 窄屏：主区域降为单列并取消固定高度，避免树表和详情被压缩 */
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
