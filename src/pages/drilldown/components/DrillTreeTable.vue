<template>
    <section class="drill-tree">
        <!-- 顶部细工具条：左=下钻轴切换，中=当前下钻路径，右=批量展开 -->
        <header class="drill-tree__bar">
            <div class="drill-tree__bar-left">
                <el-radio-group :model-value="drillAxis.value" size="small" @change="onAxisChange">
                    <el-radio-button value="org">组织轴</el-radio-button>
                    <el-radio-button value="biz">业务轴</el-radio-button>
                </el-radio-group>
                <span class="drill-tree__axis">{{ axisHint }}</span>
            </div>

            <div class="drill-tree__bar-mid">
                <el-breadcrumb separator="/">
                    <el-breadcrumb-item v-for="(crumb, index) in crumbs" :key="`${crumb.dim}:${crumb.key}`">
                        <!-- 根面包屑叫「全公司」（与筛选栏口径一致），树表根行用的是法人主体名；
                             两者是同一对象，这里点明，避免同一屏出现两个叫法被当成两件事 -->
                        <el-tooltip :disabled="index !== 0" content="= 全公司合计（法人主体：云舟互娱）" placement="bottom">
                            <span class="drill-tree__crumb" :class="{ 'is-current': index === crumbs.length - 1 }">
                                {{ crumb.name }}
                            </span>
                        </el-tooltip>
                    </el-breadcrumb-item>
                </el-breadcrumb>
            </div>

            <div class="drill-tree__bar-right">
                <el-button size="small" :disabled="empty" @click="expandToSecondLevel()">全部展开到第 2 层</el-button>
            </div>
        </header>

        <!-- 表格区：外层 flex + min-height:0 保证 el-table height="100%" 生效并内部滚动 -->
        <div class="drill-tree__body">
            <PanelEmptyState v-if="empty" class="drill-tree__empty" text="当前筛选条件下暂无下钻数据" />

            <div v-else class="drill-tree__table">
                <el-table
                    :key="tableKey"
                    ref="tableRef"
                    :data="treeData"
                    row-key="key"
                    lazy
                    :load="loadChildren"
                    :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
                    size="small"
                    height="100%"
                    :default-sort="{ prop: 'operatingProfit', order: 'descending' }"
                    :row-class-name="rowClassName"
                    show-summary
                    :summary-method="summaryMethod"
                    @row-click="onRowClick"
                    @sort-change="onSortChange"
                >
                    <!-- 名称：树形展开箭头由 el-table 渲染；成本中心额外标注 -->
                    <el-table-column prop="name" label="名称" min-width="200" fixed show-overflow-tooltip>
                        <template #default="{ row }">
                            <span class="drill-tree__name">{{ row.name }}</span>
                            <span v-if="row.hasChildren" class="drill-tree__next">{{ nextHint(row) }}</span>
                            <el-tag v-if="isCostCenter(row)" class="drill-tree__cost" size="small" type="info">成本中心</el-tag>
                        </template>
                    </el-table-column>

                    <el-table-column prop="depth" label="层级" min-width="76">
                        <template #default="{ row }">
                            <el-tag size="small" effect="plain" :type="levelTagType(row.depth)">{{ levelLabel(row.depth) }}</el-tag>
                        </template>
                    </el-table-column>

                    <el-table-column prop="headcount" label="人数" width="70" align="right" class="oa-num">
                        <template #default="{ row }">{{ comma(row.headcount) }}</template>
                    </el-table-column>

                    <el-table-column prop="spend" label="投放消耗" min-width="110" align="right" class="oa-num">
                        <template #default="{ row }">{{ money(row.spend) }}</template>
                    </el-table-column>

                    <el-table-column prop="accrualRevenue" label="应确认收入" min-width="110" align="right" class="oa-num">
                        <template #default="{ row }">{{ money(row.accrualRevenue) }}</template>
                    </el-table-column>

                    <el-table-column prop="bookProfit" label="账面利润" min-width="110" align="right" class="oa-num">
                        <template #default="{ row }">
                            <span :class="trendClass(row.bookProfit)">{{ money(row.bookProfit) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column
                        prop="operatingProfit"
                        label="经营利润"
                        min-width="120"
                        align="right"
                        class="oa-num"
                        sortable="custom"
                    >
                        <template #default="{ row }">
                            <span class="drill-tree__strong" :class="trendClass(row.operatingProfit)">{{ money(row.operatingProfit) }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="operatingMargin" label="经营利润率" min-width="100" align="right" class="oa-num">
                        <template #header>
                            <el-tooltip content="经营利润 ÷ 应确认收入。纯成本中心（研发/中职等无收入节点）无可除基数，显示「—」" placement="top">
                                <span class="drill-tree__help">经营利润率</span>
                            </el-tooltip>
                        </template>
                        <template #default="{ row }">
                            <span v-if="row.accrualRevenue > 0" :class="trendClass(row.operatingMargin)">{{ percent(row.operatingMargin) }}</span>
                            <span v-else class="oa-flat">—</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="forecastRoi" min-width="100" align="right" class="oa-num">
                        <template #header>
                            <el-tooltip content="累计口径：累计预估总回收 / 累计消耗，1.0 = 回本" placement="top">
                                <span class="drill-tree__help">累计预估 ROI</span>
                            </el-tooltip>
                        </template>
                        <template #default="{ row }">{{ ratio(row.forecastRoi) }}</template>
                    </el-table-column>

                    <el-table-column prop="recoveryRate" min-width="100" align="right" class="oa-num">
                        <template #header>
                            <el-tooltip content="累计口径：累计已回收 ÷ 累计预估总回收（自数据起点累计，不是本期口径），反映存量用户的回收进度" placement="top">
                                <span class="drill-tree__help">回收完成度</span>
                            </el-tooltip>
                        </template>
                        <template #default="{ row }">{{ percent(row.recoveryRate) }}</template>
                    </el-table-column>

                    <el-table-column prop="efficiencyRatio" label="人效比" min-width="88" align="right" class="oa-num">
                        <template #header>
                            <el-tooltip content="经营利润 ÷ 人力成本。无人力成本的节点显示「—」" placement="top">
                                <span class="drill-tree__help">人效比</span>
                            </el-tooltip>
                        </template>
                        <template #default="{ row }">
                            <span v-if="row.laborCost > 0" :class="trendClass(row.efficiencyRatio)">{{ ratio(row.efficiencyRatio) }}</span>
                            <span v-else class="oa-flat">—</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="mom" label="环比" min-width="90" align="right" class="oa-num">
                        <template #default="{ row }">
                            <span v-if="row.mom === null" class="oa-flat">—</span>
                            <span v-else :class="trendClass(row.mom)">{{ trendArrow(row.mom) }}{{ changeText(row.mom) }}</span>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
    import { computed, h, nextTick, onMounted, reactive, ref, watch, type VNode } from 'vue';
    import type { TableColumnCtx, TableInstance } from 'element-plus';
    import { store } from '@/domain/store';
    import type { DimKey, MetricRow } from '@/domain/types';
    import { GAME_MAP, PLATFORM_MAP, PROJECT_MAP, orgPath } from '@/domain/dimensions';
    import { changeText, comma, money, percent, ratio, trendArrow, trendClass } from '@/utils/format';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { AXIS_LEVELS, drillAxis, drillSelection, selectNode } from '../useDrillSelection';

    /**
     * 树形下钻表（M7）：公司 → 中心 → 部门 → 小组 → 投手 / 公司 → 平台 → 项目 → 游戏。
     * 每一层都用 store 现算「赚了多少」，用 el-table 的懒加载逐层挂子树。
     */
    defineOptions({ name: 'DrillTreeTable' });

    /** 树表行 = MetricRow + 树/选中所需元数据 */
    type TreeRow = MetricRow & {
        /** el-table row-key：`${dim}:${key}`。同一 key（如游戏）会出现在不同父节点下，必须带维度前缀保证唯一 */
        key: string;
        /** 该行所属维度 */
        dim: DimKey;
        /** 该行在自身维度中的原始 id（store 查询与选中联动都用它） */
        dimKey: string;
        depth: number;
        hasChildren: boolean;
    };

    /** 面包屑项 */
    interface Crumb {
        dim: DimKey;
        key: string;
        name: string;
    }

    type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

    const { filter } = useAnalysisFilter();

    /** 层级 tag 配色：越深的层级越中性，避免「红=风险」被误读 */
    const LEVEL_TAG_TYPES: TagType[] = ['primary', 'success', 'warning', 'info', 'info'];

    /** 全公司根面包屑（与共享选中状态的默认值一致） */
    const COMPANY_CRUMB: Crumb = { dim: 'company', key: 'company', name: '全公司' };

    const tableRef = ref<TableInstance>();

    /** 已加载的下一层行（key = 父行 uid，值保持 store 原始顺序），供一键展开与就地重排使用 */
    const rawCache = new Map<string, TreeRow[]>();
    /** 已加载的子节点数量（响应式，用于名称后的灰色小字提示） */
    const childCounts = reactive(new Map<string, number>());

    /** 排序状态：el-table 只负责表头交互，真正的排序由 sortRows 对「每一层」统一处理 */
    const sortState = reactive<{ prop: string; order: 'ascending' | 'descending' | null }>({
        prop: 'operatingProfit',
        order: 'descending',
    });

    const axisLevels = computed(() => AXIS_LEVELS[drillAxis.value]);
    const axisDims = computed<DimKey[]>(() => axisLevels.value.map((item) => item.dim));
    /** 当前轴的层级链，提示「这一轴能钻到哪」 */
    const axisHint = computed(() => axisLevels.value.map((item) => item.label).join(' › '));

    function uid(dim: DimKey, key: string): string {
        return `${dim}:${key}`;
    }

    /** store 行 → 树行（depth 按当前轴层级重算，保证切轴后层级标签一致） */
    function toTreeRow(row: MetricRow, dim: DimKey, depth: number): TreeRow {
        const hasNextLevel = depth < axisLevels.value.length - 1;
        return {
            ...row,
            dim,
            dimKey: row.key,
            key: uid(dim, row.key),
            depth,
            hasChildren: row.hasChildren && hasNextLevel,
        };
    }

    function sortValue(row: TreeRow, prop: string): number | null {
        const value = (row as unknown as Record<string, unknown>)[prop];
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    /** 同一父节点下按当前排序状态排列（null 值恒排最后，无论升降序） */
    function sortRows(rows: TreeRow[]): TreeRow[] {
        const { prop, order } = sortState;
        if (!order) return rows.slice();
        const dir = order === 'ascending' ? 1 : -1;
        return rows.slice().sort((a, b) => {
            const av = sortValue(a, prop);
            const bv = sortValue(b, prop);
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return (av - bv) * dir;
        });
    }

    /** 根数据：公司唯一一行 */
    const rootRows = computed(() => store.queryRows(filter, 'company').map((row) => toTreeRow(row, 'company', 0)));
    const treeData = computed(() => sortRows(rootRows.value));
    const empty = computed(() => rootRows.value.length === 0);

    /**
     * 轴 / 筛选变化时重建表格实例。
     * 懒加载的子节点按 row-key 缓存在 el-table 内部，不重建会把上一次筛选的子树串到新数据上。
     */
    const tableKey = computed(() => `${drillAxis.value}|${JSON.stringify(filter)}`);

    watch(tableKey, async () => {
        rawCache.clear();
        childCounts.clear();
        await autoExpand();
    });

    /**
     * 默认展开到第 2 层。
     *
     * 页面打开就应该是「公司 → 中心 → 部门」这个视图，不需要用户先点一次
     * 「全部展开到第 2 层」——否则首屏只有一行「云舟互娱」，看不出任何信息。
     * 切轴或改筛选条件后表格会按 tableKey 重建，这里同样自动恢复展开状态。
     */
    async function autoExpand(attempt = 0) {
        // 等一帧让 el-table 实例挂载完成（表格按 key 重建时 tableRef 会换成新实例）
        await nextTick();
        if (typeof requestAnimationFrame === 'function') {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        await nextTick();
        const ok = await expandToSecondLevel();
        // 首屏字体/样式尚未就绪时表格实例可能还没接管，退避重试几次，避免"默认不展开"
        if (!ok && attempt < 4) {
            await new Promise<void>((resolve) => setTimeout(resolve, 60));
            await autoExpand(attempt + 1);
        }
    }

    onMounted(() => {
        void autoExpand();
    });

    /** 下一层维度（已经是叶子则返回 null） */
    function nextDim(depth: number): DimKey | null {
        return axisLevels.value[depth + 1]?.dim ?? null;
    }

    /** 取某一行的下一层（带缓存，同一父节点只查一次 store） */
    function fetchChildren(parent: TreeRow, dim: DimKey): TreeRow[] {
        const cacheKey = uid(parent.dim, parent.dimKey);
        const cached = rawCache.get(cacheKey);
        if (cached) return cached;

        // 平台是「公司」直属的第一层：store 对 platform 传 parentId 会返回空数组
        const parentId = dim === 'platform' ? null : parent.dimKey;
        const rows = store.queryRows(filter, dim, parentId).map((row) => toTreeRow(row, dim, parent.depth + 1));
        rawCache.set(cacheKey, rows);
        childCounts.set(cacheKey, rows.length);
        return rows;
    }

    /** el-table 懒加载回调：展开某行时才算下一层 */
    function loadChildren(row: TreeRow, _treeNode: unknown, resolve: (rows: TreeRow[]) => void) {
        const dim = nextDim(row.depth);
        if (!dim) {
            resolve([]);
            return;
        }
        resolve(sortRows(fetchChildren(row, dim)));
    }

    /** 名称后的灰色小字：已加载则显示「N 个中心」，未加载则提示可下钻的层级名 */
    function nextHint(row: TreeRow): string {
        const label = axisLevels.value[row.depth + 1]?.label ?? '';
        const count = childCounts.get(uid(row.dim, row.dimKey));
        return count === undefined ? `下钻${label}` : `${count} 个${label}`;
    }

    /** 成本中心：没有投放消耗但有人工成本（研发中心 / 中台 / 职能中心及其下级） */
    function isCostCenter(row: TreeRow): boolean {
        return row.spend <= 0 && row.laborCost > 0;
    }

    function levelLabel(depth: number): string {
        return axisLevels.value[depth]?.label ?? '—';
    }

    function levelTagType(depth: number): TagType {
        return LEVEL_TAG_TYPES[depth] ?? 'info';
    }

    /** 行高亮：row-class-name 用 computed 返回新函数，选中变化时 el-table 才会重渲染 */
    const rowClassName = computed(() => {
        const dim = drillSelection.dim;
        const key = drillSelection.key;
        return ({ row }: { row: TreeRow }) => (row.dim === dim && row.dimKey === key ? 'is-drill-current' : '');
    });

    /** 点击行 = 选中该节点（详情侧栏 / 交叉矩阵共享这一份状态） */
    function onRowClick(row: TreeRow) {
        selectNode(row.dim, row.dimKey, row.name);
    }

    /** 切换下钻轴：两轴节点 id 空间不同，原选中节点在另一轴无意义 → 回到全公司 */
    function onAxisChange(value: unknown) {
        const next: 'org' | 'biz' = value === 'biz' ? 'biz' : 'org';
        if (next === drillAxis.value) return;
        drillAxis.value = next;
        selectNode('company', COMPANY_CRUMB.key, COMPANY_CRUMB.name);
        nextTick(() => tableRef.value?.doLayout());
    }

    /** 表头排序：已加载的每一层就地重排（展开状态不受影响） */
    function onSortChange(payload: { prop: string | null; order: string | null }) {
        sortState.prop = payload.prop || 'operatingProfit';
        sortState.order = payload.order === 'ascending' || payload.order === 'descending' ? payload.order : null;
        rawCache.forEach((rows, key) => tableRef.value?.updateKeyChildren(key, sortRows(rows)));
    }

    /**
     * 一键展开到第 2 层：先展开根节点（触发第 1 层加载），再展开第 1 层（触发第 2 层加载）。
     * el-table 的懒加载状态更新在 pre 队列里，所以每次要等一个 tick。
     */
    async function expandToSecondLevel(): Promise<boolean> {
        const table = tableRef.value;
        const root = treeData.value[0];
        if (!table || !root) return false;
        table.toggleRowExpansion(root, true);
        await nextTick();
        const firstLevel = rawCache.get(uid(root.dim, root.dimKey)) ?? [];
        if (!firstLevel.length) return false;
        firstLevel.forEach((row) => table.toggleRowExpansion(row, true));
        await nextTick();
        table.doLayout();
        return true;
    }

    /** 组织轴面包屑：直接用组织树的祖先链 */
    function orgCrumbs(): Crumb[] {
        const path = orgPath(drillSelection.key);
        if (!path.length) return [COMPANY_CRUMB];
        return path.map((node, index) => ({
            dim: node.level,
            key: node.id,
            name: index === 0 ? COMPANY_CRUMB.name : node.name,
        }));
    }

    /** 业务轴面包屑：用 PLATFORM_MAP / PROJECT_MAP / GAME_MAP 回溯 */
    function bizCrumbs(): Crumb[] {
        const { dim, key, name } = drillSelection;
        if (dim === 'platform') {
            return [COMPANY_CRUMB, { dim, key, name: PLATFORM_MAP.get(key)?.name ?? name }];
        }
        if (dim === 'project') {
            const project = PROJECT_MAP.get(key);
            return project ? [COMPANY_CRUMB, { dim, key, name: project.name }] : [COMPANY_CRUMB];
        }
        if (dim === 'game') {
            const game = GAME_MAP.get(key);
            if (!game) return [COMPANY_CRUMB];
            const project = PROJECT_MAP.get(game.projectId);
            const crumbs: Crumb[] = [COMPANY_CRUMB];
            // 平台层省略：同一项目/游戏归属多个平台，树中父级不唯一，面包屑只表达下钻层级链
            if (project) crumbs.push({ dim: 'project', key: project.id, name: project.name });
            crumbs.push({ dim, key, name: game.name });
            return crumbs;
        }
        return [COMPANY_CRUMB];
    }

    const crumbs = computed<Crumb[]>(() => {
        if (drillSelection.dim === 'company' || !axisDims.value.includes(drillSelection.dim)) return [COMPANY_CRUMB];
        return drillAxis.value === 'org' ? orgCrumbs() : bizCrumbs();
    });

    /**
     * 表尾汇总：金额 / 人数列求和；比率列用「合计值 / 合计值」重算（不能直接求和），全部注意除零。
     * 累计口径比值（预估 ROI / 回收完成度）的分母「累计消耗」未在 Metrics 中暴露，
     * 因此按本期消耗加权；本表根数据恒为全公司一行，此时结果与 store 的全公司累计口径一致。
     */
    function summaryMethod({ columns, data }: { columns: TableColumnCtx[]; data: TreeRow[] }): (string | VNode)[] {
        const sum = (pick: (row: TreeRow) => number) =>
            data.reduce((acc, row) => {
                const value = pick(row);
                return acc + (Number.isFinite(value) ? value : 0);
            }, 0);

        const totalSpend = sum((row) => row.spend);
        const totalAccrual = sum((row) => row.accrualRevenue);
        const totalLabor = sum((row) => row.laborCost);
        const totalBookProfit = sum((row) => row.bookProfit);
        const totalOperatingProfit = sum((row) => row.operatingProfit);

        /** 按本期消耗加权的比率汇总；本期消耗为 0（无投放期 / 纯成本中心）时返回 null，由调用方显示「—」而不是伪造的 0 */
        const weightedBySpend = (pick: (row: TreeRow) => number) =>
            totalSpend > 0 ? sum((row) => pick(row) * row.spend) / totalSpend : null;

        const num = (text: string, cls = '') => h('span', { class: ['oa-num', 'drill-tree__sum', cls] }, text);

        return columns.map((column) => {
            switch (column.property) {
                case 'name':
                    return h('span', { class: 'drill-tree__sum-label' }, '合计（当前筛选范围）');
                case 'headcount':
                    return num(comma(sum((row) => row.headcount)));
                case 'spend':
                    return num(money(totalSpend));
                case 'accrualRevenue':
                    return num(money(totalAccrual));
                case 'bookProfit':
                    return num(money(totalBookProfit), trendClass(totalBookProfit));
                case 'operatingProfit':
                    return num(money(totalOperatingProfit), trendClass(totalOperatingProfit));
                case 'operatingMargin': {
                    if (totalAccrual <= 0) return num('—');
                    const margin = totalOperatingProfit / totalAccrual;
                    return num(percent(margin), trendClass(margin));
                }
                case 'forecastRoi': {
                    const roi = weightedBySpend((row) => row.forecastRoi);
                    return num(roi === null ? '—' : ratio(roi));
                }
                case 'recoveryRate': {
                    const rate = weightedBySpend((row) => row.recoveryRate);
                    return num(rate === null ? '—' : percent(rate));
                }
                case 'efficiencyRatio':
                    return num(totalLabor > 0 ? ratio(totalOperatingProfit / totalLabor) : '—');
                case 'mom':
                    return h('span', { class: ['oa-flat', 'drill-tree__sum'] }, '—');
                default:
                    return '';
            }
        });
    }
</script>

<style scoped lang="scss">
    .drill-tree {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
        overflow: hidden;
    }

    /* 顶部细工具条 */
    .drill-tree__bar {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
        padding: 5px 10px;
        border-bottom: 1px solid var(--oa-border-light);
        background: var(--oa-hover);
    }

    .drill-tree__bar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
    }

    .drill-tree__axis {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        white-space: nowrap;
    }

    .drill-tree__bar-mid {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
    }

    .drill-tree__bar-right {
        flex: 0 0 auto;
    }

    :deep(.el-breadcrumb) {
        font-size: var(--oa-fs-xs);
        line-height: 22px;
        white-space: nowrap;
        overflow: hidden;
    }

    :deep(.el-breadcrumb__separator) {
        color: var(--oa-text-4);
    }

    .drill-tree__crumb {
        color: var(--oa-text-3);

        &.is-current {
            color: var(--oa-text-1);
            font-weight: 600;
        }
    }

    /* 容器链每层 min-height:0，表格才能拿到确定高度并内部滚动 */
    .drill-tree__body {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
    }

    .drill-tree__empty {
        flex: 1 1 auto;
        min-height: 0;
    }

    /* 兜底最小高度：父级未给出高度时表格仍可滚动 */
    .drill-tree__table {
        flex: 1 1 auto;
        min-height: 320px;
        overflow: hidden;

        :deep(.el-table) {
            font-size: var(--oa-fs-sm);

            .el-table__cell {
                padding: 5px 0;
            }

            .el-table__row {
                cursor: pointer;
            }

            .el-table__expand-icon {
                color: var(--oa-text-3);
            }
        }
    }

    /* 当前选中行高亮（点击行 = 选中节点），hover 时也保持 */
    :deep(.el-table__body tr.is-drill-current > td.el-table__cell),
    :deep(.el-table__body tr.is-drill-current.hover-row > td.el-table__cell) {
        background-color: var(--oa-primary-soft);
    }

    .drill-tree__name {
        color: var(--oa-text-1);
    }

    .drill-tree__next {
        margin-left: 6px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .drill-tree__cost {
        margin-left: 6px;
    }

    .drill-tree__strong {
        font-weight: 700;
    }

    .drill-tree__help {
        border-bottom: 1px dashed var(--oa-text-4);
        cursor: help;
    }

    /* 表尾汇总行 */
    :deep(.el-table__footer-wrapper),
    :deep(.el-table__fixed-footer-wrapper) {
        td.el-table__cell {
            background-color: var(--oa-hover);
        }

        .cell {
            font-weight: 600;
            color: var(--oa-text-1);
        }
    }

    :deep(.drill-tree__sum) {
        display: block;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    :deep(.drill-tree__sum-label) {
        color: var(--oa-text-1);
        font-weight: 600;
    }
</style>
