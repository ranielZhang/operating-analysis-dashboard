<template>
    <PanelCard title="数据质量问题与待办清单" :subtitle="subtitle" plain>
        <template #title>
            <el-tag size="small" type="info" effect="plain">问题数为演示值</el-tag>
        </template>

        <template #actions>
            <el-radio-group v-model="level" size="small">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="high">高</el-radio-button>
                <el-radio-button value="medium">中</el-radio-button>
                <el-radio-button value="low">低</el-radio-button>
            </el-radio-group>
        </template>

        <div class="issues">
            <el-table :data="rows" size="small" height="100%" :border="false" show-overflow-tooltip row-key="id">
                <el-table-column prop="problem" label="问题" min-width="220">
                    <template #default="{ row }">
                        <span class="issues__problem">{{ row.problem }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="impact" label="影响" min-width="280" />

                <el-table-column prop="action" label="建议动作" min-width="250" />

                <el-table-column label="优先级" width="86" align="center">
                    <template #default="{ row }">
                        <el-tag size="small" :type="LEVEL_TYPE[row.level as IssueLevel]">{{ LEVEL_LABEL[row.level as IssueLevel] }}</el-tag>
                    </template>
                </el-table-column>
            </el-table>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { LEVEL_LABEL, LEVEL_TYPE, QUALITY_ISSUES, type IssueLevel } from './meta';

    /**
     * 区块 5 · 数据质量问题与待办清单
     * 清单内容全部来自需求文档 §2「数据源盘点」的调研结论与既有系统真实问题，未新增编造项；
     * 「今日需处理问题数」（区块 1）是确定性演示值，本清单本身是事实内容，故不加演示标注。
     */
    defineOptions({ name: 'QualityIssues' });

    const level = ref<IssueLevel | 'all'>('all');

    const rows = computed(() => QUALITY_ISSUES.filter((i) => level.value === 'all' || i.level === level.value));

    const subtitle = computed(
        () =>
            `共 ${QUALITY_ISSUES.length} 条已知问题，当前显示 ${rows.value.length} 条 · 其中高优先级 ${QUALITY_ISSUES.filter((i) => i.level === 'high').length} 条`,
    );
</script>

<style scoped lang="scss">
    .issues {
        height: 300px;
        min-height: 0;
    }

    .issues__problem {
        font-weight: 600;
        color: var(--oa-text-1);
    }
</style>
