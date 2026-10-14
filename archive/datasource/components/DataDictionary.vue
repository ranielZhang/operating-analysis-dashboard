<template>
    <PanelCard title="数据字典速查" :subtitle="subtitle">
        <template #actions>
            <el-tag size="small" type="info" effect="plain">{{ fieldCount }} 个核心字段</el-tag>
        </template>

        <el-collapse v-model="active">
            <el-collapse-item v-for="g in DICT_GROUPS" :key="g.name" :name="g.name">
                <template #title>
                    <span class="dict__group-title">{{ g.name }}</span>
                    <span class="dict__group-sub">{{ g.fields.length }} 个字段</span>
                </template>

                <el-table :data="g.fields" size="small" :border="false">
                    <el-table-column prop="cn" label="中文名" min-width="150">
                        <template #default="{ row }">
                            <span class="dict__cn">{{ row.cn }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column prop="field" label="字段名" min-width="140">
                        <template #default="{ row }">
                            <code class="dict__field">{{ row.field }}</code>
                        </template>
                    </el-table-column>

                    <el-table-column prop="unit" label="单位" width="70" align="center" />

                    <el-table-column prop="from" label="来源" min-width="320" />

                    <el-table-column label="是否预估值" width="104" align="center">
                        <template #default="{ row }">
                            <el-tag size="small" :type="row.estimated ? 'warning' : 'info'" effect="plain">
                                {{ row.estimated ? '预估值' : '实际值' }}
                            </el-tag>
                        </template>
                    </el-table-column>
                </el-table>
            </el-collapse-item>
        </el-collapse>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { DICT_GROUPS } from './meta';

    /**
     * 区块 6 · 数据字典速查（可折叠）
     * 字段口径与 store.ts / types.ts 中的 Metrics 字段一一对应，单位和「是否预估」按引擎实现如实标注。
     */
    defineOptions({ name: 'DataDictionary' });

    const active = ref<string[]>([DICT_GROUPS[0].name]);
    const fieldCount = computed(() => DICT_GROUPS.reduce((s, g) => s + g.fields.length, 0));
    const subtitle = computed(() => '核心字段的中文名 / 字段名 / 单位 / 来源 / 是否预估值 · 与数据引擎字段一一对应');
</script>

<style scoped lang="scss">
    .dict__group-title {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .dict__group-sub {
        margin-left: 8px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .dict__cn {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .dict__field {
        padding: 1px 6px;
        border-radius: var(--oa-radius-sm);
        border: 1px solid var(--oa-border);
        background: var(--oa-hover);
        color: var(--oa-primary-deep);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--oa-fs-xs);
    }
</style>
