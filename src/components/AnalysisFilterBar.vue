<template>
    <div class="filterbar">
        <!-- 左：时间维度 -->
        <div class="filterbar__group">
            <span class="filterbar__key">时间</span>
            <el-radio-group v-model="filter.granularity" size="small">
                <el-radio-button v-for="g in GRANULARITY_OPTIONS" :key="g.value" :value="g.value">
                    {{ g.label }}
                </el-radio-button>
            </el-radio-group>

            <el-date-picker
                v-model="monthRange"
                type="monthrange"
                size="small"
                range-separator="至"
                start-placeholder="开始月"
                end-placeholder="结束月"
                format="YYYY-MM"
                value-format="YYYY-MM"
                :clearable="false"
                :editable="false"
                class="filterbar__picker"
            />

            <el-select v-model="presetKey" size="small" placeholder="快捷区间" class="filterbar__preset" @change="onPreset">
                <el-option v-for="p in presets" :key="p.key" :label="p.label" :value="p.key" />
            </el-select>
        </div>

        <div class="filterbar__divider" />

        <!-- 右：范围下钻 -->
        <div class="filterbar__group filterbar__group--grow">
            <span class="filterbar__key">范围</span>
            <el-select
                v-model="filter.centerIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                size="small"
                placeholder="全部中心"
                class="filterbar__scope"
            >
                <el-option v-for="c in centers" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <el-select
                v-model="filter.platformIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                size="small"
                placeholder="全部平台"
                class="filterbar__scope"
            >
                <el-option v-for="p in platforms" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-select
                v-model="filter.gameIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                filterable
                size="small"
                placeholder="全部游戏"
                class="filterbar__scope filterbar__scope--wide"
            >
                <el-option v-for="g in games" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>

            <el-button v-if="hasFilter" size="small" text type="primary" @click="reset">清空范围</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import { CENTERS, GAMES, PLATFORMS } from '@/domain/dimensions';
    import { GRANULARITY_OPTIONS, presetRanges, useAnalysisFilter } from '@/composables/useAnalysisFilter';

    /**
     * 全局筛选栏（M1）：时间粒度 / 期间 + 组织与业务范围，全站模块联动。
     *
     * 关于利润口径：这里刻意**不提供全局口径切换**。
     * 原因是「经营利润 / 账面利润」不是二选一的视图，而是同一屏内必须并存对照的一组指标——
     * 经营总览已并排给出「经营利润 / 账面利润 / 口径差额」三张卡，并在「更多分析」里用
     * 双口径趋势图与差额桥接瀑布图解释两者关系；逐层下钻表也同时给出两列。
     * 全局切换只会让各页数字口径漂移、无法横向对账，因此固定以经营口径为主口径。
     */
    defineOptions({ name: 'AnalysisFilterBar' });

    const { filter, hasFilter, reset, applyPreset } = useAnalysisFilter();
    const centers = CENTERS;
    const platforms = PLATFORMS;
    const games = GAMES;
    const presets = presetRanges();
    const presetKey = ref<string>('last12');

    const monthRange = computed({
        get: (): [string, string] => [filter.startMonth, filter.endMonth],
        set: (v: [string, string] | null) => {
            if (!v || v.length !== 2) return;
            filter.startMonth = v[0];
            filter.endMonth = v[1];
        },
    });

    function onPreset(key: string) {
        const p = presets.find((x) => x.key === key);
        if (p) applyPreset(p);
    }

    // 手动改月份后，快捷区间高亮复位
    watch(
        () => [filter.startMonth, filter.endMonth],
        () => {
            const hit = presets.find((p) => p.startMonth === filter.startMonth && p.endMonth === filter.endMonth);
            presetKey.value = hit ? hit.key : '';
        },
    );
</script>

<style scoped lang="scss">
    .filterbar {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding: 8px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        flex: 0 0 auto;
    }

    .filterbar__group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .filterbar__group--grow {
        flex: 1 1 auto;
        justify-content: flex-end;
    }

    .filterbar__key {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        white-space: nowrap;
    }

    .filterbar__divider {
        width: 1px;
        height: 18px;
        background: var(--oa-border);
    }

    .filterbar__picker {
        width: 210px !important;
    }

    .filterbar__preset {
        width: 118px;
    }

    .filterbar__scope {
        width: 150px;
    }

    .filterbar__scope--wide {
        width: 190px;
    }

    :deep(.el-radio-button__inner) {
        padding: 5px 10px;
        font-size: var(--oa-fs-xs);
    }
</style>
