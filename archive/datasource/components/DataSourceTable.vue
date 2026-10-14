<template>
    <PanelCard title="数据源清单" :subtitle="subtitle" plain>
        <template #title>
            <el-tag size="small" type="info" effect="plain">完整度 / 最近更新为演示数据</el-tag>
        </template>

        <template #actions>
            <div class="filters">
                <el-radio-group v-model="category" size="small">
                    <el-radio-button value="all">全部类别</el-radio-button>
                    <el-radio-button v-for="c in CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</el-radio-button>
                </el-radio-group>

                <el-select v-model="status" size="small" style="width: 132px">
                    <el-option label="全部接入状态" value="all" />
                    <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>

                <el-button size="small" text @click="reset">重置</el-button>
            </div>
        </template>

        <div class="table-wrap">
            <el-table :data="rows" size="small" height="100%" :border="false" show-overflow-tooltip row-key="id">
                <el-table-column prop="name" label="数据源名称" min-width="176" fixed>
                    <template #default="{ row }">
                        <div class="cell-name">
                            <span class="cell-name__dot" :style="{ background: CATEGORY_COLOR[row.category as SourceCategory] }" />
                            <span class="cell-name__text">{{ row.name }}</span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column label="类别" width="96" align="center">
                    <template #default="{ row }">
                        <el-tag size="small" effect="plain" :color="softColor(row.category)" class="cell-cat">
                            {{ row.category }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="覆盖的看板指标" min-width="230">
                    <template #default="{ row }">
                        <div class="cell-tags">
                            <el-tag v-for="mm in row.metrics" :key="mm" size="small" type="info" effect="plain">{{ mm }}</el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column label="提供方 / 接口" min-width="190">
                    <template #default="{ row }">
                        <span class="cell-mono">{{ row.provider }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="更新频率" min-width="150" prop="frequency" />

                <el-table-column label="粒度" width="72" align="center" prop="granularity" />

                <el-table-column label="接入状态" width="100" align="center">
                    <template #default="{ row }">
                        <el-tag size="small" :type="STATUS_TYPE[row.status as SourceStatus]">{{ STATUS_LABEL[row.status as SourceStatus] }}</el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="数据完整度" width="152">
                    <template #default="{ row }">
                        <el-progress
                            :percentage="Math.round(completenessOf(row) * 100)"
                            :stroke-width="8"
                            :status="progressStatus(completenessOf(row))"
                            :format="(p: number) => `${p}%`"
                        />
                    </template>
                </el-table-column>

                <el-table-column label="最近更新" width="110" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ lastUpdatedOf(row, store.currentMonth) }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="备注 / 对看板的影响" min-width="300">
                    <template #default="{ row }">
                        <span class="cell-note">{{ row.note }}</span>
                    </template>
                </el-table-column>
            </el-table>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { store } from '@/domain/store';
    import {
        CATEGORY_COLOR,
        CATEGORY_OPTIONS,
        COMPLETENESS_TARGET,
        DATA_SOURCES,
        STATUS_LABEL,
        STATUS_OPTIONS,
        STATUS_TYPE,
        completenessOf,
        lastUpdatedOf,
        type SourceCategory,
        type SourceStatus,
    } from './meta';

    /**
     * 区块 2 · 数据源清单表（本页主体）
     * 清单字段（名称 / 类别 / 覆盖指标 / 提供方 / 频率 / 粒度 / 接入状态 / 备注）为业务事实；
     * 「数据完整度」「最近更新」两列是 hash01 确定性演示值，已在表头标注。
     * 本页与全局筛选条件无关，但遵守契约「无 props、自包含」；筛选（类别 / 接入状态）仅作用于本表。
     */
    defineOptions({ name: 'DataSourceTable' });

    const category = ref<SourceCategory | 'all'>('all');
    const status = ref<SourceStatus | 'all'>('all');

    const rows = computed(() =>
        DATA_SOURCES.filter((s) => (category.value === 'all' || s.category === category.value) && (status.value === 'all' || s.status === status.value)),
    );

    const subtitle = computed(
        () => `共 ${DATA_SOURCES.length} 个数据源，当前显示 ${rows.value.length} 个 · 目标完整度 ${Math.round(COMPLETENESS_TARGET * 100)}% · 统计基准 ${store.currentMonth}`,
    );

    function softColor(cat: SourceCategory): string {
        const hex = CATEGORY_COLOR[cat];
        return `${hex}1a`;
    }

    function progressStatus(v: number): '' | 'success' | 'warning' {
        return v >= COMPLETENESS_TARGET ? 'success' : 'warning';
    }

    function reset(): void {
        category.value = 'all';
        status.value = 'all';
    }
</script>

<style scoped lang="scss">
    .filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .table-wrap {
        height: 520px;
        min-height: 0;
    }

    .cell-name {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .cell-name__dot {
        flex: 0 0 auto;
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .cell-name__text {
        font-weight: 600;
        color: var(--oa-text-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cell-cat {
        border-color: transparent;
    }

    .cell-tags {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
    }

    .cell-mono {
        color: var(--oa-text-2);
        word-break: break-all;
    }

    .cell-note {
        color: var(--oa-text-3);
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
    }

    @media (max-width: 1280px) {
        .filters {
            justify-content: flex-start;
        }
    }
</style>
