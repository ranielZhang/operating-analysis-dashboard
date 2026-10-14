<template>
    <div class="st">
        <!-- ===== 页面标题区 ===== -->
        <header class="st__head">
            <div class="st__head-main">
                <h2 class="st__title">预估参数配置</h2>
                <p class="st__subtitle">
                    模型透明化 · 参数可调
                    <span class="st__sep">·</span>
                    分析期间 {{ periodLabel }}
                    <span class="st__sep">·</span>
                    全站预估窗口
                    <b class="st__strong">{{ filter.roiWindow }} 日</b>
                    <span class="st__sep">·</span>
                    范围：{{ hasFilter ? '已按顶部筛选栏限定' : '全公司' }}
                </p>
                <p class="st__hint">
                    这一页回答两个问题：<b>预估模型是怎么算的</b>（曲线公式 / 参数 / 窗口 / 成本分摊规则），
                    以及<b>为什么同一个月会有两个利润数</b>（账面 vs 经营口径）。
                    除「预估窗口」会立即影响全站外，本页的其余切换项都只改变本页的说明与示例展示，不会写回数据。
                </p>
            </div>
            <div class="st__head-actions">
                <el-tag size="small" effect="plain" type="info">回收曲线：ROI(n) = curveA · ln(n) + curveB</el-tag>
                <el-tag size="small" effect="plain" type="success">窗口即时生效</el-tag>
            </div>
        </header>

        <!-- ===== 区块 1 · 算法说明卡 ===== -->
        <AlgorithmDoc />

        <!-- ===== 区块 2 · 回收曲线参数表 ===== -->
        <CurveParamsTable />

        <!-- ===== 区块 3 · 曲线形状对比图 ===== -->
        <CurveCompareChart />

        <!-- ===== 区块 4 · 预估窗口与场景系数 ===== -->
        <ForecastWindowSection />

        <!-- ===== 区块 5 · 成本分摊规则表 + 参数常量 ===== -->
        <CostAllocationSection />
        <CostParamConstants />

        <!-- ===== 区块 6 · 口径对照表 ===== -->
        <BasisCompareTable />
    </div>
</template>

<script setup lang="ts">
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';

    import AlgorithmDoc from './components/AlgorithmDoc.vue';
    import CurveParamsTable from './components/CurveParamsTable.vue';
    import CurveCompareChart from './components/CurveCompareChart.vue';
    import ForecastWindowSection from './components/ForecastWindowSection.vue';
    import CostAllocationSection from './components/CostAllocationSection.vue';
    import CostParamConstants from './components/CostParamConstants.vue';
    import BasisCompareTable from './components/BasisCompareTable.vue';

    /**
     * 预估参数配置页（M12）· 页面只做布局组装与顶部说明
     * 各区块自读全局筛选条件（区块 4 会读写 filter.roiWindow），本页不取数、无 props。
     */
    defineOptions({ name: 'SettingsPage' });

    const { filter, periodLabel, hasFilter } = useAnalysisFilter();
</script>

<style scoped lang="scss">
    .st {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    /* ---------- 标题区 ---------- */
    .st__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 12px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        min-width: 0;
    }

    .st__head-main {
        min-width: 0;
    }

    .st__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .st__subtitle {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-3);
    }

    .st__strong {
        color: var(--oa-operating);
    }

    .st__sep {
        margin: 0 3px;
        color: var(--oa-text-4);
    }

    .st__hint {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
        }
    }

    .st__head-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex: 0 0 auto;
    }

    @media (max-width: 1400px) {
        .st__head {
            flex-direction: column;
        }

        .st__head-actions {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
        }
    }
</style>
